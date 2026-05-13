import { streamNotionAnswer } from "@/lib/notionRag";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let question: string;

  try {
    const body = await request.json();
    question = typeof body.question === "string" ? body.question.trim() : "";
  } catch {
    return Response.json({ error: "요청을 읽을 수 없습니다." }, { status: 400 });
  }

  if (!question) {
    return Response.json({ error: "질문을 입력해 주세요." }, { status: 400 });
  }

  if (question.length > 1000) {
    return Response.json(
      { error: "질문은 1000자 이내로 입력해 주세요." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  void (async () => {
    try {
      for await (const event of streamNotionAnswer(question)) {
        await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "규정 답변을 생성하는 중 문제가 발생했습니다.";
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`),
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
