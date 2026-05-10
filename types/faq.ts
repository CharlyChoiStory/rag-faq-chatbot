export type MatchedFaq = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  source: string | null;
  source_url: string | null;
  similarity: number;
};
