"use client";

import React, { useRef, useEffect } from "react";
import { useAgent } from "../context/agent_context";
import ToolCallCard from "./toolCallCard";

export default function ChatView() {
  const { state } = useAgent();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.currentStream.tokens]);

  const fullText = state.currentStream.tokens.join("");

  return (
    <div className="flex flex-col flex-1 gap-4 overflow-y-auto p-6 bg-gradient-to-b from-zinc-50 to-white dark:from-black dark:to-zinc-900">
      {/* Response text */}
      {fullText && (
        <div className="prose max-w-none dark:prose-invert">
          <div className="text-zinc-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">
            {fullText}
            {state.currentStream.isPaused && (
              <span className="inline-block w-2 h-6 ml-1 bg-zinc-400 dark:bg-zinc-600 animate-pulse" />
            )}
          </div>
        </div>
      )}

      {/* Tool calls - stacked sequence */}
      {state.toolCalls.size > 0 && (
        <div className="space-y-3 mt-6">
          <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
            Tool Calls
          </h3>
          {Array.from(state.toolCalls.values()).map((tool) => (
            <ToolCallCard key={tool.callId} tool={tool} />
          ))}
        </div>
      )}

      {/* Error display */}
      {state.error && (
        <div className="p-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
          ❌ {state.error}
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}