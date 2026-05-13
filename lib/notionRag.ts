import { chatModel, createEmbeddings, getOpenAIClient, rewriteModel } from "@/lib/openai";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { NotionChunk, NotionSource } from "@/types/notion";

export type NotionStreamEvent =
  | { type: "text"; delta: string }
  | { type: "sources"; sources: NotionSource[] }
  | { type: "done" }
  | { type: "error"; message: string };

const fallbackAnswer =
  "사내 규정집에서 이 질문에 답할 충분한 근거를 찾지 못했습니다. 추측해서 안내할 수 없으니 담당 부서에 확인해 주세요.";

// ---------------------------------------------------------------------------
// In-memory LRU cache (TTL 5 min, max 100 entries)
// ---------------------------------------------------------------------------

type CacheEntry = { answer: string; sources: NotionSource[]; expiresAt: number };
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_MAX = 100;

function getCached(key: string): CacheEntry | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  _cache.delete(key);
  _cache.set(key, entry);
  return entry;
}

function setCached(key: string, answer: string, sources: NotionSource[]) {
  if (_cache.size >= CACHE_MAX) {
    const oldest = _cache.keys().next().value;
    if (oldest !== undefined) _cache.delete(oldest);
  }
  _cache.set(key, { answer, sources, expiresAt: Date.now() + CACHE_TTL });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const keywordExpansions: Record<string, string[]> = {
  반바지: ["복장", "착용", "의류", "출근복장", "근무복장"],
  복장: ["착용", "의류", "출근복장", "근무복장"],
  샌들: ["슬리퍼", "복장", "착용", "의류"],
  슬리퍼: ["복장", "착용", "의류", "출근복장", "근무복장", "금지복장"],
  옷차림: ["복장", "착용", "의류", "출근복장", "근무복장"],
  출근복장: ["복장", "착용", "의류"],
  출근해: ["출근", "복장", "착용"],
  출근: ["복장", "착용", "근무복장"],
};

function toPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toThreshold(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

function buildContext(chunks: NotionChunk[]): string {
  return chunks
    .map((chunk, i) =>
      [
        `[규정 근거 ${i + 1}]`,
        `페이지: ${chunk.page_title}`,
        `내용: ${chunk.content}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function toSources(chunks: NotionChunk[]): NotionSource[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    pageId: chunk.page_id,
    pageTitle: chunk.page_title,
    pageUrl: chunk.page_url,
    chunkIndex: chunk.chunk_index,
    contentPreview: chunk.content.slice(0, 120),
    similarity: chunk.similarity,
  }));
}

function stripKoreanParticle(term: string) {
  return term.replace(/(으로|에서|에게|께서|까지|부터|처럼|보다|이나|거나|이랑|하고|의|이|가|은|는|을|를|에|와|과|도|만|로|야)$/u, "");
}

function extractKeywordCandidates(question: string): string[] {
  const stopwords = new Set([
    "뭐", "무엇", "어떻게", "있나요", "인가요", "주세요", "알려줘", "궁금해",
  ]);

  const terms = question
    .split(/[\s,.;:!?()[\]{}"']+/u)
    .map((term) => stripKoreanParticle(term.trim()))
    .map((term) => term.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter((term) => term.length >= 2 && !stopwords.has(term));

  const expandedTerms = terms.flatMap((term) => [
    term,
    ...(keywordExpansions[term] ?? []),
  ]);

  return Array.from(new Set(expandedTerms)).slice(0, 12);
}

function getLexicalScore(question: string, chunk: NotionChunk) {
  const normalizedChunk = `${chunk.page_title} ${chunk.content}`.replace(/\s/g, "");
  const matches = extractKeywordCandidates(question).filter((term) =>
    normalizedChunk.includes(term),
  );
  return Math.min(0.92, 0.5 + matches.length * 0.1);
}

function buildKeywordOrFilter(keywords: string[]) {
  return keywords
    .flatMap((keyword) => [
      `page_title.ilike.%${keyword}%`,
      `content.ilike.%${keyword}%`,
    ])
    .join(",");
}

// ---------------------------------------------------------------------------
// Multi-query rewriting
// ---------------------------------------------------------------------------
async function generateQueryVariants(question: string): Promise<string[]> {
  const openai = getOpenAIClient();
  try {
    const completion = await openai.chat.completions.create({
      model: rewriteModel,
      messages: [
        {
          role: "system",
          content: [
            "당신은 사내 규정집 검색 시스템의 쿼리 확장 도구입니다.",
            "사용자 질문을 받아 관련 회사 규정을 더 잘 찾기 위한 다른 표현 2가지를 생성하세요.",
            "- 휴가, 근태, 비용, 보안, 결재, 복리후생, 개인정보, 장비, 출장 등 규정 검색에 맞는 표현을 활용하세요",
            "- 질문이 구어체이면 규정 문서에 쓰일 법한 명사형 표현으로 바꿔도 됩니다",
            "- 복합 질문이면 핵심 규정 주제를 분리해서 표현해도 됩니다",
            "- JSON 배열만 반환하세요: [\"표현1\", \"표현2\"]",
          ].join("\n"),
        },
        { role: "user", content: question },
      ],
      temperature: 0,
      max_tokens: 200,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [question];

    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return [question];

    const variants = parsed
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .slice(0, 2);

    return [question, ...variants];
  } catch {
    return [question];
  }
}

// ---------------------------------------------------------------------------
// Multi-query retrieval — batches all embeddings in one API call.
// ---------------------------------------------------------------------------
async function retrieveWithFusion(
  question: string,
  candidateCount: number,
): Promise<NotionChunk[]> {
  const supabase = getSupabaseServerClient();

  const queryVariants = await generateQueryVariants(question);
  const allEmbeddings = await createEmbeddings(queryVariants);

  const keywordCandidates = extractKeywordCandidates(question);
  const keywordQuery =
    keywordCandidates.length > 0
      ? supabase
          .from("notion_chunks")
          .select("id,page_id,page_title,page_url,chunk_index,content")
          .or(buildKeywordOrFilter(keywordCandidates))
          .order("page_title", { ascending: true })
          .order("chunk_index", { ascending: true })
          .limit(candidateCount)
      : Promise.resolve({ data: [], error: null });

  const [vectorResults, keywordResult] = await Promise.all([
    Promise.all(allEmbeddings.map((embedding) =>
      supabase.rpc("match_notion_chunks", {
        query_embedding: embedding,
        match_threshold: 0,
        match_count: candidateCount,
      }),
    )),
    keywordQuery,
  ]);

  const chunkMap = new Map<string, NotionChunk>();
  for (const result of vectorResults) {
    if (result.error) continue;
    for (const chunk of (result.data ?? []) as NotionChunk[]) {
      const existing = chunkMap.get(chunk.id);
      if (!existing || chunk.similarity > existing.similarity) {
        chunkMap.set(chunk.id, chunk);
      }
    }
  }

  if (!keywordResult.error) {
    for (const row of (keywordResult.data ?? []) as Omit<NotionChunk, "similarity">[]) {
      const chunk = {
        ...row,
        similarity: getLexicalScore(question, row as NotionChunk),
      };
      const existing = chunkMap.get(chunk.id);
      if (!existing || chunk.similarity > existing.similarity) {
        chunkMap.set(chunk.id, chunk);
      }
    }
  }

  return Array.from(chunkMap.values());
}

// ---------------------------------------------------------------------------
// Output intent detection
// ---------------------------------------------------------------------------

type OutputIntent =
  | "summary"    // 요약해줘
  | "email"      // 이메일 문구
  | "notice"     // 공지문 작성
  | "report"     // 보고서 형식
  | "checklist"  // 체크리스트
  | "qa"         // 기본 질문 답변 (default)

function detectOutputIntent(question: string): OutputIntent {
  const q = question.replace(/\s/g, "");
  if (/이메일|메일문구|메일로|메일형식/.test(q)) return "email";
  if (/공지문|공지사항|공지로|사내공지/.test(q)) return "notice";
  if (/보고서|보고문|보고형식/.test(q)) return "report";
  if (/체크리스트|점검목록|목록으로/.test(q)) return "checklist";
  if (/요약|간단히|간략히|핵심만|짧게|한줄로|정리해/.test(q)) return "summary";
  return "qa";
}

function buildSystemPromptByIntent(intent: OutputIntent): string {
  const base = [
    "당신은 사내 규정 AI 챗봇입니다.",
    "Notion에 저장된 사내 규정집 근거를 바탕으로 직원의 질문에 답변합니다.",
    "",
    "## 공통 원칙",
    "- 반드시 제공된 규정 근거 안에서만 내용을 사용하세요.",
    "- 근거 없는 내용은 절대 추측하거나 만들어내지 마세요.",
    "- 금액, 기한, 담당 부서, 예외 조건 같은 핵심 사실은 원문과 다르게 바꾸지 마세요.",
    "- 마크다운 장식(**,##,###)을 쓰지 마세요.",
  ];

  const intentInstructions: Record<OutputIntent, string[]> = {
    summary: [
      "",
      "## 출력 형식: 요약",
      "- 규정의 핵심 내용만 3~5줄로 간결하게 요약하세요.",
      "- '요약:' 로 시작하고 불릿(•) 또는 번호 목록을 사용하세요.",
      "- 세부 조항이나 예외 사항은 생략하고 핵심 원칙만 남기세요.",
      "- 마지막에 '자세한 내용은 [출처 페이지명] 규정을 참고하세요.' 로 마무리하세요.",
    ],
    email: [
      "",
      "## 출력 형식: 이메일 문구",
      "- 실제로 바로 사용할 수 있는 사내 이메일 형식으로 작성하세요.",
      "- 형식: 제목 / 수신 / 내용 / 관련 규정 / 문의처 순서로 구성하세요.",
      "- 제목은 '[공지]' 또는 '[안내]'로 시작하세요.",
      "- 내용은 규정 근거를 바탕으로 직원이 취해야 할 행동 중심으로 작성하세요.",
      "- 정중하고 공식적인 어투를 사용하세요.",
    ],
    notice: [
      "",
      "## 출력 형식: 공지문",
      "- 사내 공지문 형식으로 작성하세요.",
      "- 형식: 공지 제목 / 공지 일자 / 대상 / 주요 내용 / 문의처 순서로 구성하세요.",
      "- 규정의 핵심 사항을 번호 목록으로 명확히 정리하세요.",
      "- 공식적이고 간결한 어투를 사용하세요.",
    ],
    report: [
      "",
      "## 출력 형식: 보고서",
      "- 간단한 보고서 형식으로 작성하세요.",
      "- 형식: 주제 / 개요 / 주요 내용 / 적용 기준 / 참고 규정 순서로 구성하세요.",
      "- 각 항목을 명확히 구분해서 읽기 쉽게 작성하세요.",
    ],
    checklist: [
      "",
      "## 출력 형식: 체크리스트",
      "- 직원이 확인해야 할 항목을 체크리스트 형식으로 작성하세요.",
      "- 각 항목을 '□ [확인 내용]' 형식으로 나열하세요.",
      "- 실행 가능한 행동 중심으로 작성하세요.",
      "- 마지막에 관련 규정 출처를 한 줄 추가하세요.",
    ],
    qa: [
      "",
      "## 답변 원칙",
      "- 여러 규정이 관련될 경우 근거 범위 안에서만 종합하세요.",
      "- 규정 원문을 길게 그대로 복사하지 말고, 직원이 바로 이해할 수 있도록 의미를 재구성해서 답하세요.",
      "- 질문이 여러 내용을 담고 있으면 각 항목별로 순서대로 답변하세요.",
      "",
      "## 답변 형식",
      "- 가능한 경우 '요약 답변', '적용 기준과 절차', '주의사항', '참고 규정' 순서로 답하세요.",
      "- 핵심 답변을 먼저 명확하게 제시하세요.",
      "- 직원이 바로 이해할 수 있는 간단명료한 한국어로 답하세요.",
      "- 답변은 너무 길지 않게 6~10문장 정도로 작성하세요.",
    ],
  };

  return [...base, ...intentInstructions[intent]].join("\n");
}

function buildUserPromptByIntent(
  question: string,
  context: string,
  matchCount: number,
  intent: OutputIntent,
): string {
  const intentHint: Record<OutputIntent, string> = {
    summary: "위 규정을 바탕으로 핵심 내용만 간결하게 요약해 주세요. 원문을 그대로 나열하지 말고 핵심만 추려 주세요.",
    email: "위 규정을 바탕으로 직원에게 발송할 사내 이메일 문구를 작성해 주세요.",
    notice: "위 규정을 바탕으로 사내 공지문을 작성해 주세요.",
    report: "위 규정을 바탕으로 보고서 형식으로 정리해 주세요.",
    checklist: "위 규정을 바탕으로 직원이 확인해야 할 체크리스트를 작성해 주세요.",
    qa: "위 규정 근거 안에서만 질문에 충실하게 답변해 주세요. 검색 원문을 그대로 나열하지 말고, 사용자가 해야 할 행동 중심으로 재구성하세요.",
  };

  return [
    `사용자 질문: ${question}`,
    "",
    `참고 사내 규정 (${matchCount}개):`,
    context,
    "",
    intentHint[intent],
    "마크다운 굵게 표시(**)와 ## 제목 표시는 절대 사용하지 마세요.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Public streaming entry point
// ---------------------------------------------------------------------------
export async function* streamNotionAnswer(
  question: string,
): AsyncGenerator<NotionStreamEvent> {
  const intent = detectOutputIntent(question);
  const cacheKey = `${intent}::${question}`;

  const cached = getCached(cacheKey);
  if (cached) {
    yield { type: "text", delta: cached.answer };
    yield { type: "sources", sources: cached.sources };
    yield { type: "done" };
    return;
  }

  const matchThreshold = toThreshold(process.env.RAG_MATCH_THRESHOLD, 0.45);
  const matchCount = toPositiveInteger(process.env.RAG_MATCH_COUNT, 5);
  const candidateCount = Math.max(matchCount * 4, 20);

  const rawChunks = await retrieveWithFusion(question, candidateCount);

  const matchedChunks = rawChunks
    .filter((c) => c.similarity >= matchThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);

  if (matchedChunks.length === 0) {
    setCached(cacheKey, fallbackAnswer, []);
    yield { type: "text", delta: fallbackAnswer };
    yield { type: "sources", sources: [] };
    yield { type: "done" };
    return;
  }

  const openai = getOpenAIClient();
  const context = buildContext(matchedChunks);

  const stream = openai.responses.stream({
    model: chatModel,
    input: [
      {
        role: "system",
        content: buildSystemPromptByIntent(intent),
      },
      {
        role: "user",
        content: buildUserPromptByIntent(question, context, matchedChunks.length, intent),
      },
    ],
  });

  let fullText = "";

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      fullText += event.delta;
      yield { type: "text", delta: event.delta };
    }
  }

  const sources = toSources(matchedChunks);
  setCached(cacheKey, fullText || fallbackAnswer, sources);

  yield { type: "sources", sources };
  yield { type: "done" };
}
