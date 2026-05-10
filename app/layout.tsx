import type { Metadata } from "next";
import "./globals.css";

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
      <head>
        <link rel="stylesheet" href="/app.css" />
      </head>
      <body className="bg-paper text-ink">{children}</body>
    </html>
  );
}
