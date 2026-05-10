import {
  chatModel,
  createEmbeddings,
  getOpenAIClient,
  rewriteModel,
} from "@/lib/openai";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { MatchedFaq } from "@/types/faq";
import type { ChatResponse, ChatSource } from "@/types/chat";

const fallbackAnswer =
  "확인된 FAQ 자료 안에서는 이 질문에 대한 충분한 근거를 찾지 못했습니다. 교육 운영 담당자에게 문의해 주세요.";

// ---------------------------------------------------------------------------
// Synonym groups for keyword-based re-ranking boost.
// queryKeywords: words that trigger the boost when found in the user's question.
// faqKeywords:   words that must appear in the FAQ text for the boost to apply.
// faqCategories: FAQ categories that also qualify for the boost.
// boost:         amount added to the raw similarity score (capped at 1.0).
// ---------------------------------------------------------------------------
type SynonymGroup = {
  queryKeywords: string[];
  faqKeywords: string[];
  faqCategories: string[];
  boost: number;
};

const synonymGroups: SynonymGroup[] = [
  {
    queryKeywords: [
      "중장년", "시니어", "중년", "장년층", "어르신",
      "고령자", "5060", "노년층", "나이",
    ],
    faqKeywords: [
      "중장년", "시니어", "중년", "장년층", "어르신",
      "고령자", "5060", "노년층",
    ],
    faqCategories: ["수강 대상"],
    boost: 0.35,
  },
  {
    queryKeywords: [
      "결석", "빠지다", "빠지면", "못 나가", "안 나가",
      "불참", "결강", "출석", "출결",
    ],
    faqKeywords: ["빠지면", "결석", "출석", "출결", "결강"],
    faqCategories: ["출결", "수료 기준", "출석"],
    boost: 0.30,
  },
  {
    queryKeywords: [
      "수료", "이수", "수료증", "이수증", "완료", "마치다",
      "졸업", "수료 기준", "이수 기준",
    ],
    faqKeywords: ["수료", "이수", "수료증", "이수증"],
    faqCategories: ["수료 기준", "이수"],
    boost: 0.25,
  },
  {
    queryKeywords: [
      "무료", "공짜", "비용", "돈", "요금", "교육비",
      "수강료", "얼마", "가격",
    ],
    faqKeywords: ["무료", "교육비", "비용", "요금", "수강료"],
    faqCategories: ["교육비", "수강료"],
    boost: 0.25,
  },
  {
    queryKeywords: [
      "노트북", "컴퓨터", "PC", "랩탑", "기기",
      "스마트폰", "핸드폰", "태블릿", "준비물", "가져올",
    ],
    faqKeywords: ["노트북", "컴퓨터", "PC", "기기", "스마트폰", "준비물"],
    faqCategories: ["준비물"],
    boost: 0.25,
  },
  {
    queryKeywords: [
      "신청", "접수", "등록", "지원", "신청서",
      "어떻게 신청", "신청 방법",
    ],
    faqKeywords: ["신청", "접수", "등록"],
    faqCategories: ["AI 교육 신청", "신청"],
    boost: 0.20,
  },
  {
    queryKeywords: [
      "환불", "반환", "돌려받", "취소", "철회",
    ],
    faqKeywords: ["환불", "반환", "취소"],
    faqCategories: ["환불", "취소"],
    boost: 0.25,
  },
  {
    queryKeywords: [
      "코딩", "프로그래밍", "개발", "영어", "어렵", "따라갈",
      "처음", "초보", "입문", "왕초보",
    ],
    faqKeywords: ["코딩", "프로그래밍", "영어", "따라", "초보", "처음"],
    faqCategories: ["수강 대상", "난이도"],
    boost: 0.20,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toThreshold(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((kw) => text.includes(kw.replace(/\s/g, "")));
}

function getKeywordBoost(question: string, faq: MatchedFaq): number {
  const normalizedQuestion = question.replace(/\s/g, "");
  const faqText = [
    faq.question,
    faq.answer,
    faq.category ?? "",
    faq.source ?? "",
  ]
    .join(" ")
    .replace(/\s/g, "");

  let totalBoost = 0;

  for (const group of synonymGroups) {
    const questionMatches = includesAny(normalizedQuestion, group.queryKeywords);
    const faqKeywordMatches = includesAny(faqText, group.faqKeywords);
    const faqCategoryMatches =
      faq.category ? group.faqCategories.includes(faq.category) : false;

    if (questionMatches && (faqKeywordMatches || faqCategoryMatches)) {
      totalBoost = Math.max(totalBoost, group.boost);
    }
  }

  return totalBoost;
}

function rerankFaqs(
  question: string,
  faqs: MatchedFaq[],
  threshold: number,
): MatchedFaq[] {
  return faqs
    .map((faq) => ({
      ...faq,
      similarity: Math.min(1, faq.similarity + getKeywordBoost(question, faq)),
    }))
    .filter((faq) => faq.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

function buildContext(faqs: MatchedFaq[]): string {
  return faqs
    .map((faq, index) =>
      [
        `[FAQ ${index + 1}]`,
        `질문: ${faq.question}`,
        `답변: ${faq.answer}`,
        faq.category ? `카테고리: ${faq.category}` : "",
        faq.source ? `출처: ${faq.source}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function toSources(faqs: MatchedFaq[]): ChatSource[] {
  return faqs.map((faq) => ({
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
    source: faq.source,
    sourceUrl: faq.source_url,
    similarity: faq.similarity,
  }));
}

// ---------------------------------------------------------------------------
// Query rewriting — generates synonym/paraphrase variants via a fast LLM.
// Failures silently fall back to the original question only.
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
            "당신은 한국어 교육 FAQ 검색 시스템의 쿼리 확장 도구입니다.",
            "사용자 질문을 받아 검색 정확도를 높이기 위한 다른 표현 2가지를 생성하세요.",
            "",
            "규칙:",
            "- 동의어를 적극 활용하세요 (예: 결석→빠지다, 무료→비용없음, 수료→이수)",
            "- 복합 질문이면 핵심 주제를 분리해서 하나씩 표현해도 됩니다",
            "- FAQ 데이터베이스에서 검색될 법한 자연스러운 한국어로 작성하세요",
            "- JSON 배열만 반환하세요. 다른 텍스트 없이: [\"표현1\", \"표현2\"]",
          ].join("\n"),
        },
        {
          role: "user",
          content: question,
        },
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
// Multi-query retrieval with score fusion.
// Embeds the original question and LLM variants in one batch call, then runs
// all Supabase RPCs in parallel and merges by keeping the max similarity.
// ---------------------------------------------------------------------------
async function retrieveWithFusion(
  question: string,
  candidateCount: number,
): Promise<MatchedFaq[]> {
  const supabase = getSupabaseServerClient();

  // Rewrite and embed original in parallel — total wait = max(rewrite, embed).
  const [queryVariants, [originalEmbedding]] = await Promise.all([
    generateQueryVariants(question),
    createEmbeddings([question]),
  ]);

  // Embed only the LLM-generated variants (original already embedded above).
  const variantTexts = queryVariants.slice(1);
  const variantEmbeddings =
    variantTexts.length > 0 ? await createEmbeddings(variantTexts) : [];

  const allEmbeddings = [originalEmbedding, ...variantEmbeddings];

  // Fan out all Supabase vector searches in parallel.
  const results = await Promise.all(
    allEmbeddings.map((embedding) =>
      supabase.rpc("match_faqs", {
        query_embedding: embedding,
        match_threshold: 0,
        match_count: candidateCount,
      }),
    ),
  );

  // Merge: per FAQ id, keep the highest similarity score across all queries.
  const faqMap = new Map<string, MatchedFaq>();
  for (const result of results) {
    if (result.error) continue;
    for (const faq of (result.data ?? []) as MatchedFaq[]) {
      const existing = faqMap.get(faq.id);
      if (!existing || faq.similarity > existing.similarity) {
        faqMap.set(faq.id, faq);
      }
    }
  }

  return Array.from(faqMap.values());
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export async function answerQuestion(question: string): Promise<ChatResponse> {
  const matchThreshold = toThreshold(process.env.RAG_MATCH_THRESHOLD, 0.5);
  const matchCount = toPositiveInteger(process.env.RAG_MATCH_COUNT, 5);
  const candidateCount = Math.max(matchCount * 4, 20);

  const rawFaqs = await retrieveWithFusion(question, candidateCount);
  const matchedFaqs = rerankFaqs(question, rawFaqs, matchThreshold).slice(
    0,
    matchCount,
  );

  if (matchedFaqs.length === 0) {
    return { answer: fallbackAnswer, sources: [] };
  }

  const openai = getOpenAIClient();
  const context = buildContext(matchedFaqs);

  const response = await openai.responses.create({
    model: chatModel,
    input: [
      {
        role: "system",
        content: [
          "당신은 중장년 학습자를 위한 AI 교육 프로그램의 FAQ 전문 안내 챗봇입니다.",
          "",
          "## 답변 원칙",
          "- 반드시 제공된 FAQ 근거 안에서만 답변하세요.",
          "- 여러 FAQ가 관련될 경우 정보를 빠짐없이 종합해서 완전한 답변을 제공하세요.",
          "- 질문이 여러 내용을 담고 있으면 각 항목별로 순서대로 답변하세요.",
          "- 근거 없는 내용은 절대 추측하거나 만들어내지 마세요.",
          "- 근거가 부족한 부분은 솔직히 '확인할 수 없다'고 하고 담당자 문의를 안내하세요.",
          "",
          "## 답변 형식",
          "- 핵심 답변을 가장 먼저 명확하게 제시하세요.",
          "- 쉽고 친근한 한국어로 답하세요 (중장년 학습자 대상이므로 전문 용어 최소화).",
          "- 여러 항목이 있을 때는 번호나 줄바꿈으로 구조화해서 읽기 쉽게 만드세요.",
          "- 관련 출처(FAQ 번호 또는 출처명)가 있으면 자연스럽게 언급하세요.",
          "- 필요한 경우 추가 문의처 안내로 마무리하세요.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `사용자 질문: ${question}`,
          "",
          `참고 FAQ (${matchedFaqs.length}개):`,
          context,
          "",
          "위 FAQ를 최대한 종합하여 질문에 충실하게 답변해 주세요.",
          "복합 질문이면 각 항목별로 나눠서 답하고, 관련 FAQ를 모두 활용하세요.",
        ].join("\n"),
      },
    ],
  });

  return {
    answer: response.output_text?.trim() || fallbackAnswer,
    sources: toSources(matchedFaqs),
  };
}
