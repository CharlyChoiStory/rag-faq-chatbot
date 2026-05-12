import path from "node:path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(path.resolve(process.cwd()));

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function main() {
  const { data, error } = await supabase
    .from("notion_chunks")
    .select("page_id, page_title, chunk_index, content")
    .order("page_title")
    .order("chunk_index");

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  console.log("=== 청크 내용 미리보기 ===\n");
  for (const row of data) {
    const preview = row.content.replace(/\s+/g, " ").slice(0, 150);
    console.log(`[${row.page_title}] chunk#${row.chunk_index}`);
    console.log(`  page_id: ${row.page_id}`);
    console.log(`  content(150): ${preview}`);
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
