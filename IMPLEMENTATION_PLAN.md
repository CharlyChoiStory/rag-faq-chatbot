# Implementation Plan: 사내 규정집 RAG 챗봇 전환

## 1. 개발 단계

### Phase 1. 프로젝트 목적 전환

작업:

- README/PRD/Architecture를 사내 규정집 챗봇 기준으로 업데이트
- 기존 교육 FAQ 문구 제거 또는 보조 문서로 이동
- 앱 제목과 안내 문구를 “사내 규정 AI 챗봇”으로 변경

완료 기준:

- 문서와 화면에서 프로젝트 목적이 일관되게 보인다.

### Phase 2. Notion 규정집 동기화 확인

작업:

- `.env.local`에 `NOTION_ROOT_PAGE_ID=35e0d17ecf4a801d8166eff8982245a9` 설정
- Notion integration이 사내 규정집 페이지에 초대되었는지 확인
- `npm run sync:notion` 실행
- Supabase `notion_chunks`에 규정 청크가 저장되는지 확인

완료 기준:

- 약 20개 규정 데이터가 청크로 저장된다.
- 각 청크에 규정 제목과 Notion URL이 포함된다.

### Phase 3. RAG 검색 로직 전환

작업:

- `lib/notionRag.ts`의 시스템 프롬프트를 사내 규정 안내 챗봇으로 수정
- fallback 문구를 규정집 기준으로 수정
- 쿼리 확장 프롬프트를 회사 규정 검색에 맞게 수정
- threshold 기본값을 0.45 전후로 테스트
- 필요하면 `lib/companyRulesRag.ts`로 파일명 분리

완료 기준:

- 대표 규정 질문에 관련 청크가 검색된다.
- 근거 없는 질문에는 추측하지 않는다.

### Phase 4. API 명칭 정리

작업:

- 빠른 MVP: 기존 `/api/notion-chat` 유지 후 내부 문구만 변경
- 명확한 구조: `/api/rules-chat` 추가 후 UI를 새 API에 연결
- response의 `sources` 명칭은 유지 가능

완료 기준:

- 브라우저에서 규정 질문에 답변한다.
- API 응답에 answer와 sources가 포함된다.

### Phase 5. 카카오톡 스타일 UI 개편

작업:

- 기존 탭 UI 제거 또는 숨김
- 단일 채팅방 화면 구성
- 사용자 말풍선 오른쪽 정렬
- AI 말풍선 왼쪽 정렬
- 노란색/회색 계열 카카오톡 느낌 적용
- 하단 고정 입력창 구현
- 예시 질문 버튼을 사내 규정 질문으로 변경
- 출처 카드를 답변 아래 표시

완료 기준:

- PC와 모바일에서 카카오톡 대화방처럼 보인다.
- 입력/응답/로딩/오류 상태가 자연스럽다.

### Phase 6. 검색 품질 테스트 및 튜닝

작업:

- 대표 질문 10~20개 작성
- 검색 결과의 source와 similarity 확인
- 청크 크기, threshold, keyword fallback 튜닝
- Notion 원문에서 검색 키워드 보강

완료 기준:

- 대표 질문 80% 이상에서 올바른 규정 근거가 반환된다.

### Phase 7. 마감 검증

작업:

- `npm run lint`
- `npm run build`
- `.env.local` Git 추적 여부 확인
- 브라우저 수동 테스트
- 문서 최신화

완료 기준:

- 빌드 통과
- 키 노출 없음
- 시연 가능

## 2. 작업 분해

| 작업 | 난이도 | 담당 | 예상 시간 |
| --- | --- | --- | --- |
| 문서 목적 전환 | 낮음 | 헤르미/Codex | 30분 |
| Notion page id/env 확인 | 낮음 | 찰리/Codex | 20분 |
| 동기화 스크립트 점검 | 중간 | Codex | 40분 |
| RAG 프롬프트 전환 | 낮음 | Codex | 30분 |
| API 명칭 정리 | 낮음 | Codex | 30분 |
| 카카오톡 UI 구현 | 중간 | Codex | 90분 |
| 검색 품질 테스트 | 중간 | 찰리/Codex | 60분 |
| 빌드/보안 검증 | 낮음 | Codex | 30분 |

## 3. Codex 작업 순서 추천

1. `COMPANY_RULES_PROJECT_BRIEF.md`와 `PRD.md`를 먼저 읽는다.
2. 기존 코드에서 Notion RAG 경로를 확인한다.
3. 문구/프롬프트를 사내 규정집 기준으로 바꾼다.
4. UI를 단일 카카오톡 스타일 채팅방으로 바꾼다.
5. 동기화 및 검색 테스트 스크립트를 추가한다.
6. lint/build를 실행하고 수정한다.

## 4. 의사결정

- MVP에서는 기존 `notion_chunks` 테이블을 재사용한다.
- 별도 DB 분리가 필요해지면 `company_rule_chunks`로 마이그레이션한다.
- 앱은 공개 FAQ가 아니라 내부 규정 검색용이므로 배포 전 접근 제한을 검토한다.
- 답변은 반드시 규정집 근거 안으로 제한한다.
