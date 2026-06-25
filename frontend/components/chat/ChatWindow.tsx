"use client";
import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Props {
  conversationId: string;
  organizationId: string;
  initialMessages: Message[];
}

export default function ChatWindow({ conversationId, organizationId, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const backendUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  async function sendMessage(question: string) {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);
    setStreamingText("");

    // Build history for context (last 6 messages)
    const history = [...messages, userMsg].slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch(`${backendUrl}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          conversation_id: conversationId,
          organization_id: organizationId,
          history,
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              fullText += parsed.token || "";
              setStreamingText(fullText);
            } catch {}
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: fullText,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I couldn't connect to the AI service. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setStreaming(false);
      setStreamingText("");
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 bg-[#1a3c5e] rounded-xl flex items-center justify-center mb-4">
              <span className="text-white text-xl font-bold">D</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Ask DeskBot anything</h2>
            <p className="text-gray-400 text-sm max-w-sm">
              Ask about company policies, procedures, or any workplace question. Load documents from the dashboard for more accurate answers.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {streaming && streamingText && (
          <MessageBubble role="assistant" content={streamingText} streaming />
        )}
        {streaming && !streamingText && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <span className="animate-pulse">DeskBot is thinking...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput onSend={sendMessage} disabled={streaming} />
    </div>
  );
}
