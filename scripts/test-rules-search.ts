import * as path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(process.cwd()));

import { streamNotionAnswer } from "../lib/notionRag";
import type { NotionSource } from "../types/notion";

async function answerNotionQuestion(question: string) {
  let answer = "";
  let sources: NotionSource[] = [];
  for await (const event of streamNotionAnswer(question)) {
    if (event.type === "text") answer += event.delta;
    else if (event.type === "sources") sources = event.sources;
  }
  return { answer, sources };
}

const questions = [
  "연차는 며칠 전까지 신청해야 해?",
  "반차도 사용할 수 있어?",
  "출장비는 언제까지 정산해야 해?",
  "재택근무 신청 절차 알려줘.",
  "회사 노트북을 분실하면 어떻게 해야 해?",
  "개인정보 자료는 어떻게 보관해야 해?",
  "복리후생비 사용 기준 알려줘.",
  "결재 승인 절차는 어떻게 돼?",
  "지각하면 어떻게 처리돼?",
  "슬리퍼와 반바지를 입고 출근해도 되?",
  "슬리퍼를 입고 출근해도 되?",
  "점심 메뉴 추천해줘.",
];

function maskAnswer(answer: string) {
  return answer.replace(/\s+/g, " ").slice(0, 240);
}

async function main() {
  console.log("사내 규정집 RAG 검색 테스트를 시작합니다.");
  console.log("주의: 이 스크립트는 OpenAI/Supabase API를 실제 호출할 수 있습니다.\n");

  let passLikeCount = 0;

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    console.log(`\n=== ${index + 1}. ${question} ===`);

    try {
      const result = await answerNotionQuestion(question);
      const sources = result.sources ?? [];

      if (sources.length > 0) passLikeCount++;

      console.log(`sources: ${sources.length}`);
      for (const source of sources.slice(0, 5)) {
        console.log(
          `- ${Math.round(source.similarity * 1000) / 10}% | ${source.pageTitle} | chunk#${source.chunkIndex}`,
        );
      }
      console.log(`answer preview: ${maskAnswer(result.answer)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`error: ${message}`);
    }
  }

  console.log("\n===========================");
  console.log(`출처가 반환된 질문: ${passLikeCount}/${questions.length}`);
  console.log("정답 여부는 source 제목과 답변 내용을 사람이 최종 확인해야 합니다.");
}

main().catch((error) => {
  console.error("test-rules-search 실패:", error instanceof Error ? error.message : error);
  process.exit(1);
});
