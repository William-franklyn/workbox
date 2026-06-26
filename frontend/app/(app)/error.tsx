"use client";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm px-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-red-500 mb-4 font-mono break-all">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-[#1a3c5e] text-white text-sm rounded-lg hover:bg-[#2d6a9f]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
