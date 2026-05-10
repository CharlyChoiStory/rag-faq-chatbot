# Notion + Supabase Vector DB RAG FAQ Chatbot

작성일: 2026-05-09

이 폴더는 중장년/시니어 대상 AI 교육 4차시에서 사용할 수 있는 FAQ RAG 챗봇 웹앱 개발 문서 세트입니다.

목표는 Notion에 정리한 FAQ를 Supabase Vector DB에 저장하고, 사용자의 질문과 가장 비슷한 FAQ를 검색해 AI가 근거 기반 답변을 생성하는 웹 챗봇을 만드는 것입니다.

## 문서 목록

- [PRD.md](./PRD.md): 제품 요구사항 정의서
- [ARCHITECTURE.md](./ARCHITECTURE.md): 전체 시스템 구조와 데이터 흐름
- [SUPABASE_SCHEMA.md](./SUPABASE_SCHEMA.md): pgvector 테이블, SQL 함수, 보안 정책 초안
- [NOTION_FAQ_TEMPLATE.md](./NOTION_FAQ_TEMPLATE.md): Notion FAQ 데이터베이스 필드와 샘플 데이터
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md): 개발 단계, 작업 분해, 4차시 교육 운영안
- [CODEX_PROMPTS.md](./CODEX_PROMPTS.md): Codex로 구현을 진행할 때 사용할 프롬프트 모음
- [TEST_PLAN.md](./TEST_PLAN.md): 기능 테스트, RAG 품질 테스트, 교육 운영 체크리스트

## 권장 MVP 범위

1. Notion에서 FAQ 원본 작성
2. FAQ를 CSV 또는 Markdown으로 내보내기
3. Codex가 FAQ 데이터를 Supabase 입력 형식으로 변환
4. OpenAI embedding API로 벡터 생성
5. Supabase Postgres + pgvector에 저장
6. 웹 챗봇에서 질문 입력
7. Supabase 유사도 검색
8. 검색된 FAQ를 근거로 AI 답변 생성
9. 답변에 참고 FAQ 출처 표시

## 교육 난이도 기준 추천

초급 중장년 교육에서는 처음부터 Notion API 자동 연동을 넣기보다, Notion을 FAQ 작성 도구로 사용하고 CSV/Markdown 내보내기를 통해 Supabase에 적재하는 흐름이 안전합니다. Notion API 직접 연동은 심화 과정 또는 강사용 확장 기능으로 분리하는 편이 좋습니다.

## 로컬 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

`.env.local`에는 실제 OpenAI API Key와 Supabase 값을 넣어야 합니다. 실제 키는 코드나 문서에 커밋하지 않습니다.
