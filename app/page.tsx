import { NotionChatWindow } from "@/components/NotionChatWindow";

export default function Home() {
  return (
    <main className="page-shell">
      <section className="app-container">
        <header className="app-header">
          <p className="app-kicker">사내 규정 검색</p>
          <div className="header-content">
            <div>
              <h1 className="app-title">
                사내 규정 AI 챗봇
              </h1>
              <p className="app-description">
                사내 규정집을 바탕으로 휴가, 근태, 비용, 보안, 승인 절차 등을 안내합니다.
              </p>
            </div>
            <div className="answer-rule">
              <strong>답변 기준</strong>
              규정집에 있는 내용만 근거로 답합니다.
            </div>
          </div>
        </header>

        <NotionChatWindow />
      </section>
    </main>
  );
}
