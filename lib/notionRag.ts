import { chatModel, createEmbeddings, getOpenAIClient, rewriteModel } from "@/lib/openai";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import type { NotionChunk, NotionChatResponse, NotionSource } from "@/types/notion";

const fallbackAnswer =
  "업로드된 교육 자료 안에서는 이 질문에 대한 충분한 근거를 찾지 못했습니다. 교육 운영 담당자에게 문의해 주세요.";

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
        `[자료 ${i + 1}]`,
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

// ---------------------------------------------------------------------------
// Multi-query rewriting (same approach as FAQ RAG)
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
            "당신은 교육 자료 검색 시스템의 쿼리 확장 도구입니다.",
            "사용자 질문을 받아 검색 정확도를 높이기 위한 다른 표현 2가지를 생성하세요.",
            "- 동의어와 관련 개념을 활용하세요",
            "- 복합 질문이면 핵심 주제를 분리해서 표현해도 됩니다",
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

  const results = await Promise.all(
    allEmbeddings.map((embedding) =>
      supabase.rpc("match_notion_chunks", {
        query_embedding: embedding,
        match_threshold: 0,
        match_count: candidateCount,
      }),
    ),
  );

  const chunkMap = new Map<string, NotionChunk>();
  for (const result of results) {
    if (result.error) continue;
    for (const chunk of (result.data ?? []) as NotionChunk[]) {
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
  const matchThreshold = toThreshold(process.env.RAG_MATCH_THRESHOLD, 0.5);
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
          "당신은 AI 활용 교육 프로그램의 자료 안내 챗봇입니다.",
          "Notion에 저장된 교육 자료를 바탕으로 질문에 답변합니다.",
          "",
          "## 답변 원칙",
          "- 반드시 제공된 교육 자료 안에서만 답변하세요.",
          "- 여러 자료가 관련될 경우 정보를 종합해서 완전한 답변을 제공하세요.",
          "- 질문이 여러 내용을 담고 있으면 각 항목별로 순서대로 답변하세요.",
          "- 근거 없는 내용은 절대 추측하거나 만들어내지 마세요.",
          "- 근거가 부족하면 솔직히 말하고 담당자 문의를 안내하세요.",
          "",
          "## 답변 형식",
          "- 핵심 답변을 먼저 명확하게 제시하세요.",
          "- 쉽고 친근한 한국어로 답하세요.",
          "- 필요하면 번호나 줄바꿈으로 구조화하세요.",
          "- 출처 페이지명을 자연스럽게 언급하세요.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `사용자 질문: ${question}`,
          "",
          `참고 교육 자료 (${matchedChunks.length}개):`,
          context,
          "",
          "위 자료를 최대한 종합하여 질문에 충실하게 답변해 주세요.",
        ].join("\n"),
      },
    ],
  });

  return {
    answer: response.output_text?.trim() || fallbackAnswer,
    sources: toSources(matchedChunks),
  };
}
