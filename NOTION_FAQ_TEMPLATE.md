# Notion FAQ Template

## 1. Notion 데이터베이스 이름

`FAQ Knowledge Base`

## 2. 필드 구성

| 필드명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| Question | Title | 필수 | 사용자가 물어볼 수 있는 질문 |
| Answer | Text | 필수 | 공식 답변 |
| Category | Select | 권장 | 수강 신청, 교육비, 일정, 준비물, 환불, 기술지원 등 |
| Source | Text | 권장 | 자료 출처 또는 담당 부서 |
| Source URL | URL | 선택 | 관련 페이지 링크 |
| Tags | Multi-select | 선택 | 검색 보조 태그 |
| Public | Checkbox | 필수 | 챗봇 공개 여부 |
| Last Reviewed | Date | 권장 | 마지막 검토일 |
| Owner | Person | 선택 | 담당자 |

## 3. 카테고리 예시

- 수강 신청
- 교육 대상
- 교육비
- 일정/장소
- 준비물
- 출석/수료
- 환불/취소
- 기술지원
- 개인정보
- 기타

## 4. 샘플 FAQ

| Question | Answer | Category | Source | Public |
| --- | --- | --- | --- | --- |
| AI 초보자도 교육에 참여할 수 있나요? | 네. 기본적인 스마트폰과 웹 브라우저 사용이 가능하면 참여할 수 있습니다. | 교육 대상 | 교육 FAQ | true |
| 교육비는 무료인가요? | 과정별로 다를 수 있습니다. 무료 과정은 모집 안내문에 무료라고 표시됩니다. | 교육비 | 모집 공고 | true |
| 수업을 빠지면 어떻게 되나요? | 결석 기준은 과정별로 다릅니다. 수료 기준이 있는 과정은 출석률을 확인해야 합니다. | 출석/수료 | 운영 안내 | true |
| 준비물이 필요한가요? | 노트북 사용 과정은 개인 노트북 지참을 권장합니다. 계정 생성이 필요한 경우 사전에 안내됩니다. | 준비물 | 교육 안내 | true |
| 신청 후 취소할 수 있나요? | 취소 가능 기간과 방법은 과정별 공지에 따릅니다. 운영 담당자에게 문의해 주세요. | 환불/취소 | 운영 안내 | true |

## 5. Notion에서 내보내기

MVP에서는 다음 방식 중 하나를 사용한다.

1. 데이터베이스 우측 상단 메뉴에서 CSV 내보내기
2. Markdown 내보내기
3. 필요한 행만 복사해 CSV로 저장

## 6. Supabase 적재용 변환 규칙

Notion 필드를 Supabase 필드로 매핑한다.

| Notion | Supabase |
| --- | --- |
| Question | question |
| Answer | answer |
| Category | category |
| Source | source |
| Source URL | source_url |
| Public | is_public |

`content`는 다음 형식으로 생성한다.

```text
질문: {Question}
답변: {Answer}
카테고리: {Category}
출처: {Source}
```

## 7. 작성 원칙

- 질문은 실제 사용자가 말할 법한 표현으로 작성한다.
- 답변은 짧고 명확하게 작성한다.
- 확실하지 않은 내용은 담당자 확인 문구를 넣는다.
- 날짜, 금액, 장소처럼 바뀔 수 있는 정보는 Last Reviewed로 관리한다.
- 챗봇에 공개하면 안 되는 내부 정보는 Public 체크를 해제한다.

