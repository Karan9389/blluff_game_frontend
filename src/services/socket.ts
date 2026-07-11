import { io, Socket } from "socket.io-client";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:3001")
  .replace(/\/$/, ""); // strip trailing slash

export const socket: Socket = io(BACKEND_URL, {
  autoConnect: false,

  // ── Transport: try WebSocket first, fall back to polling ──────────────────
  // This is critical for Railway — it fully supports WebSocket, so we prefer
  // it. The fallback ensures we never get stuck if WS is blocked by a proxy.
  transports: ["websocket", "polling"],

  // ── Reconnection ──────────────────────────────────────────────────────────
  reconnection: true,
  reconnectionAttempts: Infinity, // keep trying forever
  reconnectionDelay: 1000,        // start retrying after 1s
  reconnectionDelayMax: 8000,     // cap at 8s between retries
  randomizationFactor: 0.3,       // jitter to avoid thundering herd

  // ── Timeouts ──────────────────────────────────────────────────────────────
  timeout: 20000,                 // connection attempt timeout (ms)
  ackTimeout: 10000,              // acknowledgement timeout

  // ── Auth / headers — add if your Railway backend needs CORS auth ──────────
  // withCredentials: true,
});

// ── Heartbeat keep-alive ──────────────────────────────────────────────────
// Railway (and similar platforms) will idle-close sockets after ~60s of
// silence. Sending a lightweight ping every 25s keeps the connection alive.
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

socket.on("connect", () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (socket.connected) {
      socket.emit("ping"); // most backends silently ignore unknown events
    }
  }, 25_000);
});

socket.on("disconnect", () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
});

// ── Debug helpers (stripped in production builds) ─────────────────────────
if (import.meta.env.DEV) {
  socket.onAny((event, ...args) => {
    console.log(`[socket ↓] ${event}`, args);
  });
  socket.onAnyOutgoing((event, ...args) => {
    console.log(`[socket ↑] ${event}`, args);
  });
}

export const BACKEND_URL_DISPLAY = BACKEND_URL;
