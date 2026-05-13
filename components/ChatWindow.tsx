"use client";

import { FormEvent, useRef, useState } from "react";
import { ExampleQuestions } from "@/components/ExampleQuestions";
import { SourceList } from "@/components/SourceList";
import type { ChatSource } from "@/types/chat";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
};

type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "sources"; sources: ChatSource[] }
  | { type: "done" }
  | { type: "error"; message: string };

const welcomeMessage: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "안녕하세요. FAQ 자료를 바탕으로 답변해드릴게요. 궁금한 내용을 편하게 입력해 주세요.",
};

function getFriendlyErrorMessage(message: string) {
  if (message.includes("OPENAI_API_KEY") || message.includes("API key")) {
    return "AI 연결 설정이 아직 완료되지 않았습니다. 관리자에게 문의해 주세요.";
  }

  if (message.includes("SUPABASE") || message.includes("Supabase")) {
    return "FAQ 자료 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (message.includes("quota") || message.includes("429")) {
    return "AI 사용량 한도 때문에 지금은 답변을 만들 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }

  return "답변을 준비하는 중 문제가 생겼습니다. 잠시 후 다시 질문해 주세요.";
}

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function askQuestion(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (isLoading) return;

    if (!trimmed) {
      setError("질문을 먼저 입력해 주세요.");
      inputRef.current?.focus();
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError("");
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          (payload as { error?: string }).error ?? "답변을 가져오지 못했습니다.",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: StreamEvent;
          try {
            event = JSON.parse(raw) as StreamEvent;
          } catch {
            continue;
          }

          if (event.type === "text") {
            setMessages((current) =>
              current.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + event.delta }
                  : m,
              ),
            );
          } else if (event.type === "sources") {
            setMessages((current) =>
              current.map((m) =>
                m.id === assistantId ? { ...m, sources: event.sources } : m,
              ),
            );
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "잠시 후 다시 시도해 주세요.";
      setError(getFriendlyErrorMessage(message));
      // Remove the empty assistant placeholder on error
      setMessages((current) => current.filter((m) => m.id !== assistantId));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askQuestion(question);
  }

  return (
    <div className="chat-layout">
      <ExampleQuestions
        disabled={isLoading}
        onSelect={(example) => void askQuestion(example)}
      />

      <div className="chat-panel">
        <div
          aria-live="polite"
          className="message-list"
        >
          <div className="message-stack">
            {messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === "user"
                    ? "message message-user"
                    : "message message-assistant"
                }
              >
                <p className="message-label">
                  {message.role === "user" ? "내 질문" : "AI 종합 답변"}
                </p>
                <p className="message-text">
                  {message.content}
                  {message.role === "assistant" && isLoading && message.content === "" ? (
                    <span className="typing-cursor" aria-hidden="true" />
                  ) : null}
                </p>
                {message.sources && message.sources.length > 0 ? (
                  <SourceList sources={message.sources} />
                ) : null}
              </article>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="question-form"
        >
          {error ? (
            <p className="error-message">
              {error}
            </p>
          ) : null}

          <label htmlFor="question" className="input-label">
            질문 입력
          </label>
          <div className="input-row">
            <textarea
              ref={inputRef}
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="예: AI를 처음 써도 수강할 수 있나요?"
              rows={2}
              className="question-input"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="send-button"
            >
              {isLoading ? "준비 중" : "보내기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
