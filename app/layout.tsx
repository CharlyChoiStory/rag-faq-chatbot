import type { Metadata } from "next";
import "./globals.css";
import "../public/app.css";

export const metadata: Metadata = {
  title: "사내 규정 AI 챗봇",
  description: "Notion 사내 규정집과 Supabase pgvector를 사용하는 규정 검색 RAG 챗봇",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-paper text-ink">{children}</body>
    </html>
  );
}
