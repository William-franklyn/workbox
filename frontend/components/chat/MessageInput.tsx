"use client";
import { useState } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-4">
      <div className="flex items-end gap-3 max-w-3xl mx-auto">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask a question..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3c5e] disabled:opacity-50 max-h-32 overflow-y-auto"
          style={{ minHeight: "44px" }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="bg-[#1a3c5e] text-white rounded-xl px-5 py-3 text-sm font-semibold hover:bg-[#2d6a9f] transition-colors disabled:opacity-40 shrink-0"
        >
          Send
        </button>
      </div>
      <p className="text-xs text-gray-400 text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
