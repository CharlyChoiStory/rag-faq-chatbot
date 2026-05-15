# 카카오톡 연동 신규 버전 구현 계획

작성일: 2026-05-16  
대상 프로젝트: `/Users/charlychoi2026/Desktop/rag-faq-chatbot`

## 1. 목표

기존 웹 기반 사내 규정 RAG 챗봇은 그대로 유지하면서, 카카오톡 또는 PlayMCP에서 호출하기 쉬운 별도 API 버전을 추가한다.

```text
기존 웹 버전
브라우저 → /api/rules-chat → SSE 스트리밍 답변

신규 카카오톡형 버전
카카오톡/PlayMCP/외부 에이전트 → /api/kakao-chat → 단일 JSON 답변
```

## 2. 보존 원칙

- 기존 `/api/rules-chat`는 수정하지 않는다.
- 기존 `components/NotionChatWindow.tsx` 웹 UI는 수정하지 않는다.
- 기존 RAG 핵심인 `lib/notionRag.ts`는 재사용한다.
- 카카오톡/PlayMCP 대응은 신규 어댑터와 신규 API에서 처리한다.

## 3. 신규 파일

```text
lib/kakaoAdapter.ts
app/api/kakao-chat/route.ts
docs/KAKAO_TALK_INTEGRATION_PLAN.md
docs/PLAYMCP_CHECKLIST.md
```

## 4. 데이터 흐름

```text
사용자 질문
  → /api/kakao-chat
  → lib/kakaoAdapter.ts
  → streamNotionAnswer(question)
  → 답변 스트림을 단일 텍스트로 수집
  → 카카오톡용 짧은 답변 + 참고 규정 요약
  → JSON 또는 Kakao OpenBuilder simpleText 응답
```

## 5. API 사용법

### 5.1 일반 JSON 요청

```bash
curl -X POST http://localhost:3000/api/kakao-chat \
  -H "Content-Type: application/json" \
  -d '{"question":"연차는 며칠 전까지 신청해야 해?","channel":"kakao"}'
```

응답 예시:

```json
{
  "answer": "전체 답변",
  "kakaoText": "카카오톡에 보내기 좋은 짧은 답변",
  "sources": [
    {
      "title": "휴가 규정",
      "url": "https://...",
      "preview": "...",
      "similarity": 0.82
    }
  ]
}
```

### 5.2 Kakao OpenBuilder 스타일 요청

```bash
curl -X POST http://localhost:3000/api/kakao-chat \
  -H "Content-Type: application/json" \
  -d '{"userRequest":{"utterance":"연차는 며칠 전까지 신청해야 해?"}}'
```

응답 예시:

```json
{
  "version": "2.0",
  "template": {
    "outputs": [
      {
        "simpleText": {
          "text": "카카오톡용 답변"
        }
      }
    ]
  }
}
```

## 6. PlayMCP 연동 방향

PlayMCP가 외부 URL 호출 또는 커스텀 도구 등록을 지원하면 `/api/kakao-chat`를 호출한 뒤 `kakaoText`를 카카오톡 나와의 채팅방으로 전송한다.

```text
AI / OpenClaw / ChatGPT
  → /api/kakao-chat 호출
  → kakaoText 수신
  → PlayMCP 카카오톡 도구로 나와의 채팅방 전송
```

주의: PlayMCP가 “카카오톡으로 보내기”만 지원하고 “카카오톡에서 질문 받기”를 지원하지 않을 수 있다. 이 경우 완전한 양방향 챗봇은 카카오 채널/Webhook 방식으로 확장해야 한다.

## 7. 카카오 채널/Webhook 확장 방향

PlayMCP가 양방향 질의응답에 부족하면 다음 구조로 확장한다.

```text
카카오톡 채널
  → 카카오 챗봇/OpenBuilder Webhook
  → /api/kakao-chat
  → simpleText 응답
```

필요 사항:

- 외부 배포 URL: Vercel Production 또는 ngrok 개발 URL
- 카카오 채널/챗봇 설정
- 응답 지연과 답변 길이 제한 확인
- 필요 시 Webhook 인증/서명 검증 추가

## 8. 검증 명령

```bash
npm run lint
npm run build

curl -X POST http://localhost:3000/api/kakao-chat \
  -H "Content-Type: application/json" \
  -d '{"question":"연차는 며칠 전까지 신청해야 해?","channel":"kakao"}'
```

## 9. 남은 의사결정

1. PlayMCP만으로 충분한가?
2. 실제 카카오톡 채널 챗봇까지 구현할 것인가?
3. 카톡 응답 길이를 700자, 950자, 1000자 중 어디로 제한할 것인가?
4. 답변에 Notion 링크를 직접 포함할 것인가, 제목만 표시할 것인가?
