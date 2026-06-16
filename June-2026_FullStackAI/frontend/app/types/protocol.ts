export type ServerMessage =
  | TokenMessage
  | ToolCallMessage
  | ToolResultMessage
  | ContextSnapshotMessage
  | PingMessage
  | StreamEndMessage
  | ErrorMessage;

export interface TokenMessage {
  type: "TOKEN";
  seq: number;
  stream_id: string;
  text: string;
}

export interface ToolCallMessage {
  type: "TOOL_CALL";
  seq: number;
  stream_id: string;
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
}

export interface ToolResultMessage {
  type: "TOOL_RESULT";
  seq: number;
  stream_id: string;
  call_id: string;
  result: Record<string, unknown>;
}

export interface ContextSnapshotMessage {
  type: "CONTEXT_SNAPSHOT";
  seq: number;
  context_id: string;
  data: Record<string, unknown>;
}

export interface PingMessage {
  type: "PING";
  seq: number;
  challenge: string;
}

export interface StreamEndMessage {
  type: "STREAM_END";
  seq: number;
  stream_id: string;
}

export interface ErrorMessage {
  type: "ERROR";
  seq: number;
  code: string;
  message: string;
}

export type ClientMessage =
  | UserMessagePayload
  | PongPayload
  | ResumePayload
  | ToolAckPayload;

export interface UserMessagePayload {
  type: "USER_MESSAGE";
  content: string;
}

export interface PongPayload {
  type: "PONG";
  echo: string;
}

export interface ResumePayload {
  type: "RESUME";
  last_seq: number;
}

export interface ToolAckPayload {
  type: "TOOL_ACK";
  call_id: string;
}

export interface TokenGroupEvent {
  type: "TOKEN_GROUP";
  tokens: TimelineEvent[];
  text: string;
}

export type ProcessedTimelineEvent = TimelineEvent | TokenGroupEvent;

export type TokenTimelineEvent = Extract<TimelineEvent, { type: "TOKEN" }>;

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type TimelineEvent = ServerMessage & {
  timestamp: number;
  clientTimestamp?: number;
  processedAt?: number;
}