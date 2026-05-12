import path from "node:path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(path.resolve(process.cwd()));

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function main() {
  // 테이블 조회 확인
  const { data: rows, error: tableErr } = await supabase
    .from("notion_chunks")
    .select("id, page_title, chunk_index")
    .limit(3);
  
  console.log("=== 테이블 조회 ===");
  console.log("rows:", rows);
  console.log("error:", tableErr);

  // RPC 함수 확인 (더미 embedding)
  const dummyEmbedding = new Array(1536).fill(0);
  const { data: rpcData, error: rpcErr } = await supabase.rpc("match_notion_chunks", {
    query_embedding: dummyEmbedding,
    match_threshold: 0,
    match_count: 3,
  });

  console.log("\n=== RPC match_notion_chunks ===");
  console.log("data:", rpcData?.slice?.(0, 2));
  console.log("error:", rpcErr);
}

main().catch(console.error);
