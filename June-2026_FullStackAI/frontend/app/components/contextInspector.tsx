"use client";

import React, { useMemo, useState } from "react";

interface ContextInspectorProps {
  snapshots: Map<
    string,
    {
      contextId: string;
      data: Record<string, unknown>;
      receivedAt: number;
      previous?: Record<string, unknown>;
    }
  >;
}

function computeDiff(
  oldData: Record<string, unknown> | undefined,
  newData: Record<string, unknown>
): {
  added: string[];
  removed: string[];
  changed: string[];
} {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  const safeOldData = oldData || {};
  const oldKeys = new Set(Object.keys(safeOldData));
  const newKeys = new Set(Object.keys(newData));

  newKeys.forEach((key) => {
    if (!oldKeys.has(key)) {
      added.push(key);
    }
  });
  
  oldKeys.forEach((key) => {
    if (!newKeys.has(key)) {
      removed.push(key);
    }
  });

  oldKeys.forEach((key) => {
    if (
      newKeys.has(key) &&
      JSON.stringify(safeOldData[key]) !== JSON.stringify(newData[key])
    ) {
      changed.push(key);
    }
  });

  return { added, removed, changed };
}

function TreeNode({
  data,
  label,
  level = 0,
}: {
  data: unknown;
  label: string;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(level < 2);

  if (data === null || data === undefined) {
    return (
      <div style={{ marginLeft: `${level * 12}px` }} className="text-gray-500">
        {label}: null
      </div>
    );
  }

  if (typeof data !== "object") {
    return (
      <div style={{ marginLeft: `${level * 12}px` }} className="text-blue-400">
        {label}:{" "}
        <span className="text-green-400">
          {typeof data === "string" ? `"${data}"` : String(data)}
        </span>
      </div>
    );
  }

  if (Array.isArray(data)) {
    return (
      <div style={{ marginLeft: `${level * 12}px` }}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-blue-400 hover:text-blue-300 font-mono text-sm"
        >
          {expanded ? "▼" : "▶"} {label} [{data.length}]
        </button>
        {expanded && (
          <div>
            {data.map((item, i) => (
              <TreeNode key={i} data={item} label={`[${i}]`} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginLeft: `${level * 12}px` }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-blue-400 hover:text-blue-300 font-mono text-sm"
      >
        {expanded ? "▼" : "▶"} {label}
      </button>
      {expanded && (
        <div>
          {Object.entries(data as Record<string, unknown>).map(([key, value]) => (
            <TreeNode key={key} data={value} label={key} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContextInspector({ snapshots }: ContextInspectorProps) {
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);

  const latestSnapshot = useMemo(() => {
    if (snapshots.size === 0) return null;
    return Array.from(snapshots.values()).sort((a, b) => b.receivedAt - a.receivedAt)[0];
  }, [snapshots]);

  const selected = selectedContextId
    ? snapshots.get(selectedContextId) || latestSnapshot
    : latestSnapshot;

  if (!selected) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-900 text-zinc-400">
        No context snapshots yet
      </div>
    );
  }

  const diff = computeDiff(selected.previous, selected.data);

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-zinc-100">
      <div className="p-4 border-b border-zinc-700 space-y-3">
        <h2 className="text-lg font-bold">Context Inspector</h2>

        {snapshots.size > 1 && (
          <select
            value={selectedContextId || ""}
            onChange={(e) => setSelectedContextId(e.target.value || null)}
            className="w-full px-3 py-2 rounded bg-zinc-800 text-sm text-zinc-100 border border-zinc-700"
          >
            <option value="">Latest snapshot</option>
            {Array.from(snapshots.entries()).map(([id, snap]) => (
              <option key={id} value={id}>
                {id} ({new Date(snap.receivedAt).toLocaleTimeString()})
              </option>
            ))}
          </select>
        )}

        {selected.previous && (
          <div className="text-xs space-y-1">
            {diff.added.length > 0 && (
              <div className="text-green-400">✓ Added: {diff.added.join(", ")}</div>
            )}
            {diff.removed.length > 0 && (
              <div className="text-red-400">✗ Removed: {diff.removed.join(", ")}</div>
            )}
            {diff.changed.length > 0 && (
              <div className="text-yellow-400">~ Changed: {diff.changed.join(", ")}</div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm font-mono">
        <TreeNode data={selected.data} label={selected.contextId} level={0} />
      </div>
    </div>
  );
}