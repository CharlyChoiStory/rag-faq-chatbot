# Notion 사내 규정집 작성/정리 가이드

이 문서는 기존 FAQ 템플릿을 사내 규정집 RAG 챗봇용으로 바꾼 가이드입니다.

## 1. 대상 Notion 페이지

- 계정: hsikchoi@gmail.com
- 페이지명: 사내 규정집
- URL: https://www.notion.so/charly-choi/35e0d17ecf4a801d8166eff8982245a9?pvs=12
- Page ID: `35e0d17ecf4a801d8166eff8982245a9`

## 2. 권장 문서 구조

각 규정은 가능하면 하위 페이지 또는 명확한 제목 블록으로 나눈다.

예시:

```text
사내 규정집
  - 근태 관리 규정
  - 연차/휴가 규정
  - 출장 및 비용 정산 규정
  - 재택근무 규정
  - 정보보안 규정
  - 개인정보 처리 규정
  - 복리후생 규정
  - 결재/승인 규정
```

## 3. 규정별 권장 필드/표현

규정이 데이터베이스 형태라면 다음 필드를 권장한다.

| 필드명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| Rule Title | Title | 필수 | 규정명 |
| Category | Select | 권장 | 근태, 휴가, 비용, 보안, 복리후생 등 |
| Summary | Text | 권장 | 규정 요약 |
| Content | Text/Page Body | 필수 | 실제 규정 내용 |
| Owner | Person/Text | 선택 | 담당 부서/담당자 |
| Last Reviewed | Date | 권장 | 마지막 검토일 |
| Effective Date | Date | 선택 | 시행일 |
| Tags | Multi-select | 선택 | 검색 보조 키워드 |
| Internal Only | Checkbox | 권장 | 내부 전용 여부 |

페이지 본문 형태라면 각 규정 제목과 조항 번호를 명확히 적는 것이 중요하다.

## 4. 검색 품질을 높이는 작성 원칙

- 규정명은 짧고 명확하게 작성한다.
- 직원이 실제로 물어볼 표현을 규정 본문에 포함한다.
  - 예: “연차”, “휴가 신청”, “휴가 승인”, “반차”, “병가”
- 날짜, 금액, 승인권자, 제출 기한은 문장으로 분명히 적는다.
- “위와 같다”, “별도 기준에 따른다”처럼 문맥 의존 표현은 줄인다.
- 조항 번호가 있다면 유지한다.
- 담당 부서 확인이 필요한 내용은 담당 부서를 적는다.

## 5. 청크 변환 규칙

Notion 본문은 Supabase 저장 전에 다음 형식으로 정리한다.

```text
[사내 규정집]
규정명: {Rule Title 또는 Page Title}
카테고리: {Category}
내용:
{본문 또는 조항 내용}
출처: {Notion URL}
```

## 6. 예시 질문

- 연차는 며칠 전까지 신청해야 해?
- 반차도 사용할 수 있어?
- 출장비는 언제까지 정산해야 해?
- 재택근무 신청 절차가 어떻게 돼?
- 회사 노트북 분실하면 어떻게 해야 해?
- 개인정보 자료는 어떻게 보관해야 해?
- 복리후생비 사용 기준 알려줘.
- 결재는 누구 승인까지 받아야 해?

## 7. Notion API 연결 체크

1. Notion integration 생성
2. integration secret을 `.env.local`의 `NOTION_API_KEY`에 저장
3. 사내 규정집 페이지에서 integration을 초대
4. `.env.local`에 `NOTION_ROOT_PAGE_ID=35e0d17ecf4a801d8166eff8982245a9` 설정
5. `npm run sync:notion` 실행

## 8. 주의사항

- 실제 내부 규정이므로 GitHub 공개 저장소에 원문을 커밋하지 않는다.
- `.env.local`에 들어 있는 Notion/OpenAI/Supabase 키를 문서에 붙여넣지 않는다.
- 배포 전에는 반드시 접근 제한을 검토한다.
