"use client";

import React, { useState, useMemo } from "react";
import { TimelineEvent, TokenGroupEvent } from "../types/protocol";

type TokenTimelineEvent = Extract<TimelineEvent, { type: "TOKEN" }>;
type ExtendedEvent = TimelineEvent | { type: "PONG"; seq?: number };
export type ProcessedTimelineEvent = ExtendedEvent | TokenGroupEvent;

interface TimelineProps {
  events: ExtendedEvent[];
}

function groupTokens(events: ExtendedEvent[]): ProcessedTimelineEvent[] {
  const grouped: ProcessedTimelineEvent[] = [];
  let tokenBuffer: TokenTimelineEvent[] = [];

  for (const event of events) {
    if (event.type === "TOKEN") {
      tokenBuffer.push(event as TokenTimelineEvent);
    } else {
      if (tokenBuffer.length > 0) {
        grouped.push({
          type: "TOKEN_GROUP",
          tokens: tokenBuffer,
          text: tokenBuffer.map((t) => t.text).join(""),
        });
        tokenBuffer = [];
      }
      grouped.push(event);
    }
  }

  if (tokenBuffer.length > 0) {
    grouped.push({
      type: "TOKEN_GROUP",
      tokens: tokenBuffer,
      text: tokenBuffer.map((t) => t.text).join(""),
    });
  }

  return grouped;
}

export default function TraceTimeline({ events }: TimelineProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const grouped = useMemo(() => groupTokens(events), [events]);

  const filtered = useMemo(
    () =>
      grouped.filter((item: ProcessedTimelineEvent) => {
        if (filter && item.type !== filter && item.type !== "TOKEN_GROUP") {
          return false;
        }
        if (search) {
          const searchLower = search.toLowerCase();
          if (item.type === "TOKEN_GROUP") {
            return item.text.toLowerCase().includes(searchLower);
          }
          if (item.type === "TOOL_CALL" || item.type === "TOOL_RESULT") {
            return JSON.stringify(item).toLowerCase().includes(searchLower);
          }
        }

        return true;
      }),
    [grouped, filter, search]
  );

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-zinc-100">
      <div className="p-4 border-b border-zinc-700 space-y-3">
        <h2 className="text-lg font-bold">Protocol Timeline</h2>

        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1 rounded bg-zinc-800 text-sm text-zinc-100 border border-zinc-700"
          >
            <option value="">All Events</option>
            <option value="TOKEN_GROUP">Tokens</option>
            <option value="TOOL_CALL">Tool Calls</option>
            <option value="TOOL_RESULT">Tool Results</option>
            <option value="CONTEXT_SNAPSHOT">Context</option>
            <option value="PING">PING</option>
            <option value="PONG">PONG</option>
            <option value="ERROR">Errors</option>
          </select>

          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1 rounded bg-zinc-800 text-sm text-zinc-100 border border-zinc-700 flex-1"
          />
        </div>

        <div className="text-xs text-zinc-400">
          {filtered.length} of {grouped.length} events
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
        {filtered.map((item: ProcessedTimelineEvent, idx: number) => (
          <div key={idx} className="border-l-2 border-zinc-700 pl-3 py-1">
            {item.type === "TOKEN_GROUP" ? (
              <div>
                <button
                  onClick={() => toggleExpand(idx)}
                  className="text-blue-400 hover:text-blue-300 underline text-left w-full"
                >
                  📝 Tokens ({item.tokens.length}) · {item.text.length} chars
                </button>
                {expandedGroups.has(idx) && (
                  <div className="mt-2 p-2 bg-zinc-800 rounded text-zinc-300 whitespace-pre-wrap break-words">
                    {item.text}
                  </div>
                )}
              </div>
            ) : item.type === "TOOL_CALL" ? (
              <div className="text-yellow-400">
                🔧 TOOL_CALL [{item.seq}] {item.call_id}
                <button
                  onClick={() => toggleExpand(idx)}
                  className="ml-2 text-zinc-400 hover:text-zinc-300"
                >
                  {expandedGroups.has(idx) ? "▼" : "▶"}
                </button>
                {expandedGroups.has(idx) && (
                  <div className="mt-2 p-2 bg-zinc-800 rounded text-zinc-300">
                    <div>{item.tool_name}</div>
                    <pre className="text-xs mt-1 whitespace-pre-wrap">
                      {JSON.stringify(item.args, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : item.type === "TOOL_RESULT" ? (
              <div className="text-green-400">
                ✓ TOOL_RESULT [{item.seq}] {item.call_id}
                <button
                  onClick={() => toggleExpand(idx)}
                  className="ml-2 text-zinc-400 hover:text-zinc-300"
                >
                  {expandedGroups.has(idx) ? "▼" : "▶"}
                </button>
                {expandedGroups.has(idx) && (
                  <div className="mt-2 p-2 bg-zinc-800 rounded text-zinc-300">
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(item.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : item.type === "CONTEXT_SNAPSHOT" ? (
              <div className="text-purple-400">
               CONTEXT [{item.seq}] {item.context_id}
              </div>
            ) : item.type === "PING" ? (
              <div className="text-cyan-400">
               PING [{item.seq}]
              </div>
            ) : item.type === "PONG" ? (
              <div className="text-cyan-400">
               PONG [{item.seq}]
              </div>
            ) : (
              <div className="text-red-400">
                {item.type} {"seq" in item ? `[${item.seq}]` : ""}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}