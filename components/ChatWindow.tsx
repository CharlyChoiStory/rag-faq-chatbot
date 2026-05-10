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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: trimmed }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "답변을 가져오지 못했습니다.");
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.answer,
        sources: payload.sources,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "잠시 후 다시 시도해 주세요.";
      setError(getFriendlyErrorMessage(message));
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
                <p
                  className={
                    message.role === "user"
                      ? "message-label"
                      : "message-label"
                  }
                >
                  {message.role === "user" ? "내 질문" : "FAQ 답변"}
                </p>
                <p className="message-text">
                  {message.content}
                </p>
                {message.sources && message.sources.length > 0 ? (
                  <SourceList sources={message.sources} />
                ) : null}
              </article>
            ))}

            {isLoading ? (
              <div className="loading-message">
                <p className="message-label">FAQ 답변</p>
                FAQ 자료를 찾고 답변을 준비하고 있습니다...
              </div>
            ) : null}
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
