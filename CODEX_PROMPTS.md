# VSCode + Codex 작업 프롬프트 모음

아래 프롬프트를 VSCode에서 Codex에게 순서대로 전달하면 기존 교육용 RAG FAQ 챗봇을 사내 규정집 RAG AI 챗봇으로 전환할 수 있다.

## 0. 시작 전 공통 지시

```text
프로젝트 경로: /Users/charlychoi2026/Desktop/rag-faq-chatbot

먼저 README.md, COMPANY_RULES_PROJECT_BRIEF.md, PRD.md, ARCHITECTURE.md, IMPLEMENTATION_PLAN.md를 읽고 현재 목표를 이해해줘.

중요:
- .env.local 값은 절대 출력하지 마.
- API key, token, service role key를 읽거나 보여주지 마.
- 기존 앱은 Next.js 15 + React 19 + TypeScript + Supabase + OpenAI + Notion API 기반이야.
- 목표는 hsikchoi@gmail.com Notion의 사내 규정집 노트를 대상으로 하는 RAG 챗봇이야.
- 대상 Notion page id는 35e0d17ecf4a801d8166eff8982245a9 야.
- UI는 카카오톡 스타일 채팅 화면으로 바꿔줘.

먼저 수정 계획을 짧게 제안하고, 내가 승인하면 파일을 수정해줘.
```

## 1. 현재 코드 구조 파악

```text
이 프로젝트의 현재 구조를 파악해줘.
확인할 항목:
1) app/api/notion-chat/route.ts
2) lib/notionRag.ts
3) scripts/sync-notion.ts
4) components/NotionChatWindow.tsx
5) components/TabLayout.tsx
6) app/page.tsx
7) app/globals.css 또는 public/app.css

출력은 한국어로 간결하게:
- 현재 Notion RAG 흐름
- 사내 규정집 챗봇으로 바꿀 때 재사용할 파일
- 새로 만들거나 이름 바꿀 파일
- 위험한 변경 포인트
```

## 2. 앱 문구와 목적 전환

```text
기존 교육 FAQ/교육 자료 챗봇 문구를 사내 규정집 AI 챗봇 문구로 바꿔줘.

요구사항:
- 앱 제목: 사내 규정 AI 챗봇
- 설명: 사내 규정집을 바탕으로 휴가, 근태, 비용, 보안, 승인 절차 등을 안내합니다.
- 답변 원칙: 규정집에 있는 내용만 근거로 답변합니다.
- 예시 질문도 사내 규정 질문으로 교체
- 기존 FAQ 탭과 Notion 탭이 있으면 단일 챗봇 화면으로 단순화

수정 후 변경 파일 목록과 핵심 변경 내용을 알려줘.
```

## 3. RAG 프롬프트 전환

```text
lib/notionRag.ts를 사내 규정집 RAG 챗봇에 맞게 수정해줘.

요구사항:
- fallback 문구를 “사내 규정집에서 관련 근거를 찾지 못했습니다. 담당 부서에 확인해 주세요.” 계열로 변경
- query rewrite system prompt를 회사 규정 검색용으로 변경
- answer generation system prompt를 사내 규정 안내 챗봇으로 변경
- 검색된 규정 근거 밖의 내용은 추측하지 않도록 강하게 제한
- 답변에는 가능한 경우 다음 구조 사용:
  1. 요약 답변
  2. 적용 기준/절차
  3. 주의사항
  4. 참고 규정
- 법률/노무 판단이 필요한 경우 담당 부서 확인 권장

수정 후 npm run lint를 실행해줘.
```

## 4. 카카오톡 스타일 UI 구현

```text
현재 챗봇 UI를 카카오톡 스타일로 바꿔줘.

요구사항:
- 모바일 우선 레이아웃
- 전체 배경은 카카오톡 채팅방 느낌의 연한 색
- 사용자 말풍선은 오른쪽, 노란색 계열
- AI 말풍선은 왼쪽, 흰색 또는 연회색
- 하단 입력창은 고정된 채팅 입력창처럼 보이게
- 전송 버튼은 명확하게
- 로딩 중에는 “규정집을 확인하고 있어요...” 표시
- 답변 아래에는 참고 규정 카드 표시
- 예시 질문 버튼 4~6개 제공

가능하면 기존 컴포넌트를 재사용하되, 필요하면 KakaoChatWindow.tsx 같은 새 컴포넌트를 만들어도 돼.
수정 후 npm run lint와 npm run build를 실행해줘.
```

## 5. Notion 동기화 명령 정리

```text
package.json scripts에 사내 규정집 작업용 별칭을 추가해줘.

추가 희망 명령어:
- sync:rules = tsx scripts/sync-notion.ts
- test:rules-search = tsx scripts/test-rules-search.ts
- check:rules = npm run lint && npm run build

scripts/test-rules-search.ts가 없으면 대표 질문 몇 개로 / lib 검색 함수를 점검하는 안전한 테스트 스크립트를 만들어줘.
단, .env.local 값은 절대 출력하지 마.
```

