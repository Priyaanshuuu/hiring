"use client";

import React, {
  createContext,
  useReducer,
  ReactNode,
  useRef,
} from "react";
import { TimelineEvent, ConnectionState } from "../types/protocol";
import { MessageBuffer } from "../lib/message_buffer";

// Global state shape
export interface AgentState {
  connectionState: ConnectionState;
  currentStream: {
    streamId: string;
    tokens: string[];
    isPaused: boolean; // True when TOOL_CALL arrives
  };
  toolCalls: Map<
    string,
    {
      callId: string;
      toolName: string;
      args: Record<string, unknown>;
      result?: Record<string, unknown>;
      ackReceivedAt?: number;
    }
  >;
  contextSnapshots: Map<
    string,
    {
      contextId: string;
      data: Record<string, unknown>;
      receivedAt: number;
      previous?: Record<string, unknown>;
    }
  >;
  timeline: TimelineEvent[];
  error: string | null;
  lastProcessedSeq: number;
}

type AgentAction =
  | { type: "SET_CONNECTION_STATE"; state: ConnectionState }
  | { type: "ADD_TOKENS"; streamId: string; tokens: string[] }
  | { type: "PAUSE_STREAM"; streamId: string }
  | { type: "RESUME_STREAM"; streamId: string }
  | { type: "ADD_TOOL_CALL"; callId: string; toolName: string; args: Record<string, unknown> }
  | { type: "ACK_TOOL_CALL"; callId: string }
  | { type: "ADD_TOOL_RESULT"; callId: string; result: Record<string, unknown> }
  | { type: "ADD_CONTEXT_SNAPSHOT"; contextId: string; data: Record<string, unknown> }
  | { type: "ADD_TIMELINE_EVENT"; event: TimelineEvent }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET_STREAM" }
  | { type: "UPDATE_LAST_PROCESSED_SEQ"; seq: number }
  | { type: "CLEAR_TIMELINE" };

export const AgentContext = createContext<{
  state: AgentState;
  dispatch: React.Dispatch<AgentAction>;
  messageBuffer: MessageBuffer;
} | null>(null);

const initialState: AgentState = {
  connectionState: "disconnected",
  currentStream: {
    streamId: "",
    tokens: [],
    isPaused: false,
  },
  toolCalls: new Map(),
  contextSnapshots: new Map(),
  timeline: [],
  error: null,
  lastProcessedSeq: -1,
};

function agentReducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case "SET_CONNECTION_STATE":
      return { ...state, connectionState: action.state };

    case "ADD_TOKENS":
      return {
        ...state,
        currentStream: {
          ...state.currentStream,
          streamId: action.streamId,
          tokens: [...state.currentStream.tokens, ...action.tokens],
        },
      };

    case "PAUSE_STREAM":
      return {
        ...state,
        currentStream: {
          ...state.currentStream,
          isPaused: true,
        },
      };

    case "RESUME_STREAM":
      return {
        ...state,
        currentStream: {
          ...state.currentStream,
          isPaused: false,
        },
      };

    case "ADD_TOOL_CALL": {
      const toolCalls = new Map(state.toolCalls);
      toolCalls.set(action.callId, {
        callId: action.callId,
        toolName: action.toolName,
        args: action.args,
      });
      return { ...state, toolCalls };
    }

    case "ACK_TOOL_CALL": {
      const toolCalls = new Map(state.toolCalls);
      const existing = toolCalls.get(action.callId);
      if (existing) {
        toolCalls.set(action.callId, {
          ...existing,
          ackReceivedAt: Date.now(),
        });
      }
      return { ...state, toolCalls };
    }

    case "ADD_TOOL_RESULT": {
      const toolCalls = new Map(state.toolCalls);
      const existing = toolCalls.get(action.callId);
      if (existing) {
        toolCalls.set(action.callId, {
          ...existing,
          result: action.result,
        });
      }
      return { ...state, toolCalls };
    }

    case "ADD_CONTEXT_SNAPSHOT": {
      const contextSnapshots = new Map(state.contextSnapshots);
      const existing = contextSnapshots.get(action.contextId);
      contextSnapshots.set(action.contextId, {
        contextId: action.contextId,
        data: action.data,
        receivedAt: Date.now(),
        previous: existing?.data,
      });
      return { ...state, contextSnapshots };
    }

    case "ADD_TIMELINE_EVENT":
      return {
        ...state,
        timeline: [...state.timeline, action.event],
      };

    case "SET_ERROR":
      return { ...state, error: action.error };

    case "RESET_STREAM":
      return {
        ...state,
        currentStream: {
          streamId: "",
          tokens: [],
          isPaused: false,
        },
        toolCalls: new Map(),
        contextSnapshots: new Map(),
      };

    case "UPDATE_LAST_PROCESSED_SEQ":
      return { ...state, lastProcessedSeq: action.seq };

    case "CLEAR_TIMELINE":
      return { ...state, timeline: [] };

    default:
      return state;
  }
}

// Provider component
export function AgentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(agentReducer, initialState);
  const messageBufferRef = useRef(new MessageBuffer());

  return (
    <AgentContext.Provider
      value={{
        state,
        dispatch,
        messageBuffer: messageBufferRef.current,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

// Hook to use context
export function useAgent() {
  const context = React.useContext(AgentContext);
  if (!context) {
    throw new Error("useAgent must be used within AgentProvider");
  }
  return context;
}