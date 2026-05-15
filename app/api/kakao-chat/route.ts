import { askRulesForKakao } from "@/lib/kakaoAdapter";

export const runtime = "nodejs";

type KakaoChatRequest = {
  question?: unknown;
  channel?: unknown;
  maxLength?: unknown;
  responseFormat?: unknown;
  userRequest?: {
    utterance?: unknown;
  };
};

function getQuestion(body: KakaoChatRequest) {
  if (typeof body.question === "string") return body.question.trim();
  if (typeof body.userRequest?.utterance === "string") {
    return body.userRequest.utterance.trim();
  }
  return "";
}

function getMaxLength(body: KakaoChatRequest) {
  return typeof body.maxLength === "number" ? body.maxLength : undefined;
}

function wantsKakaoOpenBuilderResponse(body: KakaoChatRequest) {
  return body.responseFormat === "kakao-openbuilder" || Boolean(body.userRequest);
}

function toOpenBuilderSimpleText(text: string) {
  return {
    version: "2.0",
    template: {
      outputs: [
        {
          simpleText: {
            text,
          },
        },
      ],
    },
  };
}

export async function POST(request: Request) {
  let body: KakaoChatRequest;

  try {
    body = (await request.json()) as KakaoChatRequest;
  } catch {
    return Response.json({ error: "요청 JSON을 읽을 수 없습니다." }, { status: 400 });
  }

  const question = getQuestion(body);

  if (!question) {
    return Response.json({ error: "question 또는 userRequest.utterance 값을 입력해 주세요." }, { status: 400 });
  }

  if (question.length > 1000) {
    return Response.json(
      { error: "카카오톡 연동 질문은 1000자 이내로 입력해 주세요." },
      { status: 400 },
    );
  }

  try {
    const result = await askRulesForKakao(question, { maxLength: getMaxLength(body) });

    if (wantsKakaoOpenBuilderResponse(body)) {
      return Response.json(toOpenBuilderSimpleText(result.kakaoText));
    }

    return Response.json({
      answer: result.answer,
      kakaoText: result.kakaoText,
      sources: result.sources.map((source) => ({
        title: source.pageTitle,
        url: source.pageUrl,
        preview: source.contentPreview,
        similarity: source.similarity,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "카카오톡용 답변 생성 중 오류가 발생했습니다.";

    if (wantsKakaoOpenBuilderResponse(body)) {
      return Response.json(toOpenBuilderSimpleText("답변을 준비하는 중 문제가 생겼습니다. 잠시 후 다시 질문해 주세요."));
    }

    return Response.json({ error: message }, { status: 500 });
  }
}
