# 사내 규정집 RAG AI 챗봇

작성일: 2026-05-12

이 프로젝트는 기존 교육용 FAQ/Notion RAG 챗봇을 바탕으로, hsikchoi@gmail.com 계정의 Notion에 있는 사내 규정집 노트를 검색하는 사내 업무 지원 AI 챗봇 웹앱으로 전환하는 프로젝트입니다.

대상 Notion 원본:
https://www.notion.so/charly-choi/35e0d17ecf4a801d8166eff8982245a9?pvs=12

목표는 Notion의 “사내 규정집” 노트에 들어 있는 약 20개 회사 규정 데이터를 Supabase Vector DB에 동기화하고, 직원이 자연어로 질문하면 관련 규정을 찾아 근거 기반으로 답변하는 카카오톡 스타일 웹 챗봇을 만드는 것입니다.

## 핵심 변경 방향

- 기존 “교육 FAQ 챗봇”에서 “사내 규정 검색 챗봇”으로 목적 변경
- 기존 FAQ 탭/교육 자료 탭 구조를 단일 사내 규정 챗봇 중심으로 단순화
- Notion 원본은 사내 규정집 노트 하나를 기준으로 동기화
- Supabase `notion_chunks` 또는 신규 `company_rule_chunks` 테이블에 규정 청크 저장
- 답변은 반드시 검색된 규정 근거 안에서만 생성
- UI는 카카오톡 대화방처럼 친숙한 채팅 화면으로 개편
- 답변 아래에 참고 규정 제목, 조항/청크, Notion 링크를 표시

## 문서 목록

- [PRD.md](./PRD.md): 제품 요구사항 정의서
- [ARCHITECTURE.md](./ARCHITECTURE.md): 전체 시스템 구조와 데이터 흐름
- [SUPABASE_SCHEMA.md](./SUPABASE_SCHEMA.md): Supabase/pgvector 스키마 초안
- [NOTION_FAQ_TEMPLATE.md](./NOTION_FAQ_TEMPLATE.md): 사내 규정집 Notion 작성/정리 가이드
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md): 전환 개발 계획
- [CODEX_PROMPTS.md](./CODEX_PROMPTS.md): VSCode + Codex 작업 프롬프트
- [TEST_PLAN.md](./TEST_PLAN.md): 기능/검색 품질/보안 테스트 계획
- [COMPANY_RULES_PROJECT_BRIEF.md](./COMPANY_RULES_PROJECT_BRIEF.md): Codex에게 먼저 읽힐 프로젝트 브리프
- [VS_CODE_CODEX_COMMANDS.md](./VS_CODE_CODEX_COMMANDS.md): VSCode 터미널과 Codex에서 쓸 명령어 모음

## MVP 범위

1. Notion 사내 규정집 노트 접근 확인
2. Notion API로 루트 페이지와 하위 페이지/블록 수집
3. 규정 문서를 500~900자 단위 청크로 분할
4. OpenAI embedding 생성
5. Supabase Vector DB에 저장
6. 사용자가 웹 챗봇에 자연어 질문 입력
7. Supabase 유사도 검색 + 키워드 보완 검색
8. 검색된 규정 근거만 사용해 AI 답변 생성
9. 답변에 참고 규정 출처 표시
10. 카카오톡 스타일 UI로 대화 표시

## 로컬 실행

```bash
cd /Users/charlychoi2026/Desktop/rag-faq-chatbot
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## Notion 동기화

`.env.local`에 다음 값이 필요합니다. 실제 키는 Git에 커밋하지 않습니다.

```bash
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NOTION_API_KEY=
NOTION_ROOT_PAGE_ID=35e0d17ecf4a801d8166eff8982245a9
```

동기화 실행:

```bash
npm run sync:notion
```

전환 작업이 끝난 뒤에는 명령어 이름을 더 명확하게 하기 위해 `npm run sync:rules`, `npm run test:rules-search` 같은 별칭을 추가합니다.

## 답변 원칙

- 규정집에 근거가 있는 내용만 답변합니다.
- 근거가 부족하면 “규정집에서 확인되지 않습니다”라고 답변합니다.
- 휴가, 근태, 비용, 보안, 승인 절차처럼 중요한 내용은 반드시 참고 규정 출처를 표시합니다.
- 법률/노무 판단이 필요한 경우 담당 부서 확인을 권장합니다.

## 현재 프로젝트 상태 메모

기존 코드에는 FAQ 챗봇과 Notion 교육 자료 챗봇 구조가 이미 있습니다. 완전히 새로 만들기보다 기존 `notion_chunks`, `sync-notion.ts`, `notionRag.ts`, `NotionChatWindow.tsx`를 사내 규정집 용도에 맞게 리팩터링하는 방식이 빠릅니다.

## 생성형 AI PoC 확장 방향

기존 사내 규정 RAG 검색 기능 위에 기본 생성형 AI 업무 기능을 PoC로 추가한다.

추가 목표:

- **규정 Q&A**: 현재 기능 유지. 검색된 규정 근거 안에서만 답변한다.
- **이메일 작성**: 규정 근거를 바탕으로 직원/관리자 대상 이메일 초안을 생성한다.
- **공지문 작성**: 규정 또는 업무 기준을 바탕으로 사내 공지문 초안을 생성한다.
- **회의록 요약**: 사용자가 붙여넣은 회의록/업무 메모를 요약하고 결정사항/할 일을 추출한다.
- **아이디어 생성**: 내부 규정/업무 맥락을 참고해 실행 가능한 아이디어를 제안한다.

상세 구현 계획은 [GENERATIVE_AI_POC_PLAN.md](./GENERATIVE_AI_POC_PLAN.md)를 먼저 읽는다.

권장 PoC 방식:

```text
기존 /api/rules-chat 또는 /api/notion-chat 요청 body에 mode 추가
mode = qa | email | notice | meeting-summary | ideation
```

기존 “규정집에 있는 내용만 근거로 답변” 원칙은 `qa` 모드에 그대로 유지하고, 이메일/공지문/아이디어 모드는 **규정상 사실은 근거 기반, 문체와 구성은 생성 허용**으로 분리한다.
