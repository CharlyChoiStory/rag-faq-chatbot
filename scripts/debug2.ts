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

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  // 쿼리 임베딩 생성
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: ["바이브코딩이 뭐야?"],
    encoding_format: "float",
  });
  const queryEmb = resp.data[0].embedding;

  // notion_chunks에서 embedding 직접 조회
  const { data: rows } = await supabase
    .from("notion_chunks")
    .select("page_title, chunk_index, embedding")
    .limit(10);

  console.log("=== JS에서 직접 계산한 similarity ===");
  for (const r of rows ?? []) {
    // embedding이 string으로 반환됨 → 파싱
    const storedEmb: number[] = typeof r.embedding === "string"
      ? JSON.parse(r.embedding)
      : r.embedding;
    const sim = cosineSim(queryEmb, storedEmb);
    console.log(`${(sim * 100).toFixed(1)}% — [${r.page_title}] chunk#${r.chunk_index}`);
  }

  // RPC 결과 비교
  const { data: rpcRows, error } = await supabase.rpc("match_notion_chunks", {
    query_embedding: queryEmb,
    match_threshold: -2,
    match_count: 10,
  });
  console.log("\n=== RPC 결과 (threshold=-2) ===");
  console.log("count:", rpcRows?.length, "error:", error?.message ?? "없음");
}

main().catch(console.error);
