interface Props {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export default function MessageBubble({ role, content, streaming }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#1a3c5e] flex items-center justify-center text-white text-xs font-bold mr-2 mt-1 shrink-0">
          D
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[#1a3c5e] text-white rounded-tr-sm"
            : "bg-gray-100 text-gray-800 rounded-tl-sm"
        } ${streaming ? "animate-pulse" : ""}`}
      >
        {content}
      </div>
    </div>
  );
}
