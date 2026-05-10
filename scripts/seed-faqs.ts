import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

loadEnvConfig(process.cwd());

type FaqInput = {
  question: string;
  answer: string;
  category?: string;
  source?: string;
  source_url?: string;
  sourceUrl?: string;
  related_keywords?: string[] | string;
  relatedKeywords?: string[] | string;
  is_public?: boolean;
};

const embeddingModel = "text-embedding-3-small";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || value.startsWith("replace_with_")) {
    throw new Error(`${name} 환경변수가 필요합니다.`);
  }

  return value;
}

function isFaqInput(value: unknown): value is FaqInput {
  if (!value || typeof value !== "object") return false;

  const faq = value as Record<string, unknown>;
  return typeof faq.question === "string" && typeof faq.answer === "string";
}

function normalizeKeywords(keywords: string[] | string | undefined) {
  if (!keywords) return "";

  if (Array.isArray(keywords)) {
    return keywords
      .map((keyword) => keyword.trim())
      .filter(Boolean)
      .join(", ");
  }

  return keywords.trim();
}

function createContent(faq: FaqInput) {
  const keywords = normalizeKeywords(
    faq.related_keywords ?? faq.relatedKeywords,
  );

  return [
    `질문: ${faq.question}`,
    `답변: ${faq.answer}`,
    faq.category ? `카테고리: ${faq.category}` : "",
    keywords ? `관련 키워드: ${keywords}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function shouldStopImmediately(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const possibleStatus = (error as { status?: unknown }).status;
  const possibleMessage = (error as { message?: unknown }).message;

  return (
    possibleStatus === 401 ||
    possibleStatus === 429 ||
    (typeof possibleMessage === "string" &&
      (possibleMessage.includes("Incorrect API key") ||
        possibleMessage.includes("exceeded your current quota")))
  );
}

async function loadFaqs() {
  const filePath = path.join(process.cwd(), "data", "faqs.json");
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("data/faqs.json은 FAQ 객체 배열이어야 합니다.");
  }

  return parsed.map((item, index) => {
    if (!isFaqInput(item)) {
      throw new Error(
        `data/faqs.json의 ${index + 1}번째 FAQ에 question 또는 answer가 없습니다.`,
      );
    }

    return item;
  });
}

async function main() {
  const openai = new OpenAI({
    apiKey: requireEnv("OPENAI_API_KEY"),
  });

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const faqs = await loadFaqs();
  let successCount = 0;
  let failureCount = 0;

  console.log(`FAQ ${faqs.length}개 적재를 시작합니다.`);

  for (const [index, faq] of faqs.entries()) {
    const label = `${index + 1}. ${faq.question}`;

    try {
      const content = createContent(faq);
      const embeddingResponse = await openai.embeddings.create({
        model: embeddingModel,
        input: content,
        encoding_format: "float",
      });

      const embedding = embeddingResponse.data[0]?.embedding;
      if (!embedding) {
        throw new Error("OpenAI embedding 응답이 비어 있습니다.");
      }

      const { error } = await supabase
        .from("faqs")
        .upsert(
          {
            question: faq.question,
            answer: faq.answer,
            category: faq.category ?? null,
            source: faq.source ?? null,
            source_url: faq.source_url ?? faq.sourceUrl ?? null,
            content,
            embedding,
            is_public: faq.is_public ?? true,
          },
          {
            onConflict: "question",
          },
        );

      if (error) {
        throw new Error(error.message);
      }

      successCount += 1;
      console.log(`성공: ${label}`);
    } catch (error) {
      failureCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`실패: ${label}`);
      console.error(`  원인: ${message}`);

      if (shouldStopImmediately(error)) {
        console.error(
          "OpenAI 인증 또는 사용량 한도 문제로 보입니다. 나머지 FAQ 처리를 중단합니다.",
        );
        break;
      }
    }
  }

  console.log(
    `FAQ 적재 완료: 성공 ${successCount}개, 실패 ${failureCount}개`,
  );

  if (failureCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAQ 적재 스크립트 실행 실패: ${message}`);
  process.exit(1);
});
