import OpenAI from "openai";

export const embeddingModel =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

export const chatModel = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.2";

export const rewriteModel = process.env.OPENAI_REWRITE_MODEL ?? "gpt-4o-mini";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY 환경변수가 필요합니다.");
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export async function createEmbedding(input: string): Promise<number[]> {
  return (await createEmbeddings([input]))[0];
}

export async function createEmbeddings(inputs: string[]): Promise<number[][]> {
  const openai = getOpenAIClient();
  const response = await openai.embeddings.create({
    model: embeddingModel,
    input: inputs,
    encoding_format: "float",
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}
