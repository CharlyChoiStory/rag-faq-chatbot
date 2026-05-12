# Company Rules RAG Chatbot Project Brief

이 문서는 VSCode + Codex가 가장 먼저 읽어야 하는 작업 브리프입니다.

## 1. 목표

기존 `rag-faq-chatbot` 프로젝트를 사내 규정집 RAG AI 챗봇으로 대폭 수정한다.

사용자는 웹 챗봇에 자연어로 질문하고, AI는 Notion 사내 규정집에서 관련 규정을 찾아 근거 기반으로 답변한다.

## 2. 원본 데이터

- Notion 계정: hsikchoi@gmail.com
- 원본 페이지: 사내 규정집
- URL: https://www.notion.so/charly-choi/35e0d17ecf4a801d8166eff8982245a9?pvs=12
- Page ID: `35e0d17ecf4a801d8166eff8982245a9`
- 데이터 규모: 약 20개 회사 규정

## 3. 제품 컨셉

- 이름: 사내 규정 AI 챗봇
- 목적: 휴가, 근태, 비용, 보안, 결재, 복리후생 등 회사 규정 정보를 쉽게 찾게 한다.
- UI 스타일: 카카오톡 스타일 채팅 화면
- 답변 방식: 검색된 규정 근거 안에서만 답변하고 출처를 표시한다.

## 4. 현재 기술스택

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS / CSS
- Supabase Postgres + pgvector
- OpenAI API
- Notion API

## 5. 기존 코드에서 재사용할 것

- `scripts/sync-notion.ts`: Notion 페이지 동기화
- `lib/notion.ts`: Notion block/page 추출
- `lib/notionRag.ts`: Notion 청크 검색 + 답변 생성
- `app/api/notion-chat/route.ts`: Notion RAG API
- `components/NotionChatWindow.tsx`: 챗봇 UI 기반
- `components/NotionSourceList.tsx`: 출처 표시 기반
- `SUPABASE_SCHEMA.md`: Supabase 스키마 기반

## 6. 우선 수정할 것

1. 앱 문구를 사내 규정 챗봇으로 변경
2. 기존 탭 UI를 단일 규정 챗봇 UI로 단순화
3. RAG 시스템 프롬프트를 회사 규정 안내용으로 변경
4. fallback 문구를 규정집 근거 부족 기준으로 변경
5. 예시 질문을 사내 규정 질문으로 변경
6. UI를 카카오톡 스타일 말풍선으로 변경
7. package.json scripts에 사내 규정 작업 명령어 추가
8. 대표 질문 검색 테스트 스크립트 추가

## 7. 답변 원칙

AI는 다음 원칙을 반드시 지킨다.

- 규정집에서 검색된 근거만 사용한다.
- 근거가 없으면 모른다고 답한다.
- 추측하거나 일반 상식으로 보완하지 않는다.
- 중요한 업무 판단은 담당 부서 확인을 권장한다.
- 답변에는 참고 규정 출처를 표시한다.

## 8. 카카오톡 스타일 UI 요구사항

- 채팅방 배경: 연한 베이지/노란색 계열
- 사용자 말풍선: 오른쪽, 노란색
- AI 말풍선: 왼쪽, 흰색 또는 연회색
- 하단 고정 입력창
- 모바일에서도 편한 큰 글자
- 예시 질문 버튼
- 출처 카드는 답변 아래 작게 표시

## 9. 완료 기준

- `npm run lint` 통과
- `npm run build` 통과
- Notion 규정집 동기화 성공
- 대표 질문 10개 중 8개 이상 관련 규정 검색
- 카카오톡 스타일 UI 적용
- `.env.local`/키 노출 없음

## 10. 금지사항

- `.env.local` 값 출력 금지
- API key/token/service role key 출력 금지
- 내부 규정 원문을 GitHub 공개 저장소에 커밋 금지
- 근거 없는 규정 답변 생성 금지
