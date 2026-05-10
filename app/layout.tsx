import type { Metadata } from "next";
import "./globals.css";
import "../public/app.css";

export const metadata: Metadata = {
  title: "FAQ RAG 챗봇",
  description: "Notion FAQ와 Supabase pgvector를 사용하는 교육용 RAG 챗봇",
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
