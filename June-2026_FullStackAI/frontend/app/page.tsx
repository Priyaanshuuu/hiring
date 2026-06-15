"use client";

import React, { useState } from "react";
import { useAgent } from "./context/agent_context";
import { useWebSocket } from "./hooks/useWebSockets";
import ChatView from "./components/chatView";
import TraceTimeline from "./components/traceTimeline";
import ContextInspector from "./components/contextInspector";

export default function Home() {
  const { state } = useAgent();
  const { sendUserMessage, connectionState } = useWebSocket(
    "ws://localhost:4747/ws"
  );

  const [userInput, setUserInput] = useState("");
  const [activePanel, setActivePanel] = useState<"timeline" | "context">("timeline");

  const handleSend = () => {
    if (userInput.trim()) {
      sendUserMessage(userInput);
      setUserInput("");
    }
  };

  const connectionColor =
    connectionState === "connected"
      ? "bg-green-500"
      : connectionState === "reconnecting"
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-zinc-900 to-zinc-800">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🤖</div>
          <div>
            <h1 className="text-xl font-bold">Agent Console</h1>
            <p className="text-xs text-zinc-400">Full Stack AI Assignment</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className={`inline-block w-3 h-3 rounded-full ${connectionColor} mr-2`} />
            {connectionState}
          </div>
          <div className="text-xs text-zinc-500">
            seq={state.lastProcessedSeq}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Chat panel (left - main) */}
        <div className="flex-1 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          <ChatView />

          {/* Input area */}
          <div className="p-4 border-t border-zinc-800 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Try: 'hello', 'report', 'analyze', 'find', 'large', 'long'..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 px-4 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSend}
                disabled={!userInput.trim() || connectionState !== "connected"}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded font-medium transition-colors"
              >
                Send
              </button>
            </div>

            {state.connectionState !== "connected" && (
              <div className="text-xs text-yellow-400">
                Status: {state.connectionState}...
              </div>
            )}
          </div>
        </div>

        {/* Side panels (right) */}
        <div className="w-96 flex flex-col gap-4 overflow-hidden">
          {/* Panel selector */}
          <div className="flex gap-2 bg-zinc-900 rounded-lg p-2 border border-zinc-800">
            <button
              onClick={() => setActivePanel("timeline")}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                activePanel === "timeline"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActivePanel("context")}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                activePanel === "context"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Context
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 rounded-lg border border-zinc-800 overflow-hidden">
            {activePanel === "timeline" ? (
              <TraceTimeline events={state.timeline} />
            ) : (
              <ContextInspector snapshots={state.contextSnapshots} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}