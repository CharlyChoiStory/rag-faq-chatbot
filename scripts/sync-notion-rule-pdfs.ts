import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(process.cwd()));

import { Client } from "@notionhq/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type {
  BlockObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {
  chunkLines,
  collectChildPageIds,
  extractPageText,
  getFullPage,
  getPageTitle,
  getPageUrl,
  listAllChildren,
} from "../lib/notion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

type FileSource = {
  kind: "file";
  blockId: string;
  title: string;
  url: string;
  notionPageUrl: string;
  format: "pdf" | "text" | "unknown";
};

type PageSource = {
  kind: "page";
  pageId: string;
  title: string;
  url: string;
};

type ChunkRow = {
  page_id: string;
  page_title: string;
  page_url: string | null;
  chunk_index: number;
  content: string;
  embedding: number[];
  last_synced_at: string;
};

const CHUNK_MAX_CHARS = 900;
const EMBED_BATCH_SIZE = 50;
const COMPANY_RULES_PAGE_ID =
  process.env.NOTION_RULES_PAGE_ID ?? "35e0d17ecf4a801d8166eff8982245a9";
const COMPANY_RULES_PAGE_URL =
  process.env.NOTION_RULES_PAGE_URL ??
  "https://www.notion.so/charly-choi/35e0d17ecf4a801d8166eff8982245a9?pvs=12";

const execFileAsync = promisify(execFile);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

function getNotionRulesApiKey(): string {
  const value = process.env.NOTION_RULES_API_KEY;
  if (!value) {
    throw new Error(
      "NOTION_RULES_API_KEY 환경변수가 필요합니다. hsikchoi@gmail.com 워크스페이스의 ai교육챗봇 integration secret을 설정해 주세요.",
    );
  }
  const hasValidTokenPrefix =
    value.startsWith("secret_") || value.startsWith("ntn_");
  if (!/^[\x20-\x7E]+$/u.test(value) || !hasValidTokenPrefix) {
    throw new Error(
      "NOTION_RULES_API_KEY 값이 Notion integration secret 형식이 아닙니다. Notion 개발자 페이지에서 ai교육챗봇의 Internal Integration Secret 값을 그대로 붙여넣어 주세요.",
    );
  }
  return value;
}

function richTextToPlain(richText: RichTextItemResponse[]): string {
  return richText.map((t) => t.plain_text).join("").trim();
}

function safeFileName(name: string) {
  return name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
}

function normalizeSourceTitle(title: string) {
  return title.normalize("NFC").replace(/\s+/gu, " ").trim().toLowerCase();
}

function sourcePageId(blockId: string) {
  return `notion-file:${blockId}`;
}

function mediaUrl(block: BlockObjectResponse): string | null {
  if (block.type === "pdf") {
    return block.pdf.type === "external"
      ? block.pdf.external.url
      : block.pdf.file.url;
  }

  if (block.type === "file") {
    return block.file.type === "external"
      ? block.file.external.url
      : block.file.file.url;
  }

  return null;
}

function mediaTitle(block: BlockObjectResponse, fallbackIndex: number): string {
  if (block.type === "file" && block.file.name) return block.file.name;

  if (block.type === "pdf") {
    const caption = richTextToPlain(block.pdf.caption);
    if (caption) return caption;
  }

  if (block.type === "file") {
    const caption = richTextToPlain(block.file.caption);
    if (caption) return caption;
  }

  const url = mediaUrl(block);
  if (url) {
    try {
      const decoded = decodeURIComponent(new URL(url).pathname);
      const basename = path.basename(decoded);
      if (basename && basename !== "/") return basename;
    } catch {
      // Fall through to numbered title.
    }
  }

  return `사내 규정 PDF ${fallbackIndex}`;
}

function mediaFormat(block: BlockObjectResponse): FileSource["format"] | null {
  if (block.type === "pdf") return "pdf";
  if (block.type !== "file") return null;

  const title = block.file.name.toLowerCase();
  const url = mediaUrl(block)?.toLowerCase() ?? "";
  if (title.endsWith(".pdf") || url.includes(".pdf")) return "pdf";
  if (title.endsWith(".txt") || url.includes(".txt")) return "text";
  return "unknown";
}

async function collectFileSources(
  notion: Client,
  blockId: string,
  depth = 0,
): Promise<FileSource[]> {
  if (depth > 8) return [];

  const blocks = await listAllChildren(notion, blockId);
  const sources: FileSource[] = [];

  for (const block of blocks) {
    const format = mediaFormat(block);
    if (format) {
      const url = mediaUrl(block);
      if (url) {
        sources.push({
          kind: "file",
          blockId: block.id,
          title: mediaTitle(block, sources.length + 1),
          url,
          notionPageUrl: COMPANY_RULES_PAGE_URL,
          format,
        });
      }
    }

    if (block.has_children) {
      sources.push(...await collectFileSources(notion, block.id, depth + 1));
    }
  }

  return sources;
}

