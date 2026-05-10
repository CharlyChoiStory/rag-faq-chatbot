# PRD: Notion + Supabase Vector DB 기반 RAG FAQ 챗봇 웹앱

작성일: 2026-05-09

## 1. 프로젝트 개요

본 프로젝트는 중장년/시니어 대상 AI 교육 4차시 실습용으로, Notion에 정리된 FAQ를 기반으로 질문에 답변하는 RAG 챗봇 웹앱을 개발하는 것을 목표로 한다. 수강생은 Codex의 도움을 받아 FAQ 데이터를 Supabase Vector DB에 저장하고, 사용자의 질문과 관련된 FAQ를 검색한 뒤, AI가 검색 결과를 근거로 자연어 답변을 생성하는 과정을 체험한다.

## 2. 문제 정의

일반 챗봇은 학습된 지식에 의존하기 때문에 특정 기관의 FAQ, 교육 안내, 신청 절차, 환불 규정처럼 최신성과 정확성이 중요한 정보에 약하다. 교육 현장에서는 수강생이 직접 RAG 구조를 이해하고 작은 서비스로 구현해보는 경험이 필요하다.

이 프로젝트는 다음 문제를 해결한다.

- FAQ 자료가 흩어져 있어 반복 문의 대응이 어렵다.
- AI 챗봇이 내부 자료를 참고하지 않으면 답변 신뢰도가 낮다.
- 중장년 수강생이 RAG, 벡터 DB, embedding을 추상 개념으로만 이해하기 어렵다.
- 교육 시간 안에 완성 가능한 실습형 AI 웹앱 예제가 필요하다.

## 3. 목표

- RAG의 기본 흐름을 중장년 수강생도 설명할 수 있게 한다.
- Notion FAQ를 AI 챗봇 지식자료로 활용한다.
- Supabase Postgres의 pgvector 확장을 사용해 벡터 검색을 구현한다.
- Codex를 활용해 데이터베이스 설계, 데이터 적재, API, 웹 UI를 개발한다.
- 최종 결과물로 브라우저에서 실행되는 FAQ 챗봇 웹앱을 만든다.

## 4. 비목표

- 대규모 상용 고객센터 시스템 구축
- 완전 자동화된 Notion 실시간 동기화
- 복잡한 관리자 권한 관리
- 음성 챗봇
- 다국어 지원
- 장기 대화 기억 저장
- 결제, 회원가입, CRM 연동

## 5. 대상 사용자

- AI/디지털 전환 교육을 듣는 중장년 및 시니어 수강생
- 코딩 경험이 없거나 초급 수준인 학습자
- 기관 FAQ 자동응답을 체험하려는 교육 담당자
- Notion, Supabase, Codex를 연결한 실습 예제를 원하는 강사

## 6. 핵심 사용자 시나리오

### 6.1 FAQ 관리자

1. Notion에 FAQ 데이터베이스를 만든다.
2. 질문, 답변, 카테고리, 출처, 공개 여부를 입력한다.
3. FAQ를 CSV 또는 Markdown으로 내보낸다.
4. Codex로 FAQ 데이터를 정리하고 Supabase에 업로드한다.
5. 챗봇에서 실제 질문을 테스트한다.

### 6.2 챗봇 사용자

1. 웹 챗봇에 접속한다.
2. 궁금한 내용을 자연어로 입력한다.
3. 챗봇이 관련 FAQ를 검색한다.
4. AI가 FAQ 내용을 바탕으로 답변한다.
5. 사용자는 참고된 FAQ 제목과 출처를 확인한다.

### 6.3 교육 수강생

1. RAG 구조를 그림으로 이해한다.
2. FAQ 20개 이상을 준비한다.
3. Supabase에 테이블과 검색 함수를 만든다.
4. embedding 생성과 저장 과정을 실습한다.
5. 웹 UI와 API를 연결해 최종 챗봇을 완성한다.

## 7. 주요 기능

### 7.1 FAQ 데이터 관리

- Notion FAQ 데이터베이스 사용
- 필수 필드: 질문, 답변, 카테고리, 출처, 공개 여부
- 선택 필드: 태그, 작성자, 마지막 수정일, 우선순위
- CSV 또는 Markdown 내보내기 지원
- Codex를 통한 JSON 변환 스크립트 작성

### 7.2 Supabase Vector DB 저장

