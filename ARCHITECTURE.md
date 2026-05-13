# Architecture: 사내 규정집 RAG 챗봇

## 1. 전체 구조

```text
Notion 사내 규정집
  -> Notion API 동기화
  -> 규정 문서 청킹
  -> OpenAI Embedding API
  -> Supabase Postgres + pgvector
  -> Next.js API Route
  -> OpenAI 답변 생성
  -> 카카오톡 스타일 웹 챗봇 UI
```

## 2. 구성 요소

### 2.1 Notion

역할: 회사 규정 원본 저장소

- 계정: hsikchoi@gmail.com
- 대상 페이지: 사내 규정집
- URL: https://www.notion.so/charly-choi/35e0d17ecf4a801d8166eff8982245a9?pvs=12
- 약 20개 회사 규정 데이터를 포함
- Notion integration이 이 페이지에 접근 권한을 가져야 함

### 2.2 Sync Script

역할: Notion 원본을 Supabase 검색 데이터로 변환

- `NOTION_ROOT_PAGE_ID`를 기준으로 루트/하위 페이지 수집
- 각 페이지의 title, url, block text 추출
- 본문을 청크로 분할
- embedding 생성
- Supabase에 upsert
- 삭제/축소된 페이지의 오래된 청크 정리

기존 후보 파일:

- `scripts/sync-notion.ts`
- `lib/notion.ts`

### 2.3 Supabase Vector DB

역할: 규정 청크 저장 및 유사도 검색

- 기존 `notion_chunks`를 재사용하거나 `company_rule_chunks`로 명확히 분리
- embedding은 `vector(1536)`
- 검색 함수는 `match_notion_chunks` 또는 `match_company_rule_chunks`
- MVP에서는 관리자 서버 스크립트가 service role key로 적재

### 2.4 RAG API

역할: 브라우저 질문과 검색/답변 생성을 연결

흐름:

1. 사용자 질문 수신
2. 질문 embedding 생성
3. Supabase 벡터 검색
4. 키워드 보완 검색
5. 상위 근거 청크 정렬
6. OpenAI에 근거와 질문 전달
7. 답변과 sources 반환

기존 후보 파일:

- `app/api/notion-chat/route.ts`
- `lib/notionRag.ts`
- `types/notion.ts`

전환 후 명칭 후보:

- `app/api/rules-chat/route.ts`
- `lib/companyRulesRag.ts`
- `types/companyRules.ts`

### 2.5 Web UI

역할: 사용자가 자연어로 규정을 묻는 화면

- 단일 챗봇 화면 권장
- 카카오톡 스타일 말풍선
- 모바일 우선 레이아웃
- 예시 질문 버튼
- 답변 출처 카드
- 규정집에 없는 질문 안내

기존 후보 파일:

- `app/page.tsx`
- `components/NotionChatWindow.tsx`
- `components/NotionSourceList.tsx`
- `components/TabLayout.tsx`
- `app/globals.css`
- `public/app.css`

## 3. 데이터 흐름

### 3.1 규정 동기화 흐름

1. 관리자가 Notion 사내 규정집을 최신화한다.
2. 로컬/서버에서 `npm run sync:notion` 또는 `npm run sync:rules`를 실행한다.
3. 스크립트가 Notion 페이지와 하위 블록을 읽는다.
4. 규정 제목과 본문을 청크로 나눈다.
5. 각 청크의 embedding을 생성한다.
6. Supabase에 upsert한다.
7. 검색 테스트로 대표 질문을 검증한다.

### 3.2 질문 답변 흐름

1. 사용자가 “연차 신청은 언제까지 해야 해?”라고 입력한다.
2. API가 질문 embedding을 생성한다.
3. Supabase에서 관련 규정 청크를 검색한다.
4. 키워드 검색으로 “연차”, “신청” 포함 청크를 보완한다.
5. 유사도와 키워드 점수를 합쳐 근거를 고른다.
6. AI가 선택된 근거만 사용해 답변한다.
7. UI가 말풍선 답변과 참고 규정 카드를 표시한다.

