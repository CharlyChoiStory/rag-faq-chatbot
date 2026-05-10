import { TabLayout } from "@/components/TabLayout";

export default function Home() {
  return (
    <main className="page-shell">
      <section className="app-container">
        <header className="app-header">
          <p className="app-kicker">AI 교육 챗봇</p>
          <div className="header-content">
            <div>
              <h1 className="app-title">
                궁금한 내용을 편하게 물어보세요
              </h1>
              <p className="app-description">
                FAQ와 Notion 교육 자료를 바탕으로 근거와 함께 답변합니다.
              </p>
            </div>
            <div className="answer-rule">
              <strong>답변 기준</strong>
              공개된 자료 안에서만 답합니다.
            </div>
          </div>
        </header>

        <TabLayout />
      </section>
    </main>
  );
}
