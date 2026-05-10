"use client";

import { useState } from "react";
import { ChatWindow } from "@/components/ChatWindow";
import { NotionChatWindow } from "@/components/NotionChatWindow";

type Tab = "faq" | "notion";

export function TabLayout() {
  const [activeTab, setActiveTab] = useState<Tab>("faq");

  return (
    <>
      <div className="tab-bar" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "faq"}
          className={activeTab === "faq" ? "tab-button tab-active" : "tab-button"}
          onClick={() => setActiveTab("faq")}
        >
          FAQ 챗봇
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "notion"}
          className={activeTab === "notion" ? "tab-button tab-active" : "tab-button"}
          onClick={() => setActiveTab("notion")}
        >
          교육 자료 챗봇
        </button>
      </div>

      {activeTab === "faq" ? <ChatWindow /> : <NotionChatWindow />}
    </>
  );
}
