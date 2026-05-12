import path from "node:path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(path.resolve(process.cwd()));

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function testQuery(question: string) {
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: [question],
    encoding_format: "float",
  });
  const embedding = resp.data[0].embedding;

  const { data, error } = await supabase.rpc("match_notion_chunks", {
    query_embedding: embedding,
    match_threshold: 0,
    match_count: 5,
  });

  if (error) {
    console.log(`[${question}] RPC 오류:`, error.message);
    return;
  }

  console.log(`\n=== 질문: "${question}" ===`);
  for (const row of (data ?? []) as any[]) {
    console.log(`  ${(row.similarity * 100).toFixed(1)}% — [${row.page_title}] chunk#${row.chunk_index}`);
  }
}

async function main() {
  await testQuery("바이브코딩이 뭐야?");
  await testQuery("교육 사전 준비 사항이 뭐야?");
  await testQuery("바이브코딩 첫걸음");
}

main().catch(console.error);
