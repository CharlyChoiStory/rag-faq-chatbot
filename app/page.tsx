import { ChatWindow } from "@/components/ChatWindow";

export default function Home() {
  return (
    <main className="page-shell">
      <section className="app-container">
        <header className="app-header">
          <p className="app-kicker">Notion FAQ RAG Chatbot</p>
          <div className="header-content">
            <div>
              <h1 className="app-title">
                자주 묻는 질문을 쉽게 물어보세요
              </h1>
              <p className="app-description">
                교육 안내, 준비물, 수료 기준처럼 궁금한 내용을 입력하면 FAQ 자료를 찾아 근거와 함께 답변합니다.
              </p>
            </div>
            <div className="answer-rule">
              <strong>답변 기준</strong>
              공개된 FAQ 자료 안에서만 답합니다.
            </div>
          </div>
        </header>

        <ChatWindow />
      </section>
    </main>
  );
}
