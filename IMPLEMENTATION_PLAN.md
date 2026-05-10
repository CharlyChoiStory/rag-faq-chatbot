# Implementation Plan

## 1. 개발 단계

### Phase 1. 프로젝트 준비

- Next.js 프로젝트 생성
- 환경변수 구조 작성
- Supabase 프로젝트 생성
- OpenAI API Key 준비
- 샘플 FAQ 데이터 작성

완료 기준:

- 로컬 개발 서버 실행
- `.env.example` 작성
- Supabase 접속 정보 준비

### Phase 2. Supabase Vector DB 구성

- pgvector 확장 활성화
- `faqs` 테이블 생성
- `match_faqs` 함수 생성
- RLS 정책 추가
- 샘플 데이터 수동 입력 테스트

완료 기준:

- SQL Editor에서 검색 함수가 동작한다.
- 공개 FAQ만 조회된다.

### Phase 3. FAQ 적재 스크립트 개발

- Notion CSV 읽기
- 필수 컬럼 검증
- content 생성
- embedding 생성
- Supabase upsert
- 적재 결과 로그 출력

완료 기준:

- FAQ 20개 이상이 embedding과 함께 저장된다.
- 누락 필드가 있으면 친절한 오류를 보여준다.

### Phase 4. RAG API 개발

- `/api/chat` 엔드포인트 생성
- 사용자 질문 validation
- 질문 embedding 생성
- `match_faqs` 호출
- 검색 결과 기반 AI 답변 생성
- 답변과 sources 반환

완료 기준:

- API 테스트에서 질문에 대한 답변과 출처가 반환된다.

### Phase 5. 챗봇 UI 개발

- 대화 화면
- 질문 입력창
- 예시 질문 버튼
- 답변 로딩 상태
- 참고 FAQ 목록
- 오류 메시지

완료 기준:

- 브라우저에서 질문/답변이 정상 동작한다.
- 모바일 화면에서도 사용 가능하다.

### Phase 6. 교육용 마감

- README 작성
- 강사용 실행 절차 정리
- 수강생용 실습 순서 정리
- 테스트 질문 정리
- 배포 또는 로컬 실행 확인

완료 기준:

- 처음 보는 사람이 README만 보고 실행할 수 있다.

## 2. 4차시 교육 운영안

### 1차시: RAG와 FAQ 데이터 이해

- RAG 개념 설명
- 일반 챗봇과 RAG 챗봇 비교
- Notion FAQ 템플릿 만들기
- FAQ 10~20개 작성

산출물:

- Notion FAQ 데이터베이스
- 샘플 FAQ CSV

### 2차시: Supabase Vector DB 만들기

- Supabase 프로젝트 생성
- pgvector 활성화
- `faqs` 테이블 생성
- embedding 개념 설명
- SQL 검색 함수 생성

산출물:

- Supabase FAQ 테이블
- 검색 함수

### 3차시: FAQ 적재와 검색

- Codex로 import 스크립트 작성
- FAQ content 생성
- embedding 저장
- 유사도 검색 테스트
- threshold 조정

산출물:

- FAQ import 스크립트
- 검색 테스트 결과

### 4차시: 웹 챗봇 완성

- 챗봇 UI 구현
- `/api/chat` 연결
- 답변 출처 표시
- 오류 처리
- 최종 시연

산출물:

- 실행 가능한 RAG FAQ 챗봇 웹앱

## 3. 작업 분해

| 작업 | 난이도 | 담당 | 예상 시간 |
| --- | --- | --- | --- |
| Notion FAQ 템플릿 작성 | 낮음 | 강사/수강생 | 30분 |
| Supabase 프로젝트 생성 | 낮음 | 수강생 | 20분 |
| SQL 스키마 적용 | 중간 | Codex/수강생 | 30분 |
| FAQ CSV 정리 | 낮음 | 수강생 | 30분 |
| embedding 적재 스크립트 | 중간 | Codex | 60분 |
| RAG API 구현 | 중간 | Codex | 60분 |
| 챗봇 UI 구현 | 중간 | Codex | 60분 |
| 테스트 및 개선 | 낮음 | 전체 | 40분 |

## 4. 의사결정

- MVP에서는 Notion API 자동 연동을 제외한다.
- FAQ 원본은 Notion, 검색 저장소는 Supabase로 역할을 나눈다.
- AI 답변은 반드시 검색된 FAQ를 근거로 제한한다.
- Supabase service role key는 서버 스크립트에서만 사용한다.

