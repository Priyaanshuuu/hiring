# Agent Server Analysis Report
**Full Stack AI Engineer Internship Assignment**

---

## Executive Summary

The `agent-server` is a **mock AI agent backend** that simulates a context-aware AI agent streaming responses over WebSocket. It serves as the reference implementation for the Frontend assignment. The server is **pre-built and not to be modified** — your job is to build a frontend client that connects to it and handles all protocol requirements.

**Key Point**: The server is production-ready in a Docker container and tests your frontend's ability to handle real-world streaming challenges including heartbeats, tool calls, context management, and chaos/failure conditions.

---

## Project Structure

```
agent-server/
├── Dockerfile           # Multi-stage Docker build (Node 20)
├── package.json         # Dependencies: ws (WebSocket), TypeScript
├── tsconfig.json        # TypeScript configuration
├── README.md            # Quick start guide
├── test.mjs             # Test file (reference)
└── src/
    ├── index.ts         # CLI entry point & argument parsing
    ├── server.ts        # Main AgentServer class (400+ lines)
    ├── types.ts         # Protocol type definitions
    ├── scripts.ts       # Response scripts & trigger keywords
    └── chaos.ts         # Chaos engine for failure injection
```

---

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | ≥20.0.0 |
| WebSocket | `ws` | ^8.18.0 |
| Language | TypeScript | ^5.5.0 |
| Type Support | @types/node, @types/ws | Latest |
| DevTools | tsx, typescript | Latest |
| Container | Docker | Alpine Node 20 |

### Key Dependencies:
- **`ws`** — Industry-standard WebSocket library
- **`typescript`** — Compiled to ES2020+
- **Multi-stage Docker build** — Optimized production image (~200MB)

---

## Core Architecture

### 1. **Server Modes**

#### Normal Mode
- Simulates ideal conditions
- Predictable message delivery
- Used for development and basic testing