## 4. 추천 폴더 구조

```text
rag-faq-chatbot/
  app/
    page.tsx
    api/
      rules-chat/
        route.ts
  components/
    KakaoChatWindow.tsx
    RuleSourceList.tsx
    ExampleRuleQuestions.tsx
  lib/
    openai.ts
    supabaseServer.ts
    notion.ts
    companyRulesRag.ts
  scripts/
    sync-notion.ts
    test-rules-search.ts
  types/
    companyRules.ts
  docs/
    enterprise-rag-guide.md
  COMPANY_RULES_PROJECT_BRIEF.md
  VS_CODE_CODEX_COMMANDS.md
```

## 5. 환경변수

```bash
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=
OPENAI_REWRITE_MODEL=gpt-4o-mini

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

NOTION_API_KEY=
NOTION_ROOT_PAGE_ID=35e0d17ecf4a801d8166eff8982245a9
NOTION_ROOT_PAGE_URL=https://www.notion.so/charly-choi/35e0d17ecf4a801d8166eff8982245a9?pvs=12

RAG_MATCH_THRESHOLD=0.45
RAG_MATCH_COUNT=5
```

주의: API key와 service role key는 브라우저 코드에 노출하면 안 된다.

## 6. 답변 생성 프롬프트 원칙

- 당신은 사내 규정 안내 챗봇이다.
- 반드시 제공된 규정 근거 안에서만 답한다.
- 근거에 없는 내용은 추측하지 않는다.
- 질문이 모호하면 필요한 확인 사항을 짧게 묻거나 관련 규정을 안내한다.
- 휴가/근태/비용/보안/승인/징계 등 중요한 내용은 출처를 표시한다.
- 법률·노무 판단은 담당 부서 확인을 권장한다.

## 7. MVP와 심화 버전

### MVP

- Notion 규정집 수동 동기화
- Supabase Vector DB 검색
- 웹 챗봇 질문/답변
- 카카오톡 스타일 UI
- 참고 규정 출처 표시

### 심화

- 로그인/접근 제한
- 질문 로그와 인기 질문 분석
- 규정 변경 감지 자동 동기화
- 부서별 권한 필터링
- 관리자용 검색 품질 대시보드
- 실제 사내 메신저 연동

## 8. 생성형 AI PoC 확장 아키텍처

기존 RAG 흐름에 `mode` 기반 생성 계층을 추가한다.

```text
사용자 입력 + mode 선택
  -> API Route
  -> mode 설정 확인
  -> 필요한 경우 규정 RAG 검색
  -> mode별 system prompt 구성
  -> LLM 답변/문서 생성
  -> sources + generated answer 반환
```

### 8.1 mode 값

```ts
type AiMode = "qa" | "email" | "notice" | "meeting-summary" | "ideation";
```

### 8.2 추천 신규 파일

```text
lib/generationModes.ts
```

역할:

- mode별 라벨
- mode별 temperature
- mode별 retrieval 필요 여부
- mode별 system prompt
- mode별 출력 형식 가이드

### 8.3 mode별 검색 사용 여부

- `qa`: 항상 규정 검색 사용
- `email`: 규정/업무 기준 검색 사용
- `notice`: 규정/업무 기준 검색 사용
- `meeting-summary`: PoC에서는 사용자 입력만 요약, 검색은 선택 사항
- `ideation`: 관련 내부 규정 검색을 보조 근거로 사용

### 8.4 보안 원칙

- API key와 service role key는 서버에서만 사용한다.
- 생성형 기능에서도 내부 규정 원문과 출처 노출 범위를 확인한다.
- 장기적으로 온프라미스 LLM/Private LLM 교체를 위해 `lib/openai.ts` 직접 의존을 `lib/llm.ts` 계층으로 추상화할 수 있다.
