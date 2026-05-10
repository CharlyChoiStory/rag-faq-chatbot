import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(process.cwd()));

import { Client } from "@notionhq/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;
import {
  collectChildPageIds,
  extractPageText,
  getFullPage,
  getPageTitle,
  getPageUrl,
  chunkLines,
} from "../lib/notion";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

const CHUNK_MAX_CHARS = 700;
const EMBED_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Embedding (batched)
// ---------------------------------------------------------------------------

async function embedBatch(
  openai: OpenAI,
  texts: string[],
): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
    encoding_format: "float",
  });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

// ---------------------------------------------------------------------------
// Supabase upsert
// ---------------------------------------------------------------------------

type ChunkRow = {
  page_id: string;
  page_title: string;
  page_url: string | null;
  chunk_index: number;
  content: string;
  embedding: number[];
  last_synced_at: string;
};

async function upsertChunks(
  supabase: AnySupabase,
  rows: ChunkRow[],
): Promise<void> {
  const { error } = await supabase.from("notion_chunks").upsert(rows, {
    onConflict: "page_id,chunk_index",
  });
  if (error) throw new Error(`Supabase upsert 실패: ${error.message}`);
}

async function deleteOldChunks(
  supabase: AnySupabase,
  pageId: string,
  keepCount: number,
): Promise<void> {
  // Remove chunks with index >= keepCount (leftover from previous sync with more chunks)
  const { error } = await supabase
    .from("notion_chunks")
    .delete()
    .eq("page_id", pageId)
    .gte("chunk_index", keepCount);
  if (error) throw new Error(`청크 정리 실패: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const notion = new Client({ auth: requireEnv("NOTION_API_KEY") });
  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });

  const rootPageId = requireEnv("NOTION_ROOT_PAGE_ID");

  console.log("📋 Notion 페이지 목록을 수집합니다...");
  const childIds = await collectChildPageIds(notion, rootPageId);
  const allPageIds = [rootPageId, ...childIds];
  console.log(`총 ${allPageIds.length}개 페이지를 찾았습니다.\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const [index, pageId] of allPageIds.entries()) {
    const label = `[${index + 1}/${allPageIds.length}] ${pageId}`;

    try {
      const page = await getFullPage(notion, pageId);
      if (!page) {
        console.log(`⏭ ${label} — 페이지 메타 조회 실패, 스킵`);
        skipCount++;
        continue;
      }

      const title = getPageTitle(page);
      const url = getPageUrl(page);
      const lines = await extractPageText(notion, pageId);
      const text = lines.join("\n").trim();

      if (!text) {
        console.log(`⏭ [${index + 1}/${allPageIds.length}] "${title}" — 내용 없음, 스킵`);
        skipCount++;
        continue;
      }

      const chunks = chunkLines(lines, title, CHUNK_MAX_CHARS);
      console.log(`⏳ [${index + 1}/${allPageIds.length}] "${title}" — ${chunks.length}개 청크 임베딩 중...`);

      // Embed in batches
      const allEmbeddings: number[][] = [];
      for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
        const embeddings = await embedBatch(openai, batch);
        allEmbeddings.push(...embeddings);
      }

      const now = new Date().toISOString();
      const rows: ChunkRow[] = chunks.map((content, i) => ({
        page_id: pageId,
        page_title: title,
        page_url: url,
        chunk_index: i,
        content,
        embedding: allEmbeddings[i],
        last_synced_at: now,
      }));

      await upsertChunks(supabase, rows);
      await deleteOldChunks(supabase, pageId, chunks.length);

      console.log(`✓ [${index + 1}/${allPageIds.length}] "${title}" — 완료`);
      successCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`✗ ${label} — 실패: ${message}`);
      failCount++;
    }
  }

  console.log(`\n===========================`);
  console.log(`동기화 완료: 성공 ${successCount}개 | 스킵 ${skipCount}개 | 실패 ${failCount}개`);

  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("sync-notion 실패:", err instanceof Error ? err.message : err);
  process.exit(1);
});
