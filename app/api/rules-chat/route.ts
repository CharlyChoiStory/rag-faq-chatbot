import { NextResponse } from "next/server";
import { answerNotionQuestion } from "@/lib/notionRag";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question =
      typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json(
        { error: "질문을 입력해 주세요." },
        { status: 400 },
      );
    }

    if (question.length > 1000) {
      return NextResponse.json(
        { error: "질문은 1000자 이내로 입력해 주세요." },
        { status: 400 },
      );
    }

    const result = await answerNotionQuestion(question);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "규정 답변을 생성하는 중 문제가 발생했습니다.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
