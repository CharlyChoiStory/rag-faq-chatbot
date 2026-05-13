# VSCode + Codex 명령어 모음

프로젝트 경로:

```bash
cd /Users/charlychoi2026/Desktop/rag-faq-chatbot
```

## 1. 기본 실행

```bash
npm install
npm run dev
```

브라우저:

```text
http://localhost:3000
```

## 2. 환경변수 준비

```bash
cp .env.example .env.local
```

`.env.local`에 실제 값을 넣는다. 키 값은 Codex 채팅창이나 문서에 붙여넣지 않는다.

필수:

```bash
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NOTION_API_KEY=
NOTION_ROOT_PAGE_ID=35e0d17ecf4a801d8166eff8982245a9
```

## 3. Notion 사내 규정집 동기화

현재 기존 명령:

```bash
npm run sync:notion
```

추가 예정 별칭:

```bash
npm run sync:rules
```

## 4. 개발 검증

```bash
npm run lint
npm run build
```

추가 예정 통합 검증:

```bash
npm run check:rules
```

## 5. 검색 테스트

추가 예정:

```bash
npm run test:rules-search
```

대표 질문:

```text
연차는 며칠 전까지 신청해야 해?
출장비는 언제까지 정산해야 해?
재택근무 신청 절차 알려줘.
개인정보 자료는 어떻게 보관해야 해?
```

## 6. Git 상태 확인

```bash
git status --short --branch
git ls-files .env .env.local .env.example
```

정상 기대:

- `.env.local`은 추적되지 않아야 한다.
- `.env.example`만 추적 가능하다.

## 7. Codex에게 바로 줄 수 있는 한 번에 작업 지시

```text
/Users/charlychoi2026/Desktop/rag-faq-chatbot 프로젝트를 사내 규정집 RAG AI 챗봇으로 전환해줘.
먼저 COMPANY_RULES_PROJECT_BRIEF.md, PRD.md, ARCHITECTURE.md, IMPLEMENTATION_PLAN.md, CODEX_PROMPTS.md를 읽어.
목표는 hsikchoi@gmail.com Notion의 사내 규정집 페이지(35e0d17ecf4a801d8166eff8982245a9)를 대상으로 자연어 규정 검색 챗봇을 만드는 거야.
UI는 카카오톡 스타일로 바꿔줘.
.env.local 값은 절대 출력하지 말고, 먼저 수정 계획을 제안한 뒤 진행해줘.
```

## 8. Codex 작업 후 확인 요청

```text
수정이 끝났으면 다음을 실행하고 결과를 요약해줘.
- npm run lint
- npm run build
- git status --short
그리고 변경 파일 목록, 주요 변경 내용, 남은 리스크를 한국어로 정리해줘.
```

## 9. 주의

- `sync:notion`, `sync:rules`, `test:rules-search`는 OpenAI/Supabase/Notion API를 실제 호출할 수 있다.
- 내부 규정 원문과 secret key는 공개 저장소에 올리지 않는다.
- 배포 전에는 인증/접근 제한을 검토한다.

## 10. 생성형 AI PoC 바로 시작 명령/프롬프트

VSCode에서 프로젝트 열기:

```bash
cd /Users/charlychoi2026/Desktop/rag-faq-chatbot
code .
```

Codex에게 바로 줄 프롬프트:

```text
이 프로젝트에 생성형 AI PoC 기능을 추가해줘.
먼저 GENERATIVE_AI_POC_PLAN.md, COMPANY_RULES_PROJECT_BRIEF.md, ARCHITECTURE.md, IMPLEMENTATION_PLAN.md, TEST_PLAN.md를 읽어.

기존 사내 규정 Q&A는 유지하고, 다음 작업 유형을 추가해줘:
- qa: 규정 질문
- email: 규정 기반 이메일 작성
- notice: 규정 기반 공지문 작성
- meeting-summary: 회의록/업무 메모 요약
- ideation: 사내 업무 개선 아이디어 생성

빠른 PoC 방식으로 기존 API request body에 mode를 추가하고, mode별 프롬프트와 temperature를 분리해줘.
UI에는 작업 유형 선택 버튼과 mode별 예시 질문/placeholder를 추가해줘.
.env.local 값은 절대 출력하지 말고, 작업 후 npm run lint와 npm run build를 실행해줘.
```

검증 명령:

```bash
npm run lint
npm run build
git status --short --branch
```
