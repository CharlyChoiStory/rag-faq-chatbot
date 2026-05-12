import { Client, isFullBlock, isFullPage } from "@notionhq/client";
import type {
  BlockObjectResponse,
  RichTextItemResponse,
  PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

export function getNotionClient(): Client {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) throw new Error("NOTION_API_KEY 환경변수가 필요합니다.");
  return new Client({ auth: apiKey });
}

// ---------------------------------------------------------------------------
// Text extraction helpers
// ---------------------------------------------------------------------------

function richTextToPlain(richText: RichTextItemResponse[]): string {
  return richText.map((t) => t.plain_text).join("");
}

function blockToText(block: BlockObjectResponse): string {
  switch (block.type) {
    case "paragraph":
      return richTextToPlain(block.paragraph.rich_text);
    case "heading_1":
      return `# ${richTextToPlain(block.heading_1.rich_text)}`;
    case "heading_2":
      return `## ${richTextToPlain(block.heading_2.rich_text)}`;
    case "heading_3":
      return `### ${richTextToPlain(block.heading_3.rich_text)}`;
    case "bulleted_list_item":
      return `• ${richTextToPlain(block.bulleted_list_item.rich_text)}`;
    case "numbered_list_item":
      return `- ${richTextToPlain(block.numbered_list_item.rich_text)}`;
    case "to_do":
      return `[${block.to_do.checked ? "✓" : "○"}] ${richTextToPlain(block.to_do.rich_text)}`;
    case "quote":
      return `"${richTextToPlain(block.quote.rich_text)}"`;
    case "callout":
      return richTextToPlain(block.callout.rich_text);
    case "toggle":
      return richTextToPlain(block.toggle.rich_text);
    case "code":
      return `[코드] ${richTextToPlain(block.code.rich_text)}`;
    case "table_row":
      return block.table_row.cells
        .map((cell) => richTextToPlain(cell))
        .filter(Boolean)
        .join(" | ");
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Block / page fetching
// ---------------------------------------------------------------------------

export async function listAllChildren(
  notion: Client,
  blockId: string,
): Promise<BlockObjectResponse[]> {
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: cursor,
    });

    for (const b of res.results) {
      if (isFullBlock(b)) blocks.push(b);
    }

    cursor = res.next_cursor ?? undefined;
  } while (cursor);

  return blocks;
}

export async function extractPageText(
  notion: Client,
  blockId: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 5) return [];

  const blocks = await listAllChildren(notion, blockId);
  const lines: string[] = [];

  for (const block of blocks) {
    if (block.type === "child_page") continue; // handled separately

    const text = blockToText(block).trim();
    if (text) lines.push(text);

    if (block.has_children) {
      const childLines = await extractPageText(notion, block.id, depth + 1);
      lines.push(...childLines);
    }
  }

  return lines;
}

// Collect all child_page IDs recursively from a root page.
export async function collectChildPageIds(
  notion: Client,
  blockId: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 6) return [];

  const blocks = await listAllChildren(notion, blockId);
  const ids: string[] = [];

  for (const block of blocks) {
    if (block.type === "child_page") {
      ids.push(block.id);
      const nested = await collectChildPageIds(notion, block.id, depth + 1);
      ids.push(...nested);
    } else if (block.has_children) {
      const nested = await collectChildPageIds(notion, block.id, depth + 1);
      ids.push(...nested);
    }
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

export function getPageTitle(page: PageObjectResponse): string {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "title" && prop.title.length > 0) {
      return prop.title.map((t) => t.plain_text).join("").trim();
    }
  }
  return "제목 없음";
}

export function getPageUrl(page: PageObjectResponse): string {
  return `https://www.notion.so/${page.id.replace(/-/g, "")}`;
}

export async function getFullPage(
  notion: Client,
  pageId: string,
): Promise<PageObjectResponse | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    return isFullPage(page) ? page : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

// Split lines into chunks of ~maxChars, keeping heading context.
export function chunkLines(
  lines: string[],
  pageTitle: string,
  maxChars = 700,
): string[] {
  if (lines.length === 0) return [];

  const prefix = `[${pageTitle}]\n`;
  const chunks: string[] = [];
  let current = "";
  let lastHeading = "";

  for (const line of lines) {
    const isHeading = /^#{1,3} /.test(line);
    if (isHeading) lastHeading = line;

    const candidate = current ? `${current}\n${line}` : line;

    if (candidate.length > maxChars && current.length > 0) {
      chunks.push(prefix + current.trim());
      // Start next chunk with the last heading for context continuity.
      current = lastHeading && lastHeading !== line
        ? `${lastHeading}\n${line}`
        : line;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) chunks.push(prefix + current.trim());

  return chunks;
}