async function collectPageSources(
  notion: Client,
  pageIds: string[],
): Promise<PageSource[]> {
  const sources: PageSource[] = [];

  for (const pageId of pageIds) {
    const page = await getFullPage(notion, pageId);
    if (!page) continue;

    const lines = await extractPageText(notion, pageId);
    if (lines.join("").trim().length === 0) continue;

    sources.push({
      kind: "page",
      pageId,
      title: getPageTitle(page),
      url: getPageUrl(page),
    });
  }

  return sources;
}

async function downloadFile(url: string, filePath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`파일 다운로드 실패: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, buffer);
}

async function extractPdfText(filePath: string, outputPath: string) {
  await execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", filePath, outputPath]);
  return readFile(outputPath, "utf8");
}

async function extractFileText(source: FileSource, filePath: string, outputPath: string) {
  if (source.format === "pdf") {
    return extractPdfText(filePath, outputPath);
  }

  if (source.format === "text") {
    return readFile(filePath, "utf8");
  }

  try {
    return await extractPdfText(filePath, outputPath);
  } catch {
    return readFile(filePath, "utf8");
  }
}

function chunkFileText(title: string, format: FileSource["format"], text: string): string[] {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  return chunkLines(lines, title, CHUNK_MAX_CHARS).map(
    (chunk) => `문서명: ${title}\n원본 형식: Notion 첨부 ${format.toUpperCase()} 파일\n${chunk}`,
  );
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

async function upsertChunks(supabase: AnySupabase, rows: ChunkRow[]) {
  const { error } = await supabase.from("notion_chunks").upsert(rows, {
    onConflict: "page_id,chunk_index",
  });
  if (error) throw new Error(`Supabase upsert 실패: ${error.message}`);
}

async function deleteChunksForPageIds(
  supabase: AnySupabase,
  pageIds: string[],
  label: string,
) {
  if (pageIds.length === 0) return;

  const { error } = await supabase.from("notion_chunks").delete().in("page_id", pageIds);
  if (error) throw new Error(`${label} 청크 삭제 실패: ${error.message}`);
}

async function deleteOldChunks(
  supabase: AnySupabase,
  pageId: string,
  keepCount: number,
) {
  const { error } = await supabase
    .from("notion_chunks")
    .delete()
    .eq("page_id", pageId)
    .gte("chunk_index", keepCount);
  if (error) throw new Error(`PDF 잔여 청크 정리 실패: ${error.message}`);
}

async function cleanupGeneratedFileChunks(
  supabase: AnySupabase,
  keepPageIds: string[],
) {
  const { data, error } = await supabase
    .from("notion_chunks")
    .select("page_id,page_title")
    .or("page_id.like.notion-pdf:%,page_id.like.notion-file:%");

  if (error) throw new Error(`기존 첨부 파일 청크 조회 실패: ${error.message}`);

  const keepSet = new Set(keepPageIds);
  const deleteIds = Array.from(
    new Set(
      (data ?? [])
        .filter((row) => !keepSet.has(row.page_id))
        .map((row) => row.page_id),
    ),
  );

  if (deleteIds.length === 0) {
    console.log("제외/누락된 Notion 첨부 파일 청크 정리: 0개 page_id");
    return;
  }

  await deleteChunksForPageIds(supabase, deleteIds, "제외/누락된 Notion 첨부 파일");
  console.log(`제외/누락된 Notion 첨부 파일 청크 정리: ${deleteIds.length}개 page_id`);
}

async function cleanupNonRuleNotionChunks(
  supabase: AnySupabase,
  keepPageIds: string[],
) {
  const { data, error } = await supabase
    .from("notion_chunks")
    .select("page_id,page_title");

  if (error) throw new Error(`기존 Notion 청크 조회 실패: ${error.message}`);

  const keepSet = new Set(keepPageIds);
  const deleteIds = Array.from(
    new Set(
      (data ?? [])
        .filter((row) => !keepSet.has(row.page_id))
        .map((row) => row.page_id),
    ),
  );

  if (deleteIds.length === 0) {
    console.log("사내 규정집 외 Notion 청크 정리: 0개 page_id");
    return;
  }

  await deleteChunksForPageIds(supabase, deleteIds, "사내 규정집 외 Notion");
  console.log(`사내 규정집 외 Notion 청크 정리: ${deleteIds.length}개 page_id`);
}

async function main() {
  const notion = new Client({ auth: getNotionRulesApiKey() });
  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });

  const rootPage = await getFullPage(notion, COMPANY_RULES_PAGE_ID);
  const rootTitle = rootPage ? getPageTitle(rootPage) : "사내 규정집";
  const rootUrl = rootPage ? getPageUrl(rootPage) : COMPANY_RULES_PAGE_URL;

  console.log(`📎 "${rootTitle}" Notion 노트의 첨부 파일과 하위 페이지를 수집합니다.`);
  const [fileSources, childPageIds] = await Promise.all([
    collectFileSources(notion, COMPANY_RULES_PAGE_ID),
    collectChildPageIds(notion, COMPANY_RULES_PAGE_ID),
  ]);
  const pageSources = await collectPageSources(notion, childPageIds);

  const allUniqueSources = Array.from(
    new Map(
      fileSources.map((source) => [normalizeSourceTitle(source.title), source]),
    ).values(),
  );
  const uniqueSources = allUniqueSources;

  if (uniqueSources.length === 0 && pageSources.length === 0) {
    throw new Error("대상 Notion 노트에서 첨부 파일 또는 하위 페이지를 찾지 못했습니다.");
  }

  console.log(
    `첨부 파일 ${uniqueSources.length}개, 하위 페이지 ${pageSources.length}개를 찾았습니다.`,
  );
  console.log("notion_chunks를 이 Notion 페이지 전체 데이터 기준으로 재구축하고, 다른 테이블은 건드리지 않습니다.");

  const keepRulePageIds = [
    ...uniqueSources.map((source) => sourcePageId(source.blockId)),
    ...pageSources.map((source) => source.pageId),
  ];
  const previousPageTextIds = [COMPANY_RULES_PAGE_ID, ...childPageIds];
  await deleteChunksForPageIds(
    supabase,
    previousPageTextIds,
    "대상 Notion 페이지 본문",
  );
  console.log(`잘못 적재된 대상 Notion 페이지 본문 청크 정리: ${previousPageTextIds.length}개 page_id`);
  await cleanupGeneratedFileChunks(supabase, keepRulePageIds);
  await cleanupNonRuleNotionChunks(supabase, keepRulePageIds);

  let successCount = 0;
  let failCount = 0;
  const tempDir = await mkdtemp(path.join(tmpdir(), "rules-pdf-sync-"));

  try {
    for (const [index, source] of uniqueSources.entries()) {
      const sourceId = sourcePageId(source.blockId);
      const title = source.title;
      const filePath = path.join(tempDir, `${index}-${safeFileName(title)}`);
      const textPath = path.join(tempDir, `${index}-${safeFileName(title)}.txt`);

      try {
        console.log(`\n⏳ [${index + 1}/${uniqueSources.length}] "${title}" 처리 중...`);
        await downloadFile(source.url, filePath);
        const text = (await extractFileText(source, filePath, textPath)).trim();

        if (!text) {
          console.log(`⏭ "${title}" — 추출된 텍스트 없음, 스킵`);
          await deleteChunksForPageIds(supabase, [sourceId], "빈 첨부 파일");
          continue;
        }

        const chunks = chunkFileText(title, source.format, text);
        const allEmbeddings: number[][] = [];
        for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
          const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
          allEmbeddings.push(...await embedBatch(openai, batch));
        }

        const now = new Date().toISOString();
        const rows = chunks.map((content, chunkIndex) => ({
          page_id: sourceId,
          page_title: title,
          page_url: rootUrl,
          chunk_index: chunkIndex,
          content,
          embedding: allEmbeddings[chunkIndex],
          last_synced_at: now,
        }));

        await upsertChunks(supabase, rows);
        await deleteOldChunks(supabase, sourceId, chunks.length);

        console.log(`✓ "${title}" — ${chunks.length}개 청크 저장`);
        successCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`✗ "${title}" — 실패: ${message}`);
        failCount++;
      }
    }

    for (const [index, source] of pageSources.entries()) {
      try {
        console.log(`\n⏳ [페이지 ${index + 1}/${pageSources.length}] "${source.title}" 처리 중...`);
        const lines = await extractPageText(notion, source.pageId);
        const chunks = chunkLines(lines, source.title, CHUNK_MAX_CHARS).map(
          (chunk) => `규정명: ${source.title}\n원본 형식: Notion 하위 페이지\n${chunk}`,
        );

        const allEmbeddings: number[][] = [];
        for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
          const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
          allEmbeddings.push(...await embedBatch(openai, batch));
        }

        const now = new Date().toISOString();
        const rows = chunks.map((content, chunkIndex) => ({
          page_id: source.pageId,
          page_title: source.title,
          page_url: source.url,
          chunk_index: chunkIndex,
          content,
          embedding: allEmbeddings[chunkIndex],
          last_synced_at: now,
        }));

        await upsertChunks(supabase, rows);
        await deleteOldChunks(supabase, source.pageId, chunks.length);

        console.log(`✓ "${source.title}" — ${chunks.length}개 청크 저장`);
        successCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`✗ "${source.title}" — 실패: ${message}`);
        failCount++;
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  console.log("\n===========================");
  console.log(`Notion 전체 데이터 동기화 완료: 성공 ${successCount}개 | 실패 ${failCount}개`);
  if (failCount > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    "sync-notion-rule-pdfs 실패:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
