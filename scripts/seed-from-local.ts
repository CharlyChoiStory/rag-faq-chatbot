/**
 * 로컬 sample-data 파일에서 notion_chunks 테이블을 재색인합니다.
 * - 고객지원 FAQ (10, 11, 12) 제외
 * - PDF: pdftotext 사용
 * - txt: 직접 읽기
 * - 기존 데이터 전체 삭제 후 재적재
 */
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(process.cwd()));

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const execFileAsync = promisify(execFile);

const CHUNK_MAX_CHARS = 900;
const EMBED_BATCH_SIZE = 50;

const EXCLUDED_FILES = new Set([
  "10_고객지원_FAQ_환불_교환.pdf",
  "11_고객지원_FAQ_배송.pdf",
  "12_고객지원_FAQ_계정_로그인.pdf",
]);

const SAMPLE_DATA_DIR = path.resolve(process.cwd(), "data/sample-data");
const SUBDIRS = ["hr", "finance", "it", "welfare", "policy"];

type ChunkRow = {
  page_id: string;
  page_title: string;
  page_url: string | null;
  chunk_index: number;
  content: string;
  embedding: number[];
  last_synced_at: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

function chunkText(title: string, text: string): string[] {
  const lines = text
    .split(/\r?\n/u)
    .map((l) => l.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > CHUNK_MAX_CHARS && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((chunk) => `규정명: ${title}\n${chunk}`);
}

async function extractPdfText(pdfPath: string): Promise<string> {
  const { stdout } = await execFileAsync("pdftotext", [
    "-layout",
    "-enc",
    "UTF-8",
    pdfPath,
    "-",
  ]);
  return stdout;
}

async function collectFiles(): Promise<{ filePath: string; title: string; subdir: string }[]> {
  const results: { filePath: string; title: string; subdir: string }[] = [];
  for (const sub of SUBDIRS) {
    const dir = path.join(SAMPLE_DATA_DIR, sub);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      console.warn(`⚠ ${sub}/ 디렉토리 없음, 스킵`);
      continue;
    }

    for (const entry of entries.sort()) {
      if (EXCLUDED_FILES.has(entry)) {
        console.log(`  [제외] ${sub}/${entry}`);
        continue;
      }
      if (!entry.endsWith(".pdf") && !entry.endsWith(".txt")) continue;
      results.push({
        filePath: path.join(dir, entry),
        title: entry,
        subdir: sub,
      });
    }
  }
  return results;
}

async function embedBatch(openai: OpenAI, texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    input: texts,
    encoding_format: "float",
  });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

async function main() {
  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });

  // 기존 데이터 전체 삭제
  console.log("🗑  기존 notion_chunks 데이터 전체 삭제 중...");
  const { error: delErr } = await supabase
    .from("notion_chunks")
    .delete()
    .neq("page_id", "__placeholder__");
  if (delErr) throw new Error(`삭제 실패: ${delErr.message}`);
  console.log("✓ 기존 데이터 삭제 완료\n");

  const files = await collectFiles();
  console.log(`📂 총 ${files.length}개 파일 처리 예정 (고객지원 FAQ 3개 제외)\n`);

  let successCount = 0;
  let failCount = 0;

  for (const [idx, { filePath, title, subdir }] of files.entries()) {
    const pageId = `local-file:${subdir}/${title}`;
    console.log(`⏳ [${idx + 1}/${files.length}] ${subdir}/${title}`);

    try {
      let rawText: string;
      if (title.endsWith(".pdf")) {
        rawText = await extractPdfText(filePath);
      } else {
        rawText = await readFile(filePath, "utf8");
      }

      const text = rawText.trim();
      if (!text) {
        console.log(`  ⏭ 텍스트 없음, 스킵`);
        continue;
      }

      const chunks = chunkText(title, text);
      console.log(`  → ${chunks.length}개 청크 생성`);

      const allEmbeddings: number[][] = [];
      for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
        allEmbeddings.push(...(await embedBatch(openai, batch)));
      }

      const now = new Date().toISOString();
      const rows: ChunkRow[] = chunks.map((content, chunkIndex) => ({
        page_id: pageId,
        page_title: title,
        page_url: null,
        chunk_index: chunkIndex,
        content,
        embedding: allEmbeddings[chunkIndex],
        last_synced_at: now,
      }));

      const { error: upsertErr } = await supabase
        .from("notion_chunks")
        .upsert(rows, { onConflict: "page_id,chunk_index" });
      if (upsertErr) throw new Error(`upsert 실패: ${upsertErr.message}`);

      console.log(`  ✓ 저장 완료`);
      successCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ 실패: ${message}`);
      failCount++;
    }
  }

  console.log("\n===========================");
  console.log(`완료: 성공 ${successCount}개 | 실패 ${failCount}개`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("seed-from-local 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
