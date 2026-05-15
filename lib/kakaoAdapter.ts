import { streamNotionAnswer } from "@/lib/notionRag";
import type { NotionSource } from "@/types/notion";

export type KakaoChatResult = {
  answer: string;
  sources: NotionSource[];
  kakaoText: string;
};

const DEFAULT_KAKAO_MAX_LENGTH = 950;
const MIN_KAKAO_MAX_LENGTH = 300;
const MAX_KAKAO_MAX_LENGTH = 1500;

function normalizeWhitespace(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clampMaxLength(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_KAKAO_MAX_LENGTH;
  }

  return Math.min(MAX_KAKAO_MAX_LENGTH, Math.max(MIN_KAKAO_MAX_LENGTH, Math.floor(value)));
}

function summarizeSources(sources: NotionSource[]) {
  const uniqueSources = Array.from(
    new Map(sources.map((source) => [source.pageTitle, source])).values(),
  ).slice(0, 3);

  if (uniqueSources.length === 0) return "";

  return [
    "",
    "참고 규정:",
    ...uniqueSources.map((source, index) => `${index + 1}. ${source.pageTitle}`),
  ].join("\n");
}

function truncateForKakao(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;

  const suffix = "\n\n※ 답변이 길어 핵심만 표시했습니다. 자세한 내용은 웹 챗봇의 참고 규정을 확인해 주세요.";
  const available = Math.max(0, maxLength - suffix.length);
  return `${text.slice(0, available).trimEnd()}${suffix}`;
}

export function formatKakaoText(answer: string, sources: NotionSource[], maxLength?: number) {
  const limit = clampMaxLength(maxLength);
  const body = normalizeWhitespace(answer);
  const sourceText = summarizeSources(sources);
  return truncateForKakao(`${body}${sourceText}`, limit);
}

export async function askRulesForKakao(
  question: string,
  options: { maxLength?: number } = {},
): Promise<KakaoChatResult> {
  let answer = "";
  let sources: NotionSource[] = [];

  for await (const event of streamNotionAnswer(question)) {
    if (event.type === "text") {
      answer += event.delta;
    } else if (event.type === "sources") {
      sources = event.sources;
    } else if (event.type === "error") {
      throw new Error(event.message);
    }
  }

  const normalizedAnswer = normalizeWhitespace(answer);

  return {
    answer: normalizedAnswer,
    sources,
    kakaoText: formatKakaoText(normalizedAnswer, sources, options.maxLength),
  };
}
