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
    .select("page_title, page_id")
    .order("page_title");

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.page_title] = (counts[row.page_title] || 0) + 1;
  }

  console.log("=== notion_chunks 현재 데이터 ===");
  console.log("총 청크 수:", data.length);
  console.log("");
  console.log("page_title별 청크 수:");
  for (const [title, count] of Object.entries(counts).sort()) {
    console.log(`  [${count}] ${title}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
