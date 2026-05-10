export type ChatSource = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  source: string | null;
  sourceUrl: string | null;
  similarity: number;
};

export type ChatResponse = {
  answer: string;
  sources: ChatSource[];
};
