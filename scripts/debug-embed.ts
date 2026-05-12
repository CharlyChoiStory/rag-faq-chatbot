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

async function main() {
  // 1. 테이블에 embedding이 제대로 있는지 확인
  const { data: rows, error: e1 } = await supabase
    .from("notion_chunks")
    .select("id, page_title, embedding")
    .limit(2);

  console.log("=== embedding 확인 ===");
  if (rows) {
    for (const r of rows) {
      const emb = r.embedding;
      const isArr = Array.isArray(emb);
      console.log(`[${r.page_title}] embedding 타입: ${typeof emb}, isArray: ${isArr}, 첫값: ${isArr ? emb[0] : JSON.stringify(emb)?.slice(0, 50)}`);
    }
  }
  console.log("error:", e1);

  // 2. 실제 SQL로 코사인 거리 직접 계산 (pg_typeof 사용)
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: ["바이브코딩이 뭐야?"],
    encoding_format: "float",
  });
  const emb = resp.data[0].embedding;

  // RPC 직접 호출 - 파라미터 타입 확인
  const { data, error } = await supabase.rpc("match_notion_chunks", {
    query_embedding: emb,
    match_threshold: -2,
    match_count: 3,
  });
  console.log("\n=== match_notion_chunks(threshold=-2) ===");
  console.log("count:", data?.length, "error:", error?.message);
}

main().catch(console.error);
