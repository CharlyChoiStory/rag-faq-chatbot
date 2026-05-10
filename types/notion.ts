export type NotionChunk = {
  id: string;
  page_id: string;
  page_title: string;
  page_url: string | null;
  chunk_index: number;
  content: string;
  similarity: number;
};

export type NotionSource = {
  id: string;
  pageId: string;
  pageTitle: string;
  pageUrl: string | null;
  chunkIndex: number;
  contentPreview: string;
  similarity: number;
};

export type NotionChatResponse = {
  answer: string;
  sources: NotionSource[];
};
