"use client";

import { useEffect, useCallback, useRef } from "react";
import { WebSocketManager } from "../lib/webSocket_Manager";
import { ServerMessage, ToolCallMessage, TokenMessage , ErrorMessage , ToolResultMessage} from "../types/protocol";
import { useAgent } from "../context/agent_context";

export function useWebSocket(url: string) {
  const { state, dispatch, messageBuffer } = useAgent();

  const wsManagerRef = useRef<WebSocketManager | null>(null);

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      const ready = messageBuffer.add(message);

      for (const msg of ready) {
        dispatch({
          type: "ADD_TIMELINE_EVENT",
          event: { ...msg, timestamp: Date.now() },
        });

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

            setTimeout(() => {
              wsManagerRef.current?.send({
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
            const resultMsg = msg as ToolResultMessage;
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
            const ctxMsg = msg;
            dispatch({
              type: "ADD_CONTEXT_SNAPSHOT",
              contextId: ctxMsg.context_id,
              data: ctxMsg.data,
            });
            break;
          }

          case "STREAM_END": {
            break;
          }

          case "ERROR": {
            const errMsg = msg as ErrorMessage;
            dispatch({
              type: "SET_ERROR",
              error: `${errMsg.code}: ${errMsg.message}`,
            });
            break;
          }
        }
        dispatch({
          type: "UPDATE_LAST_PROCESSED_SEQ",
          seq: msg.seq,
        });
      }
    },
    [dispatch, messageBuffer]
  );

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

  const handleDisconnect = useCallback(() => {
    dispatch({
      type: "SET_CONNECTION_STATE",
      state: "reconnecting",
    });
  }, [dispatch]);

  const handleError = useCallback(
    (error: Error) => {
      dispatch({
        type: "SET_ERROR",
        error: error.message,
      });
    },
    [dispatch]
  );

  useEffect(() => {
    const manager = new WebSocketManager({
      url,
      onMessage: handleMessage,
      onConnect: handleConnect,
      onDisconnect: handleDisconnect,
      onError: handleError,
    });

    wsManagerRef.current = manager;

    dispatch({
      type: "SET_CONNECTION_STATE",
      state: "connecting",
    });

    (async () => {
      try {
        await manager.connect();
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: `Failed to connect: ${err}`,
        });
      }
    })();

    return () => {
      manager.close();
      wsManagerRef.current = null;
    };
  }, [url, dispatch, handleMessage, handleConnect, handleDisconnect, handleError]);

  const sendUserMessage = useCallback(
    (content: string) => {
      const manager = wsManagerRef.current;
      if (manager?.isConnected()) {
        manager.send({
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
    isConnected: wsManagerRef.current?.isConnected() ?? false,
  };
}