## 6. Supabase 스키마 확인

```text
SUPABASE_SCHEMA.md를 기준으로 현재 Supabase 구조와 코드가 맞는지 확인해줘.
MVP에서는 기존 notion_chunks/match_notion_chunks를 재사용하는 방향으로 봐줘.

확인할 것:
- notion_chunks 테이블 컬럼과 코드 타입 일치 여부
- match_notion_chunks RPC 반환값과 types/notion.ts 일치 여부
- threshold 기본값 적정성
- service role key가 브라우저에 노출되지 않는지

필요한 코드 수정이 있으면 제안 후 수정해줘.
```

## 7. 대표 질문 테스트

```text
사내 규정집 RAG 검색 품질을 테스트해줘.

대표 질문:
1. 연차는 며칠 전까지 신청해야 해?
2. 반차도 사용할 수 있어?
3. 출장비는 언제까지 정산해야 해?
4. 재택근무 신청 절차 알려줘.
5. 회사 노트북을 분실하면 어떻게 해야 해?
6. 개인정보 자료는 어떻게 보관해야 해?
7. 복리후생비 사용 기준 알려줘.
8. 결재 승인 절차는 어떻게 돼?
9. 지각하면 어떤 기준으로 처리돼?
10. 규정집에 없는 질문이면 어떻게 답해?

검색 결과의 출처, similarity, 답변 품질을 표로 정리해줘.
비용이 발생하는 OpenAI 호출이 있으면 실행 전에 알려줘.
```

## 8. 최종 검증

```text
최종 검증을 해줘.

실행:
- npm run lint
- npm run build
- git status --short
- .env.local이 git에 추적되지 않는지 확인

검증할 것:
- 앱 목적이 사내 규정 챗봇으로 일관되는지
- 카카오톡 스타일 UI가 적용됐는지
- API key가 브라우저에 노출되지 않는지
- Notion/Supabase/OpenAI 에러가 사용자에게 친절하게 표시되는지

결과를 한국어 PM 보고 형식으로 정리해줘.
```

## 9. 생성형 AI PoC 구현 프롬프트

```text
/Users/charlychoi2026/Desktop/rag-faq-chatbot 프로젝트에 생성형 AI PoC 기능을 추가해줘.

먼저 다음 문서를 순서대로 읽어:
1. COMPANY_RULES_PROJECT_BRIEF.md
2. GENERATIVE_AI_POC_PLAN.md
3. ARCHITECTURE.md
4. IMPLEMENTATION_PLAN.md
5. TEST_PLAN.md

목표:
- 기존 사내 규정 Q&A 기능은 유지한다.
- UI에서 작업 유형을 선택할 수 있게 한다.
- 작업 유형은 qa, email, notice, meeting-summary, ideation 5개다.
- API 요청 body에 mode를 추가한다.
- mode별 system prompt와 temperature를 분리한다.
- 규정 기반 기능은 검색된 출처를 유지한다.
- 회의록 요약은 사용자가 입력한 내용 안에서만 요약한다.

우선 구현 방식:
- 새 파일 lib/generationModes.ts를 만든다.
- 기존 /api/rules-chat 또는 /api/notion-chat의 body parsing에 mode를 추가한다.
- 기존 RAG 검색 로직을 최대한 재사용한다.
- components/NotionChatWindow.tsx 또는 현재 사용 중인 채팅 컴포넌트에 mode 선택 버튼을 추가한다.

보안:
- .env.local 값은 절대 출력하지 마.
- API key, token, service role key를 읽거나 보여주지 마.
- 브라우저 코드에 service role key가 노출되지 않게 해.

완료 후 실행:
- npm run lint
- npm run build
- git status --short

결과는 변경 파일, 구현 내용, 테스트 결과, 남은 리스크 중심으로 한국어로 보고해줘.
```

## 10. 생성형 AI PoC 수동 테스트 프롬프트

```text
생성형 AI PoC 기능을 수동 테스트해줘.

테스트할 질문:
1. [qa] 연차는 며칠 전까지 신청해야 해?
2. [email] 연차 신청 절차를 직원에게 안내하는 이메일을 작성해줘.
3. [notice] 보안 교육 참석 안내 공지문을 작성해줘.
4. [meeting-summary] 다음 회의록을 요약하고 결정사항과 할 일을 정리해줘: 회의일시 2026년 5월 12일, 참석자 김팀장/이대리, 논의 연차 신청 절차 안내문 제작, 결정 다음 주까지 초안 작성, 담당 이대리.
5. [ideation] 직원들이 보안 규정을 쉽게 이해하도록 캠페인 아이디어를 5개 내줘.

각 결과에 대해:
- mode가 제대로 적용됐는지
- 근거 없는 사실을 만들지 않았는지
- 출처가 필요한 경우 표시됐는지
- 출력 형식이 업무에 바로 쓸 수 있는지
확인해줘.
```
