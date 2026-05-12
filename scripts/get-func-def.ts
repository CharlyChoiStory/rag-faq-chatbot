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
  // information_schema 통해 함수 정의 조회
  const { data, error } = await supabase
    .from("information_schema.routines")
    .select("routine_name, routine_definition")
    .eq("routine_schema", "public")
    .in("routine_name", ["match_faqs", "match_notion_chunks"]);
  
  console.log("data:", JSON.stringify(data, null, 2));
  console.log("error:", error);
}

main().catch(console.error);