#### Chaos Mode (`--mode chaos`)
- Randomly injects real-world failures per connection
- Different chaos profile on every connection (can't hard-code)
- Failures include:
  - **Connection drops** (hard terminate mid-stream)
  - **Out-of-order delivery** (messages shuffled with 15-35% probability)
  - **Duplicates** (same message sent twice, 5-15% probability)
  - **Latency spikes** (2-6 second delays, 5-13% probability)
  - **Corrupt heartbeats** (empty `challenge` field, 15-25% probability)
  - **Oversized payloads** (500KB+ context snapshots)
  - **Drop after N messages** (15-45 messages, ~50% of connections)

### 2. **WebSocket Protocol**

#### Message Flow
```
Client connects → Server sends PING → Client sends PONG (3s timeout)
                                    ↓
                            Server sends TOKEN(s)
                            Server sends TOOL_CALL
                            Client sends TOOL_ACK
                            Server sends TOOL_RESULT
                                    ↓
                            Server sends CONTEXT_SNAPSHOT
                                    ↓
                            Server sends STREAM_END
                                    ↓
                        Continue with next USER_MESSAGE
```

#### Server → Client Messages

| Type | Fields | Purpose |
|------|--------|---------|
| **TOKEN** | seq, stream_id, text | Streaming response tokens |
| **TOOL_CALL** | seq, stream_id, call_id, tool_name, args | Request tool execution |
| **TOOL_RESULT** | seq, stream_id, call_id, result | Tool output data |
| **CONTEXT_SNAPSHOT** | seq, context_id, data | Full context state (~500KB) |
| **PING** | seq, challenge | Heartbeat (every 12 seconds) |
| **STREAM_END** | seq, stream_id | Marks end of response |
| **ERROR** | seq, code, message | Protocol/logic error |

#### Client → Server Messages

| Type | Fields | Purpose |
|------|--------|---------|
| **USER_MESSAGE** | content | Send prompt/query to agent |
| **PONG** | echo | Respond to PING (must arrive within 3s) |
| **TOOL_ACK** | call_id | Confirm tool call rendered on UI |
| **RESUME** | last_seq | Reconnect & recover missed events |

### 3. **Sequence Numbers (`seq`)**

- **Monotonically increasing** per connection
- Starts at 0, increments for every server message
- Used to detect missed/duplicate messages
- Critical for **RESUME**: client sends `last_seq`, server replays `seq > last_seq`

### 4. **Heartbeat Protocol**

- **Interval**: 12 seconds
- **Timeout**: 3 seconds for PONG response
- **Starts**: 2 seconds after connection established
- **Tracking**: Server counts missed PONGs; disconnects after 3 consecutive misses
- **In Chaos Mode**: `challenge` field can be corrupted (empty string)

### 5. **Tool Call Flow**

```
1. Server sends TOOL_CALL (seq=5, call_id="call_abc123")
2. Frontend renders tool card/button
3. Frontend immediately sends TOOL_ACK (call_id="call_abc123")
4. Server logs the ACK timestamp (evaluators check ACK latency)
5. Server sends TOOL_RESULT (seq=6, call_id="call_abc123")
```

**Critical**: ACK must be sent **immediately** when rendered, not when result arrives.

---

## HTTP Endpoints

### `GET /health`
Returns JSON status:
```json
{
  "status": "ok",
  "mode": "normal" | "chaos",
  "connected": true | false,
  "seq": 42,
  "historyLength": 150
}
```

### `GET /log`
Returns JSON array of all client events logged by server:
```json
[
  {
    "type": "USER_MESSAGE",
    "payload": { "content": "..." },
    "verdict": "ok" | "violation" | "error" | "unexpected"
  },
  {
    "type": "PONG",
    "payload": { "echo": "..." },
    "verdict": "ok"
  }
]
```
**This is how evaluators verify your client's protocol compliance.**

### `GET /reset`
Clears session history and logs. Returns: `{ "status": "reset" }`

### `OPTIONS` (CORS Preflight)
Returns 204 No Content with CORS headers for local development.

---

## Response Trigger Keywords

The server selects different "scripts" based on keywords in `USER_MESSAGE.content`:

| Keywords | Script Name | What It Tests |
|----------|-------------|---------------|
| hello, hi, hey, greetings | Simple Greeting | Token streaming (no tool calls) |
| report, summary, q3, q4, earnings | Report Summary | 1 tool call mid-stream + context updates |
| analyze, compare, correlation | Multi-Tool Analysis | 2 sequential tool calls |
| lookup, find, search | Knowledge Base Lookup | Tool call **before** any tokens |
| schema, database, large | Large Context | 500KB+ context snapshot + tool call |
| long, detailed, document | Long Response | Many tokens (100+) + tool call |
| *(anything else)* | Default | Moderate response (1 tool call) |

**Example**:
- `"hello"` → Streaming greeting without tool calls
- `"analyze the data"` → Multi-tool scenario with two tool calls
- `"find users"` → Immediate tool call, then tokens
- `"large schema"` → 500KB+ payload stress test

---

## Response Script Structure

Each script defines a sequence of events:

```typescript
{
  id: "report_summary",
  name: "Report Summary",
  triggers: ["report", "summary", ...],
  events: [
    { kind: "context", context_id: "...", data: {...} },
    { kind: "token", text: "Hello " },
    { kind: "token", text: "world" },
    { 
      kind: "tool_call", 
      tool_name: "lookup_metric", 
      args: { metric: "revenue_yoy" },
      result: { value: "23.4%", ... }
    },
    { kind: "context", context_id: "...", data: {...} },
    { kind: "token", text: "The result is..." },
  ]
}
```

---

## Chaos Engine Details

### Chaos Config (Randomized Per Connection)

```typescript
{
  dropAfterMessages: 15 | 30 | 45 | null,      // ~50% null
  reorderProbability: 0.15 - 0.35,             // 15-35%
  duplicateProbability: 0.05 - 0.15,           // 5-15%
  latencySpikeProbability: 0.05 - 0.13,        // 5-13%
  latencySpikeMs: [2000, 8000],                // 2-8 seconds
  corruptPingProbability: 0.15 - 0.25          // 15-25%
}
```

### Chaos Effects

1. **Out-of-Order Delivery**
   - Messages buffered in groups of 4
   - Shuffled before sending
   - Same `seq` numbers but wrong order
   - **Your frontend must reorder by `seq`**

2. **Duplicate Messages**
   - Same `seq` sent twice
   - **Your frontend must deduplicate by `seq`**

3. **Connection Drop**
   - Hard terminate (no WebSocket close frame)
   - Happens after N messages
   - **Your frontend must detect & reconnect with RESUME**

4. **Latency Spikes**
   - 2-8 second delays between messages
   - **Your frontend must handle timeout gracefully**

5. **Corrupt Heartbeats**
   - PING with empty `challenge: ""`
   - **Your frontend must still respond with PONG**

---

## Running the Server

### Docker (Recommended for Deployment)
```bash
# Build image
docker build -t agent-server .

# Normal mode
docker run -p 4747:4747 agent-server

# Chaos mode
docker run -p 4747:4747 agent-server --mode chaos

# Custom port
docker run -p 8080:8080 agent-server --port 8080
```

### Local Development
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run (normal mode, port 4747)
npm start

# Run (chaos mode)
npm start -- --mode chaos

# Run (custom port)
npm start -- --port 8080

# Development with tsx (hot reload)
npm run dev
```

### CLI Arguments
```
--mode <normal|chaos>   Server mode (default: normal)
--port <number>         Port to listen on (default: 4747)
--help, -h              Show help message
```

---

## Protocol Compliance Checklist (for Your Frontend)

### Connection & Heartbeat
- [ ] Connect to `ws://localhost:4747/ws`
- [ ] Receive PING and respond with PONG within 3 seconds
- [ ] Include exact `challenge` value in PONG `echo` field
- [ ] Handle corrupted PING (empty challenge) gracefully

### Message Handling
- [ ] Buffer all messages with `seq` numbers
- [ ] Deduplicate by `seq` (reject duplicates)
- [ ] Reorder messages by `seq` if delivered out-of-order
- [ ] Parse TOKEN and stream incrementally
- [ ] Render TOOL_CALL cards/buttons immediately
- [ ] Send TOOL_ACK immediately when rendered (not when result arrives)
- [ ] Display TOOL_RESULT when it arrives
- [ ] Update UI with CONTEXT_SNAPSHOT data
- [ ] Handle STREAM_END to mark response complete
- [ ] Handle ERROR messages gracefully

### Reconnection (RESUME)
- [ ] Detect connection drop (WebSocket `close` event)
- [ ] Send RESUME with last received `seq`
- [ ] Server will replay all `seq > last_seq`
- [ ] Merge replayed messages with local buffer
- [ ] Resume UI rendering from last known state

### Logging & Verification
- [ ] Poll `/log` endpoint to verify protocol compliance
- [ ] Check `verdict` field: `ok`, `violation`, `error`, `unexpected`
- [ ] Identify and fix any violations
- [ ] Ensure no late PONGs, missed ACKs, or protocol violations

---

## Key Design Decisions

### Why WebSocket?
- Real-time streaming of tokens
- Bi-directional communication for ACKs and heartbeats
- Persistent connection for RESUME

### Why Single-Session Server?
- Simulates a real agent serving one user
- Simplifies state management
- Forces frontend to handle reconnection correctly

### Why Chaos Mode?
- Tests production readiness
- Catches timing bugs (race conditions, timeouts)
- Ensures frontend degrades gracefully under failure

### Why Tool Call ACKs?
- Validates that UI rendering is complete before tool executes
- Measures frontend latency
- Simulates real-world tool call workflow

---

## Evaluator Workflow

Evaluators will:

1. **Start the server** (normal & chaos modes)
2. **Connect your frontend** to `ws://localhost:4747/ws`
3. **Send user messages** with various trigger keywords
4. **Verify proper handling** of:
   - All message types
   - Heartbeats (PING/PONG)
   - Tool ACKs (timing & correctness)
   - CONTEXT_SNAPSHOT updates
   - Out-of-order messages (chaos)
   - Connection drops & RESUME
5. **Check `/log` endpoint** for protocol violations
6. **Run chaos mode** and verify graceful degradation

---

## Common Pitfalls

❌ **Not deduplicating by `seq`** → Duplicate UI elements  
❌ **Not reordering by `seq`** → Out-of-order content in chaos mode  
❌ **Missing PONG responses** → Server disconnects after 3 misses  
❌ **Late TOOL_ACKs** → Appears in logs as slow UI rendering  
❌ **Not sending TOOL_ACK immediately** → Evaluators see violations  
❌ **Not handling connection drop** → Session lost, no RESUME  
❌ **Ignoring chaos failures** → Crashes in production conditions  
❌ **Not parsing context_id correctly** → CONTEXT_SNAPSHOT not applied  

---

## Files Quick Reference

| File | Purpose | Lines |
|------|---------|-------|
| [server.ts](src/server.ts) | Main server class, WebSocket handler, HTTP endpoints | 500+ |
| [types.ts](src/types.ts) | All protocol type definitions | 100+ |
| [scripts.ts](src/scripts.ts) | Response scripts & trigger logic | 500+ |
| [chaos.ts](src/chaos.ts) | Chaos engine for failure injection | 150+ |
| [index.ts](src/index.ts) | CLI entry point & argument parsing | 80 |

---

## What You Need to Build

Your **frontend** must:

1. **Connect** to WebSocket at `ws://localhost:4747/ws`
2. **Handle all message types** correctly
3. **Stream tokens** to UI in real-time
4. **Render tool calls** immediately with ACK
5. **Manage context** snapshots
6. **Keep heartbeat alive** with PONG
7. **Deduplicate** messages by `seq`
8. **Reorder** out-of-order messages
9. **Detect & reconnect** on drops
10. **Send user messages** with keywords to test different scripts
11. **Verify protocol** via `/log` endpoint

---

## Summary

| Aspect | Detail |
|--------|--------|
| **Purpose** | Mock AI agent for frontend testing |
| **Protocol** | WebSocket with bi-directional messaging |
| **Modes** | Normal (predictable) & Chaos (failure injection) |
| **Key Challenge** | Handle out-of-order, duplicates, drops, & latency |
| **Endpoints** | `/ws` (WebSocket), `/health`, `/log`, `/reset` |
| **Heartbeat** | PING every 12s, PONG response required within 3s |
| **Tool Calls** | ACK must be sent immediately when rendered |
| **Reconnection** | RESUME with last_seq to replay missed messages |
| **Your Job** | Build a frontend that handles all of this correctly |

---

**Last Updated**: 2025-06-15  
**Status**: Ready for Frontend Development
