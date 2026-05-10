from __future__ import annotations

import html
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


OUT = Path("RAG_FAQ_챗봇_바이브코딩_초보자_매뉴얼.docx")


def esc(text: str) -> str:
    return html.escape(text, quote=False)


def run(text: str, bold: bool = False, color: str | None = None) -> str:
    props = []
    if bold:
        props.append("<w:b/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    props.append('<w:rFonts w:ascii="Malgun Gothic" w:eastAsia="Malgun Gothic" w:hAnsi="Malgun Gothic"/>')
    props_xml = f"<w:rPr>{''.join(props)}</w:rPr>"
    return f"<w:r>{props_xml}<w:t xml:space=\"preserve\">{esc(text)}</w:t></w:r>"


def p(text: str = "", style: str = "Normal", keep_next: bool = False) -> str:
    keep = "<w:keepNext/>" if keep_next else ""
    return (
        f"<w:p><w:pPr><w:pStyle w:val=\"{style}\"/>{keep}</w:pPr>"
        f"{run(text)}</w:p>"
    )


def mixed_p(parts: list[tuple[str, bool]], style: str = "Normal") -> str:
    return (
        f"<w:p><w:pPr><w:pStyle w:val=\"{style}\"/></w:pPr>"
        + "".join(run(text, bold=bold) for text, bold in parts)
        + "</w:p>"
    )


def heading(text: str, level: int) -> str:
    return p(text, f"Heading{level}", keep_next=True)


def bullet(text: str) -> str:
    return (
        '<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>'
        '<w:ind w:left="360" w:hanging="220"/></w:pPr>'
        f"{run('• ' + text)}</w:p>"
    )


def number(text: str, index: int) -> str:
    return (
        '<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>'
        '<w:ind w:left="360" w:hanging="220"/></w:pPr>'
        f"{run(str(index) + '. ' + text)}</w:p>"
    )


def code(text: str) -> str:
    lines = text.split("\n")
    body = []
    for line in lines:
        body.append(
            '<w:p><w:pPr><w:pStyle w:val="CodeBlock"/></w:pPr>'
            f'<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="Malgun Gothic"/>'
            '<w:sz w:val="19"/><w:color w:val="1F2937"/></w:rPr>'
            f'<w:t xml:space="preserve">{esc(line)}</w:t></w:r></w:p>'
        )
    return "".join(body)


def callout(title: str, text: str) -> str:
    return (
        '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/>'
        '<w:tblInd w:w="120" w:type="dxa"/>'
        '<w:tblBorders><w:top w:val="single" w:sz="8" w:color="B7D7CF"/>'
        '<w:left w:val="single" w:sz="8" w:color="B7D7CF"/>'
        '<w:bottom w:val="single" w:sz="8" w:color="B7D7CF"/>'
        '<w:right w:val="single" w:sz="8" w:color="B7D7CF"/></w:tblBorders>'
        '<w:tblCellMar><w:top w:w="140" w:type="dxa"/><w:left w:w="180" w:type="dxa"/>'
        '<w:bottom w:w="140" w:type="dxa"/><w:right w:w="180" w:type="dxa"/></w:tblCellMar>'
        '</w:tblPr><w:tblGrid><w:gridCol w:w="9360"/></w:tblGrid><w:tr><w:tc>'
        '<w:tcPr><w:tcW w:w="9360" w:type="dxa"/><w:shd w:fill="EEF8F5"/></w:tcPr>'
        f'{mixed_p([(title, True)], "CalloutTitle")}{p(text, "CalloutText")}'
        '</w:tc></w:tr></w:tbl>'
    )


def table(headers: list[str], rows: list[list[str]], widths: list[int]) -> str:
    def cell(text: str, width: int, header: bool = False) -> str:
        fill = '<w:shd w:fill="E8EEF5"/>' if header else ""
        style = "TableHeader" if header else "TableText"
        return (
            f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>{fill}</w:tcPr>'
            f"{p(text, style)}</w:tc>"
        )

    xml = [
        '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/>'
        '<w:tblInd w:w="120" w:type="dxa"/>'
        '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D0D7DE"/>'
        '<w:left w:val="single" w:sz="4" w:color="D0D7DE"/>'
        '<w:bottom w:val="single" w:sz="4" w:color="D0D7DE"/>'
        '<w:right w:val="single" w:sz="4" w:color="D0D7DE"/>'
        '<w:insideH w:val="single" w:sz="4" w:color="D0D7DE"/>'
        '<w:insideV w:val="single" w:sz="4" w:color="D0D7DE"/></w:tblBorders>'
        '<w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/>'
        '<w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar>'
        '</w:tblPr><w:tblGrid>'
        + "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
        + "</w:tblGrid>"
    ]
    xml.append("<w:tr><w:trPr><w:tblHeader/></w:trPr>" + "".join(cell(h, w, True) for h, w in zip(headers, widths)) + "</w:tr>")
    for row in rows:
        xml.append("<w:tr>" + "".join(cell(c, w) for c, w in zip(row, widths)) + "</w:tr>")
    xml.append("</w:tbl>")
    return "".join(xml)


def page_break() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def document_body() -> str:
    parts: list[str] = []
    parts.append(p("Notion FAQ + Supabase pgvector + OpenAI embedding", "Subtitle"))
    parts.append(p("RAG FAQ 챗봇 만들기: 바이브코딩 초보자 매뉴얼", "Title"))
    parts.append(p("대상: AI 웹앱을 처음 만들어보는 중장년/시니어 학습자"))
    parts.append(p("목표: 문서를 보며 따라 하면 FAQ 챗봇의 전체 흐름을 이해하고, 로컬에서 실행·테스트할 수 있습니다."))
    parts.append(callout("한 줄 요약", "Notion에 적은 FAQ를 Supabase 벡터 DB에 넣고, 사용자의 질문과 가장 비슷한 FAQ를 찾아 OpenAI가 근거 있는 답변을 만드는 실습입니다."))

    parts.append(heading("1. 우리가 만든 것", 1))
    parts.append(p("이번 실습에서는 교육 FAQ를 묻고 답하는 웹 챗봇을 만들었습니다. 사용자가 질문을 입력하면, 앱은 Supabase에 저장된 FAQ 중 가장 비슷한 내용을 찾고, 그 자료만 근거로 답변합니다."))
    parts.append(bullet("웹 화면: 큰 글씨, 예시 질문 버튼, 질문 입력창, 답변 표시 영역"))
    parts.append(bullet("데이터베이스: Supabase Postgres + pgvector"))
    parts.append(bullet("AI 기능: OpenAI embedding으로 질문과 FAQ의 의미를 숫자 벡터로 비교"))
    parts.append(bullet("안전 원칙: API key는 브라우저 코드에 넣지 않고 .env.local에만 저장"))

    parts.append(heading("2. 쉬운 용어 설명", 1))
    parts.append(table(
        ["용어", "쉬운 설명"],
        [
            ["FAQ", "자주 묻는 질문과 공식 답변입니다."],
            ["Embedding", "문장의 의미를 AI가 비교할 수 있는 숫자 목록으로 바꾸는 작업입니다."],
            ["Vector DB", "숫자로 바뀐 문장들을 저장하고 비슷한 문장을 빠르게 찾는 저장소입니다."],
            ["RAG", "AI가 아무 말이나 하지 않도록, 먼저 자료를 검색하고 그 자료를 근거로 답하게 하는 방식입니다."],
            ["API key", "OpenAI나 Supabase 서비스를 사용할 때 필요한 비밀번호 같은 값입니다. 공개하면 안 됩니다."],
        ],
        [1900, 7460],
    ))

    parts.append(heading("3. 전체 작업 흐름", 1))
    for index, step in enumerate([
        "FAQ 샘플 20개를 준비합니다.",
        "Supabase SQL Editor에서 faqs 테이블과 match_faqs 검색 함수를 만듭니다.",
        "OpenAI embedding으로 FAQ 내용을 숫자 벡터로 바꿉니다.",
        "변환된 FAQ를 Supabase faqs 테이블에 저장합니다.",
        "Next.js 웹앱에서 질문을 입력합니다.",
        "API가 질문 embedding을 만들고 비슷한 FAQ를 검색합니다.",
        "AI가 검색된 FAQ만 참고해서 답변합니다.",
        "화면에 답변과 참고 FAQ/출처를 보여줍니다.",
    ], start=1):
        parts.append(number(step, index))

    parts.append(page_break())
    parts.append(heading("4. 프로젝트 파일 구조 이해하기", 1))
    parts.append(code("""rag-faq-chatbot/
  app/
    page.tsx                 메인 챗봇 화면
    api/chat/route.ts        질문을 받아 답변하는 API
  components/
    ChatWindow.tsx           대화창과 입력창
    ExampleQuestions.tsx     예시 질문 버튼
    SourceList.tsx           참고 FAQ/출처 표시
  lib/
    openai.ts                OpenAI 연결
    supabaseServer.ts        Supabase 서버 연결
    rag.ts                   검색과 답변 생성 로직
  data/faqs.json             샘플 FAQ 20개
  scripts/seed-faqs.ts       FAQ를 DB에 넣는 스크립트
  public/app.css             화면 디자인 CSS
  .env.local                 실제 API key 저장 파일"""))

    parts.append(heading("5. 환경변수 설정하기", 1))
    parts.append(p(".env.local 파일에는 실제 키를 넣습니다. 이 파일은 절대 공개 저장소에 올리면 안 됩니다."))
    parts.append(code("""OPENAI_API_KEY=내_OpenAI_API_KEY
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-5.2

SUPABASE_URL=https://내프로젝트.supabase.co
SUPABASE_SERVICE_ROLE_KEY=내_SUPABASE_SERVICE_ROLE_KEY

RAG_MATCH_THRESHOLD=0.70
RAG_MATCH_COUNT=5"""))
    parts.append(callout("중요", "ChatGPT 유료 구독과 OpenAI API 결제는 별도입니다. API 결제가 안 되어 있으면 embedding 생성 시 quota 오류가 날 수 있습니다."))

    parts.append(heading("6. Supabase에 만든 DB 구조", 1))
    parts.append(p("Supabase에는 public.faqs 테이블을 만들었습니다. 핵심은 FAQ 원문과 embedding vector(1536)를 함께 저장하는 것입니다."))
    parts.append(table(
        ["필드", "역할"],
        [
            ["question", "FAQ 질문"],
            ["answer", "공식 답변"],
            ["category", "수강 대상, 교육비, 준비물 같은 분류"],
            ["source", "자료 출처"],
            ["content", "embedding을 만들 때 사용하는 합친 문장"],
            ["embedding", "OpenAI가 만든 의미 벡터"],
            ["is_public", "챗봇에 공개할지 여부"],
        ],
        [2200, 7160],
    ))
    parts.append(p("검색 함수 match_faqs는 사용자의 질문 벡터와 FAQ 벡터를 비교해서 가장 비슷한 FAQ를 찾아줍니다."))

    parts.append(heading("7. FAQ 샘플 데이터 준비", 1))
    parts.append(p("data/faqs.json에는 교육용 FAQ 20개가 들어 있습니다. 각 항목은 question, answer, category, source, related_keywords를 가집니다."))
    parts.append(callout("검색 품질 개선 포인트", "처음에는 question + answer만 embedding했지만, 이후 category와 related_keywords까지 합쳐 embedding하도록 수정했습니다. 그래서 '중장년도 참여 가능한가요?' 같은 유사 질문도 더 잘 찾습니다."))
    parts.append(code("""{
  "question": "시니어도 AI 교육에 참여할 수 있나요?",
  "answer": "네. 중장년과 시니어 학습자를 고려해 큰 글자 안내와 천천히 따라 하는 실습 방식으로 진행합니다.",
  "category": "수강 대상",
  "source": "교육 안내",
  "related_keywords": ["시니어", "중장년", "중년", "장년층", "어르신"]
}"""))

    parts.append(page_break())
    parts.append(heading("8. FAQ를 Supabase에 넣기", 1))
    parts.append(p("아래 명령어를 실행하면 data/faqs.json을 읽고, OpenAI embedding을 만든 뒤 Supabase faqs 테이블에 저장합니다."))
    parts.append(code("npm run seed:faqs"))
    parts.append(p("성공하면 아래처럼 보입니다."))
    parts.append(code("""FAQ 20개 적재를 시작합니다.
성공: 1. AI 교육은 어떻게 신청하나요?
...
FAQ 적재 완료: 성공 20개, 실패 0개"""))
    parts.append(p("실제로 DB에는 FAQ 20개와 embedding 20개가 저장되었습니다."))

    parts.append(heading("9. 웹앱 실행하기", 1))
    parts.append(p("로컬 개발 서버를 실행합니다."))
    parts.append(code("npm run dev"))
    parts.append(p("브라우저에서 아래 주소를 엽니다."))
    parts.append(code("http://localhost:3000"))
    parts.append(p("화면에는 예시 질문 4개, 질문 입력창, 보내기 버튼, 답변 표시 영역, 참고 FAQ/출처 영역이 보입니다."))

    parts.append(heading("10. 테스트 질문", 1))
    parts.append(table(
        ["테스트 질문", "기대되는 답변"],
        [
            ["중장년도 참여 가능한가요?", "시니어/중장년 수강 대상 FAQ를 근거로 답변"],
            ["어르신도 수업 들을 수 있나요?", "큰 글자 안내와 천천히 실습한다는 답변"],
            ["교육비는 무료인가요?", "과정별로 다르며 모집 안내문 확인"],
            ["노트북이 꼭 필요한가요?", "실습 과정은 개인 노트북 권장"],
            ["수업 빠지면 어떻게 되나요?", "출석률과 수료 기준 확인 안내"],
        ],
        [3300, 6060],
    ))

    parts.append(heading("11. 검색 품질을 조정한 이유", 1))
    parts.append(p("처음에는 '중장년도 참여 가능한가요?'가 잘 검색되지 않았습니다. 이유는 FAQ 질문에는 '시니어'라고 되어 있고, 사용자는 '중장년'이라고 물었기 때문입니다. 사람은 같은 뜻으로 이해하지만, 검색 점수는 낮게 나올 수 있습니다."))
    parts.append(bullet("embedding content에 question, answer, category, related_keywords를 함께 넣었습니다."))
    parts.append(bullet("수강 대상 FAQ에 중장년, 시니어, 중년, 장년층, 어르신 같은 동의어를 추가했습니다."))
    parts.append(bullet("검색 결과 후보를 넓게 가져온 뒤, 최종 topK 5개를 사용하도록 했습니다."))
    parts.append(bullet("수강 대상 동의어가 포함된 질문은 관련 FAQ 점수를 보정하도록 했습니다."))

    parts.append(page_break())
    parts.append(heading("12. 자주 나는 오류와 해결법", 1))
    parts.append(table(
        ["증상", "원인", "해결"],
        [
            ["OpenAI quota 오류", "API 결제나 사용 한도가 없음", "OpenAI Platform Billing에서 결제 수단과 사용 한도 확인"],
            ["SUPABASE_SERVICE_ROLE_KEY 필요", ".env.local에 관리자 키가 없음", "Supabase Dashboard에서 service_role key를 넣기"],
            ["화면이 기본 버튼처럼 보임", "CSS가 제대로 적용되지 않음", "강력 새로고침 또는 dev 서버 재시작"],
            ["질문해도 근거 부족", "FAQ에 관련 내용이 없거나 threshold가 높음", "related_keywords 추가 또는 threshold 조정"],
            ["DB에 같은 FAQ가 반복 저장됨", "insert만 사용하면 중복 가능", "question 기준 unique index와 upsert 사용"],
        ],
        [2300, 3100, 3960],
    ))

    parts.append(heading("13. 수업에서 설명할 때 쓰는 쉬운 비유", 1))
    parts.append(bullet("Notion/JSON FAQ는 교재입니다."))
    parts.append(bullet("Embedding은 교재 문장마다 의미 좌표를 붙이는 작업입니다."))
    parts.append(bullet("Supabase Vector DB는 의미 좌표가 붙은 교재 보관함입니다."))
    parts.append(bullet("RAG 검색은 사용자의 질문과 가장 가까운 교재 쪽지를 찾는 일입니다."))
    parts.append(bullet("OpenAI 답변 생성은 찾은 쪽지만 보고 친절하게 설명하는 역할입니다."))

    parts.append(heading("14. 마무리 체크리스트", 1))
    for item in [
        ".env.local에 OpenAI와 Supabase key가 들어 있다.",
        "Supabase faqs 테이블에 20개 FAQ가 들어 있다.",
        "embedding_count가 20개로 확인된다.",
        "npm run dev로 웹앱이 열린다.",
        "중장년도 참여 가능한가요? 질문에 수강 대상 FAQ가 나온다.",
        "답변 아래에 참고 FAQ/출처가 표시된다.",
    ]:
        parts.append(bullet(item))

    parts.append(callout("다음에 해볼 확장", "Notion API 자동 동기화, 관리자 업로드 화면, 답변 만족도 버튼, 질문 로그 저장, 카테고리 필터를 추가하면 더 실제 서비스처럼 발전시킬 수 있습니다."))

    return "\n".join(parts)


def content_types() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>"""


def rels() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""


def doc_rels() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>"""


def styles() -> str:
    def style(style_id: str, name: str, size: int, color: str = "000000", bold_: bool = False, before: int = 0, after: int = 120, line: int = 300) -> str:
        bold_xml = "<w:b/>" if bold_ else ""
        return f"""
<w:style w:type="paragraph" w:styleId="{style_id}">
  <w:name w:val="{name}"/>
  <w:pPr><w:spacing w:before="{before}" w:after="{after}" w:line="{line}" w:lineRule="auto"/></w:pPr>
  <w:rPr><w:rFonts w:ascii="Malgun Gothic" w:eastAsia="Malgun Gothic" w:hAnsi="Malgun Gothic"/>{bold_xml}<w:color w:val="{color}"/><w:sz w:val="{size}"/><w:szCs w:val="{size}"/></w:rPr>
</w:style>"""

    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
{style("Normal", "Normal", 22, "17202A", False, 0, 120, 300)}
{style("Title", "Title", 44, "17202A", True, 0, 240, 300)}
{style("Subtitle", "Subtitle", 20, "1D6F63", True, 0, 80, 280)}
{style("Heading1", "heading 1", 32, "2E74B5", True, 300, 160, 300)}
{style("Heading2", "heading 2", 26, "2E74B5", True, 220, 120, 300)}
{style("Heading3", "heading 3", 24, "1F4D78", True, 160, 100, 300)}
{style("ListParagraph", "List Paragraph", 22, "17202A", False, 0, 80, 300)}
{style("CodeBlock", "Code Block", 19, "1F2937", False, 0, 0, 260)}
{style("CalloutTitle", "Callout Title", 22, "1D6F63", True, 0, 40, 280)}
{style("CalloutText", "Callout Text", 21, "17202A", False, 0, 0, 300)}
{style("TableHeader", "Table Header", 19, "17202A", True, 0, 0, 260)}
{style("TableText", "Table Text", 19, "17202A", False, 0, 0, 260)}
</w:styles>"""


def numbering() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
</w:numbering>"""


def settings() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="720"/>
</w:settings>"""


def document() -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    {document_body()}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>"""


def main() -> None:
    with ZipFile(OUT, "w", compression=ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types())
        docx.writestr("_rels/.rels", rels())
        docx.writestr("word/_rels/document.xml.rels", doc_rels())
        docx.writestr("word/document.xml", document())
        docx.writestr("word/styles.xml", styles())
        docx.writestr("word/numbering.xml", numbering())
        docx.writestr("word/settings.xml", settings())
    print(OUT.resolve())


if __name__ == "__main__":
    main()
