import { chatModel, createEmbeddings, getOpenAIClient, rewriteModel } from "@/lib/openai";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { NotionChunk, NotionChatResponse, NotionSource } from "@/types/notion";

const fallbackAnswer =
  "사내 규정집에서 이 질문에 답할 충분한 근거를 찾지 못했습니다. 추측해서 안내할 수 없으니 담당 부서에 확인해 주세요.";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    "뭐",
    "무엇",
    "어떻게",
    "있나요",
    "인가요",
    "주세요",
    "알려줘",
    "궁금해",
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
// Multi-query rewriting for company rule retrieval
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
// Multi-query retrieval with score fusion
// ---------------------------------------------------------------------------

async function retrieveWithFusion(
  question: string,
  candidateCount: number,
): Promise<NotionChunk[]> {
  const supabase = getSupabaseServerClient();

  const [queryVariants, [originalEmbedding]] = await Promise.all([
    generateQueryVariants(question),
    createEmbeddings([question]),
  ]);

  const variantTexts = queryVariants.slice(1);
  const variantEmbeddings =
    variantTexts.length > 0 ? await createEmbeddings(variantTexts) : [];

  const allEmbeddings = [originalEmbedding, ...variantEmbeddings];

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
// Public entry point
// ---------------------------------------------------------------------------

export async function answerNotionQuestion(
  question: string,
): Promise<NotionChatResponse> {
  const matchThreshold = toThreshold(process.env.RAG_MATCH_THRESHOLD, 0.45);
  const matchCount = toPositiveInteger(process.env.RAG_MATCH_COUNT, 5);
  const candidateCount = Math.max(matchCount * 4, 20);

  const rawChunks = await retrieveWithFusion(question, candidateCount);

  const matchedChunks = rawChunks
    .filter((c) => c.similarity >= matchThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);

  if (matchedChunks.length === 0) {
    return { answer: fallbackAnswer, sources: [] };
  }

  const openai = getOpenAIClient();
  const context = buildContext(matchedChunks);

  const response = await openai.responses.create({
    model: chatModel,
    input: [
      {
        role: "system",
        content: [
          "당신은 사내 규정 AI 챗봇입니다.",
          "Notion에 저장된 사내 규정집 근거를 바탕으로 직원의 질문에 답변합니다.",
          "",
          "## 답변 원칙",
          "- 반드시 제공된 규정 근거 안에서만 답변하세요.",
          "- 여러 규정이 관련될 경우 근거 범위 안에서만 종합하세요.",
          "- 질문이 여러 내용을 담고 있으면 각 항목별로 순서대로 답변하세요.",
          "- 근거 없는 내용은 절대 추측하거나 만들어내지 마세요.",
          "- 근거가 부족하면 솔직히 말하고 담당 부서 확인을 안내하세요.",
          "- 법률, 노무, 징계, 보안 사고, 개인정보 이슈처럼 판단이 필요한 사안은 담당 부서 확인을 권장하세요.",
          "",
          "## 답변 형식",
          "- 가능한 경우 '요약 답변', '적용 기준/절차', '주의사항', '참고 규정' 순서로 답하세요.",
          "- 핵심 답변을 먼저 명확하게 제시하세요.",
          "- 직원이 바로 이해할 수 있는 간단명료한 한국어로 답하세요.",
          "- 참고 규정에는 출처 페이지명을 자연스럽게 언급하세요.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `사용자 질문: ${question}`,
          "",
          `참고 사내 규정 (${matchedChunks.length}개):`,
          context,
          "",
          "위 규정 근거 안에서만 질문에 충실하게 답변해 주세요.",
        ].join("\n"),
      },
    ],
  });

  return {
    answer: response.output_text?.trim() || fallbackAnswer,
    sources: toSources(matchedChunks),
  };
}