- Supabase 무료 플랜 사용 가능 범위에서 MVP 구성
- Postgres pgvector 확장 활성화
- FAQ 테이블 생성
- embedding 벡터 컬럼 저장
- 유사도 검색 SQL 함수 생성
- 공개 챗봇 조회용 RLS 정책 적용

### 7.3 Embedding 생성

- FAQ 질문과 답변을 합친 `content` 텍스트를 embedding으로 변환
- 추천 입력 형식:

```text
질문: {question}
답변: {answer}
카테고리: {category}
```

- MVP에서는 OpenAI embedding API 사용
- embedding 모델 변경 가능성을 고려해 차원 수를 명시적으로 관리

### 7.4 RAG 검색

- 사용자 질문을 embedding으로 변환
- Supabase에서 상위 3~5개 FAQ 검색
- 유사도 기준 이하인 경우 답변 제한
- 검색 결과를 AI 답변 생성 컨텍스트로 전달
- 답변에는 참고 FAQ 목록 표시

### 7.5 챗봇 웹 UI

- 질문 입력창
- 답변 표시 영역
- 참고 FAQ 표시
- 로딩 상태
- 오류 상태
- 예시 질문 버튼
- 모바일에서도 읽기 쉬운 레이아웃

### 7.6 운영/교육 보조 기능

- 샘플 FAQ 데이터 제공
- Supabase 연결 상태 확인
- embedding 저장 개수 확인
- 테스트 질문 목록 제공
- 강사용 체크리스트 제공

## 8. 화면 요구사항

### 8.1 메인 챗봇 화면

- 상단: 서비스명과 간단한 안내
- 중앙: 대화 내역
- 하단: 질문 입력창과 전송 버튼
- 답변 하단: 참고 FAQ 1~3개 표시

### 8.2 관리자/강사용 확인 화면

MVP에서는 별도 관리자 화면을 만들지 않는다. 대신 Supabase 대시보드와 Notion을 관리 도구로 사용한다.

## 9. 기술 요구사항

- Frontend: Next.js 또는 React
- Backend: Next.js API Route 또는 Supabase Edge Function
- Database: Supabase Postgres
- Vector Search: pgvector
- Document Source: Notion, CSV, Markdown
- Embedding: OpenAI Embedding API
- Answer Generation: OpenAI Chat Completions 또는 Responses API
- Deployment: Vercel

## 10. 보안 요구사항

- OpenAI API Key는 서버 환경변수에만 저장한다.
- Supabase service role key는 브라우저에 노출하지 않는다.
- 공개 클라이언트에는 publishable/anon key만 사용한다.
- FAQ 테이블은 RLS를 활성화한다.
- 공개 챗봇은 `is_public = true` 데이터만 검색한다.
- 관리자 업로드 기능은 MVP에서 제외하거나 서버 전용으로 제한한다.

## 11. 성공 기준

- FAQ 20개 이상을 Supabase에 저장한다.
- 사용자 질문에 대해 관련 FAQ를 3개 이상 검색할 수 있다.
- 챗봇 답변이 검색된 FAQ 내용을 벗어나지 않는다.
- 관련 FAQ가 부족하면 모른다고 답한다.
- 답변에 참고 FAQ 출처가 표시된다.
- 수강생이 RAG 흐름을 말로 설명할 수 있다.
- 4차시 안에 MVP를 실행할 수 있다.

## 12. 주요 리스크와 대응

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| Notion API 직접 연동이 어렵다 | 교육 시간 초과 | MVP는 CSV/Markdown 내보내기 사용 |
| API Key 노출 | 보안 사고 | 서버 환경변수 사용, service role 브라우저 노출 금지 |
| embedding 차원 불일치 | 저장/검색 오류 | 모델과 vector 차원을 문서에 고정 |
| 검색 결과 품질 부족 | 답변 신뢰도 저하 | FAQ 문장 정리, 카테고리, threshold 조정 |
| 무료 플랜 제한 | 운영 중단 | 교육용 소량 데이터로 제한, 비활성화 주의 |

## 13. MVP 완료 정의

- `faqs` 테이블과 `match_faqs` 검색 함수가 생성되어 있다.
- FAQ 샘플 데이터가 embedding과 함께 저장되어 있다.
- 사용자가 웹에서 질문을 입력할 수 있다.
- API가 질문 embedding을 만들고 Supabase에서 FAQ를 검색한다.
- AI가 검색된 FAQ만 근거로 답변한다.
- 참고 FAQ가 화면에 표시된다.

