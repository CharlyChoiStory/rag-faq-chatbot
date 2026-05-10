# Architecture: RAG FAQ Chatbot

## 1. 전체 구조

```text
Notion FAQ
  -> CSV/Markdown Export
  -> Codex Data Cleanup Script
  -> Embedding API
  -> Supabase Postgres + pgvector
  -> Web App API
  -> AI Answer Generation
  -> Chatbot UI
```

## 2. 구성 요소

### 2.1 Notion

역할: FAQ 원본 관리

- 강사 또는 관리자가 FAQ를 작성한다.
- 수강생이 이해하기 쉬운 표 형태로 관리한다.
- MVP에서는 CSV 또는 Markdown으로 내보낸다.
- 심화 버전에서 Notion API 자동 동기화를 추가할 수 있다.

### 2.2 Data Import Script

역할: Notion에서 내보낸 데이터를 Supabase 적재용으로 정리

- CSV/Markdown 읽기
- 필수 필드 검증
- 질문과 답변을 합쳐 `content` 생성
- embedding 생성
- Supabase에 upsert

### 2.3 Supabase Vector DB

역할: FAQ 저장 및 유사도 검색

- Postgres 테이블에 FAQ 원문 저장
- pgvector 컬럼에 embedding 저장
- SQL 함수로 유사 FAQ 검색
- RLS로 공개 데이터만 노출

### 2.4 Web App API

역할: 브라우저와 Supabase/OpenAI 사이의 서버 중개

- 사용자 질문 수신
- 질문 embedding 생성
- Supabase 검색 함수 호출
- 검색 결과를 프롬프트에 삽입
- AI 답변 생성
- 답변과 출처 반환

### 2.5 Chatbot UI

역할: 사용자가 질문하고 답변을 확인하는 화면

- 대화형 질문 입력
- AI 답변 출력
- 참고 FAQ 출력
- 오류와 로딩 상태 표시

## 3. 데이터 흐름

### 3.1 FAQ 적재 흐름

1. 관리자가 Notion FAQ를 작성한다.
2. CSV 또는 Markdown으로 내보낸다.
3. Codex가 import 스크립트를 실행한다.
4. 각 FAQ의 `content`를 생성한다.
5. embedding API로 벡터를 만든다.
6. Supabase `faqs` 테이블에 저장한다.

### 3.2 질문 답변 흐름

1. 사용자가 챗봇에 질문을 입력한다.
2. 서버 API가 질문 embedding을 생성한다.
3. Supabase `match_faqs` 함수로 유사 FAQ를 찾는다.
4. 상위 FAQ들을 AI 프롬프트의 근거 자료로 넣는다.
5. AI가 근거 자료 안에서 답변을 생성한다.
6. 웹 UI가 답변과 참고 FAQ를 표시한다.

## 4. 추천 폴더 구조

```text
rag-faq-chatbot/
  app/
    page.tsx
    api/
      chat/
        route.ts
  components/
    ChatWindow.tsx
    SourceList.tsx
  lib/
    openai.ts
    supabaseServer.ts
    rag.ts
  scripts/
    import-faqs.ts
  supabase/
    migrations/
      001_init_faqs.sql
  data/
    sample-faqs.csv
  .env.example
  README.md
```

## 5. 환경변수

```bash
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

주의: `SUPABASE_SERVICE_ROLE_KEY`는 절대 브라우저 코드에 노출하면 안 된다.

## 6. 답변 생성 프롬프트 원칙

- 검색된 FAQ만 근거로 답한다.
- 근거가 부족하면 모른다고 말한다.
- 중장년 사용자가 이해하기 쉬운 문장으로 답한다.
- 신청, 비용, 일정, 환불 등 중요한 정보는 출처를 함께 표시한다.

## 7. MVP와 심화 버전

### MVP

- Notion CSV/Markdown 수동 내보내기
- 스크립트로 Supabase 적재
- 웹 챗봇 질문/답변
- 참고 FAQ 표시

### 심화

- Notion API 자동 동기화
- 관리자 업로드 화면
- 대화 로그 저장
- 답변 만족도 평가
- 카테고리 필터링
- 사용자 인증

