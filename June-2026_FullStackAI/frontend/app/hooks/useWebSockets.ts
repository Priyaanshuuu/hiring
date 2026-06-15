"use client";

import { useEffect, useCallback } from "react";
import { WebSocketManager } from "../lib/webSocket_Manager";
import { ServerMessage, ToolCallMessage, TokenMessage } from "../types/protocol";
import { useAgent } from "../context/agent_context";

/**
 * MAIN HOOK: Orchestrates entire WebSocket protocol handling
 *
 * This is where the MAGIC happens:
 * 1. Connect to server
 * 2. Buffer and reorder messages by seq
 * 3. Update global state as messages arrive
 * 4. Send TOOL_ACKs immediately
 * 5. Handle PING/PONG heartbeats
 * 6. Detect disconnects and send RESUME
 */
export function useWebSocket(url: string) {
  const { state, dispatch, messageBuffer } = useAgent();

  // Callback: Handle incoming server messages
  const handleMessage = useCallback(
    (message: ServerMessage) => {
      // Add to buffer for seq-based reordering
      const ready = messageBuffer.add(message);

      // Process all ready (contiguous) messages
      for (const msg of ready) {
        dispatch({
          type: "ADD_TIMELINE_EVENT",
          event: { ...msg, timestamp: Date.now() },
        });

        // Route based on message type
        switch (msg.type) {
          case "TOKEN": {
            const tokenMsg = msg as TokenMessage;
            dispatch({
              type: "ADD_TOKENS",
              streamId: tokenMsg.stream_id,
              tokens: [tokenMsg.text],
            });
            break;
          }

          case "TOOL_CALL": {
            const toolMsg = msg as ToolCallMessage;
            dispatch({
              type: "PAUSE_STREAM",
              streamId: toolMsg.stream_id,
            });
            dispatch({
              type: "ADD_TOOL_CALL",
              callId: toolMsg.call_id,
              toolName: toolMsg.tool_name,
              args: toolMsg.args,
            });

            // CRITICAL: Send ACK immediately
            setTimeout(() => {
              wsManager?.send({
                type: "TOOL_ACK",
                call_id: toolMsg.call_id,
              });
              dispatch({
                type: "ACK_TOOL_CALL",
                callId: toolMsg.call_id,
              });
            }, 0);

            break;
          }

          case "TOOL_RESULT": {
            const resultMsg = msg as any;
            dispatch({
              type: "ADD_TOOL_RESULT",
              callId: resultMsg.call_id,
              result: resultMsg.result,
            });
            dispatch({
              type: "RESUME_STREAM",
              streamId: resultMsg.stream_id,
            });
            break;
          }

          case "CONTEXT_SNAPSHOT": {
            const ctxMsg = msg as any;
            dispatch({
              type: "ADD_CONTEXT_SNAPSHOT",
              contextId: ctxMsg.context_id,
              data: ctxMsg.data,
            });
            break;
          }

          case "STREAM_END": {
            // Optional: mark stream as complete
            break;
          }

          case "ERROR": {
            const errMsg = msg as any;
            dispatch({
              type: "SET_ERROR",
              error: `${errMsg.code}: ${errMsg.message}`,
            });
            break;
          }
        }

        // Update the highest seq we've processed
        dispatch({
          type: "UPDATE_LAST_PROCESSED_SEQ",
          seq: msg.seq,
        });
      }
    },
    [dispatch, messageBuffer]
  );

  // Callback: Handle connection
  const handleConnect = useCallback(() => {
    dispatch({
      type: "SET_CONNECTION_STATE",
      state: "connected",
    });
    dispatch({
      type: "SET_ERROR",
      error: null,
    });
  }, [dispatch]);

  // Callback: Handle disconnection
  const handleDisconnect = useCallback(
    (code?: number, reason?: string) => {
      dispatch({
        type: "SET_CONNECTION_STATE",
        state: "reconnecting",
      });

      // If we have a lastProcessedSeq, send RESUME after reconnect
      // The reconnect will happen automatically in WebSocketManager
    },
    [dispatch]
  );

  // Callback: Handle error
  const handleError = useCallback(
    (error: Error) => {
      dispatch({
        type: "SET_ERROR",
        error: error.message,
      });
    },
    [dispatch]
  );

  // Create WebSocket manager
  const wsManager = new WebSocketManager({
    url,
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onError: handleError,
  });

  // Connect on mount
  useEffect(() => {
    dispatch({
      type: "SET_CONNECTION_STATE",
      state: "connecting",
    });

    (async () => {
      try {
        await wsManager.connect();
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: `Failed to connect: ${err}`,
        });
      }
    })();

    return () => {
      wsManager.close();
    };
  }, [url, dispatch]);

  // Send user message
  const sendUserMessage = useCallback(
    (content: string) => {
      if (wsManager.isConnected()) {
        wsManager.send({
          type: "USER_MESSAGE",
          content,
        });
        dispatch({ type: "RESET_STREAM" });
      } else {
        dispatch({
          type: "SET_ERROR",
          error: "Not connected to server",
        });
      }
    },
    [dispatch]
  );

  return {
    sendUserMessage,
    connectionState: state.connectionState,
    isConnected: wsManager.isConnected(),
  };
}