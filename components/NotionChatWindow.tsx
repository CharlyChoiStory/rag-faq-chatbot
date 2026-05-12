"use client";

import { FormEvent, useRef, useState } from "react";
import { NotionSourceList } from "@/components/NotionSourceList";
import type { NotionSource } from "@/types/notion";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: NotionSource[];
};

const welcomeMessage: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "안녕하세요. 사내 규정집을 확인해 근거가 있는 내용만 안내드릴게요. 휴가, 근태, 비용, 보안, 결재 절차 등을 편하게 물어보세요.",
};

const exampleQuestions = [
  "연차는 며칠 전까지 신청해야 해?",
  "출장비는 언제까지 정산해야 해?",
  "재택근무 신청 절차 알려줘.",
  "회사 노트북을 분실하면 어떻게 해야 해?",
  "개인정보 자료는 어떻게 보관해야 해?",
  "복리후생비 사용 기준 알려줘.",
];

function getFriendlyErrorMessage(message: string) {
  if (message.includes("NOTION_API_KEY") || message.includes("Notion")) {
    return "Notion 연동 설정이 아직 완료되지 않았습니다. 관리자에게 문의해 주세요.";
  }
  if (message.includes("SUPABASE") || message.includes("Supabase")) {
    return "규정 검색 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (message.includes("quota") || message.includes("429")) {
    return "AI 사용량 한도 때문에 지금은 답변을 만들 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "답변을 준비하는 중 문제가 생겼습니다. 잠시 후 다시 질문해 주세요.";
}

export function NotionChatWindow() {
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
      const response = await fetch("/api/rules-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      <div className="chat-panel">
        <div className="chat-room-header">
          <div>
            <p className="chat-room-kicker">Notion 사내 규정집 기반</p>
            <h2 className="chat-room-title">사내 규정 AI 챗봇</h2>
          </div>
          <span className="chat-room-status">근거 기반 답변</span>
        </div>

        <div aria-live="polite" className="message-list">
          <div className="example-section" aria-label="예시 질문">
            {exampleQuestions.map((example) => (
              <button
                key={example}
                type="button"
                className="example-button"
                onClick={() => void askQuestion(example)}
                disabled={isLoading}
              >
                {example}
              </button>
            ))}
          </div>

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
                  {message.role === "user" ? "나" : "규정 챗봇"}
                </p>
                <p className="message-text">{message.content}</p>
                {message.sources && message.sources.length > 0 ? (
                  <NotionSourceList sources={message.sources} />
                ) : null}
              </article>
            ))}

            {isLoading ? (
              <div className="loading-message">
                <p className="message-label">규정 챗봇</p>
                규정집을 확인하고 있어요...
              </div>
            ) : null}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="question-form">
          {error ? <p className="error-message">{error}</p> : null}

          <label htmlFor="notion-question" className="input-label">
            규정 질문 입력
          </label>
          <div className="input-row">
            <textarea
              ref={inputRef}
              id="notion-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="예: 연차는 며칠 전까지 신청해야 해?"
              rows={2}
              className="question-input"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="send-button"
            >
              {isLoading ? "확인 중" : "전송"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
