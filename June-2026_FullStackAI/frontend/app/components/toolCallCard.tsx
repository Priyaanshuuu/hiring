"use client";

import React, { useState } from "react";

interface ToolCallCardProps {
  tool: {
    callId: string;
    toolName: string;
    args: Record<string, unknown>;
    result?: Record<string, unknown>;
    ackReceivedAt?: number;
  };
}

export default function ToolCallCard({ tool }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasResult = !!tool.result;

  return (
    <div
      className={`border-2 rounded-lg p-4 transition-all ${
        hasResult
          ? "border-green-300 bg-green-50 dark:bg-green-900/20"
          : "border-blue-300 bg-blue-50 dark:bg-blue-900/20 animate-pulse"
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="text-xl">🔧</div>
          <div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {tool.toolName}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {tool.callId}
            </div>
          </div>
        </div>
        <div
          className={`text-xs font-medium px-3 py-1 rounded-full transition-all ${
            hasResult
              ? "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200"
              : tool.ackReceivedAt
                ? "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                : "bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
          }`}
        >
          {hasResult ? "✓ Complete" : tool.ackReceivedAt ? "◌ Pending" : "✦ New"}
        </div>
      </div>

      {/* Args */}
      {isExpanded && (
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">Arguments:</div>
            <pre className="bg-white dark:bg-black/30 p-3 rounded text-xs overflow-x-auto text-zinc-800 dark:text-zinc-200">
              {JSON.stringify(tool.args, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {hasResult && (
            <div>
              <div className="font-medium text-green-700 dark:text-green-300 mb-1">
                Result:
              </div>
              <pre className="bg-white dark:bg-black/30 p-3 rounded text-xs overflow-x-auto text-zinc-800 dark:text-zinc-200">
                {JSON.stringify(tool.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}