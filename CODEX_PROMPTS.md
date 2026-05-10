# Codex Prompts

## 1. 프로젝트 생성

```text
Next.js로 RAG FAQ 챗봇 웹앱을 만들어줘.
기술 구성은 Next.js, TypeScript, Supabase, OpenAI API야.
우선 프로젝트 구조, .env.example, 기본 README를 생성해줘.
```

## 2. Supabase SQL 생성

```text
Supabase Postgres에서 FAQ RAG 챗봇용 테이블과 pgvector 검색 함수를 만들어줘.
조건:
- faqs 테이블
- question, answer, category, source, source_url, content, embedding, is_public
- embedding은 text-embedding-3-small 기준 vector(1536)
- match_faqs 함수
- RLS 활성화
- 공개 FAQ만 anon이 읽을 수 있게 정책 작성
SQL 파일로 만들어줘.
```

## 3. Notion CSV 적재 스크립트

```text
Notion에서 export한 FAQ CSV를 읽어서 Supabase faqs 테이블에 저장하는 TypeScript 스크립트를 만들어줘.
조건:
- Question, Answer, Category, Source, Source URL, Public 컬럼을 읽기
- content 필드 생성
- OpenAI embedding 생성
- Supabase service role key로 upsert
- 누락 필드 검증
- 실행 결과로 성공/실패 개수 출력
```

## 4. RAG API 구현

```text
Next.js API Route로 /api/chat을 구현해줘.
흐름:
1. 사용자 question을 받는다.
2. OpenAI embedding을 생성한다.
3. Supabase match_faqs 함수를 호출한다.
4. 검색된 FAQ가 없으면 근거 부족 메시지를 반환한다.
5. 검색된 FAQ를 근거로 AI 답변을 생성한다.
6. answer와 sources 배열을 JSON으로 반환한다.

주의:
- OpenAI API Key와 Supabase service key는 서버에서만 사용
- 답변은 검색된 FAQ 내용을 벗어나지 않게 프롬프트 작성
```

## 5. 챗봇 UI 구현

```text
중장년 사용자가 쓰기 쉬운 FAQ 챗봇 UI를 만들어줘.
요구사항:
- 큰 글자와 명확한 입력창
- 예시 질문 버튼 4개
- 답변 로딩 상태
- 답변 아래 참고 FAQ 목록 표시
- 모바일 화면 대응
- 과도한 장식 없이 실용적인 화면
```

## 6. 테스트 요청

```text
RAG FAQ 챗봇을 테스트해줘.
확인할 것:
- 정상 질문 답변
- FAQ에 없는 질문 처리
- sources 표시
- API Key가 브라우저에 노출되지 않는지
- Supabase RLS 정책이 적용됐는지
- 모바일 화면에서 UI가 깨지지 않는지
문제가 있으면 수정까지 해줘.
```

## 7. 수강생용 설명 생성

```text
이 프로젝트를 중장년 수강생에게 설명할 수 있게 쉬운 말로 정리해줘.
RAG, embedding, vector DB, Supabase, Notion의 역할을 비유 중심으로 설명하고,
4차시 실습 순서도 함께 정리해줘.
```

