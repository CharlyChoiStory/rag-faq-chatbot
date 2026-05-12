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
  // 실제 쿼리로 테스트 - threshold 없이 raw 유사도 확인
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: ["바이브코딩이 뭐야?"],
    encoding_format: "float",
  });
  const emb = resp.data[0].embedding;
  
  console.log("embedding length:", emb.length);
  console.log("embedding sample:", emb.slice(0, 3));

  // threshold를 -1로 설정해서 모든 결과 가져오기
  const { data, error } = await supabase.rpc("match_notion_chunks", {
    query_embedding: emb,
    match_threshold: -1,
    match_count: 5,
  });

  console.log("\n=== threshold=-1 결과 ===");
  console.log("error:", error);
  console.log("count:", data?.length);
  if (data?.length > 0) {
    for (const r of data.slice(0, 5)) {
      console.log(`  similarity=${r.similarity} [${r.page_title}]`);
    }
  }

  // match_faqs도 확인
  const { data: faqData, error: faqErr } = await supabase.rpc("match_faqs", {
    query_embedding: emb,
    match_threshold: -1,
    match_count: 3,
  });
  console.log("\n=== match_faqs 결과 ===");
  console.log("error:", faqErr);
  console.log("count:", faqData?.length);
}

main().catch(console.error);
