import { io, Socket } from "socket.io-client";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:3001")
  .replace(/\/$/, ""); // strip trailing slash

// ── CRITICAL: Start with polling, then upgrade to WebSocket ──────────────
//
// Render.com and many proxies block the initial WebSocket handshake
// but DO allow upgrading an existing HTTP polling connection to WebSocket.
// Starting with "polling" first and letting Socket.io auto-upgrade is the
// most reliable strategy across all hosting platforms.
//
// What happens:
//   1. Client opens HTTP long-poll connection  ← always works
//   2. Server sends "upgrade" packet
//   3. Client opens WebSocket alongside the polling
//   4. On success, polling is closed; pure WebSocket takes over
//   5. On failure (proxy blocks WS), polling continues silently
//
export const socket: Socket = io(BACKEND_URL, {
  autoConnect: false,

  // polling first → auto-upgrade to websocket
  transports: ["polling", "websocket"],
  upgrade: true,           // allow upgrade from polling → websocket
  rememberUpgrade: true,   // remember if WS worked last time (faster reconnects)

  // ── Reconnection ──────────────────────────────────────────────────────
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  randomizationFactor: 0.4,

  // ── Timeouts ──────────────────────────────────────────────────────────
  timeout: 20000,

  // ── Keep connection alive through proxy idle timeouts ─────────────────
  // Most platforms drop idle connections after 55–75s. pingInterval +
  // pingTimeout are the server-side settings; the client respects them.
  // We also emit our own heartbeat (below) as belt-and-suspenders.
});

// ── Heartbeat keep-alive ─────────────────────────────────────────────────
// Sends a lightweight packet every 20s so proxies never see the connection
// as "idle" and close it. 20s is safely below Render's ~55s idle timeout.
let _heartbeat: ReturnType<typeof setInterval> | null = null;

socket.on("connect", () => {
  // Log the actual transport in use after connection is established
  const engine = (socket as any).io?.engine;
  if (import.meta.env.DEV && engine) {
    console.log(`[socket] connected via ${engine.transport.name}`);
    engine.on("upgrade", () => {
      console.log(`[socket] upgraded to ${engine.transport.name}`);
    });
  }

  if (_heartbeat) clearInterval(_heartbeat);
  _heartbeat = setInterval(() => {
    if (socket.connected) {
      // Use a no-op emit — the packet itself keeps TCP alive
      socket.volatile.emit("heartbeat");
    }
  }, 20_000);
});

socket.on("disconnect", () => {
  if (_heartbeat) { clearInterval(_heartbeat); _heartbeat = null; }
});

// ── Dev-mode full event logging ──────────────────────────────────────────
if (import.meta.env.DEV) {
  socket.onAny((event, ...args) => {
    console.log(`[socket ↓] ${event}`, args.length ? args : "");
  });
  socket.onAnyOutgoing((event, ...args) => {
    console.log(`[socket ↑] ${event}`, args.length ? args : "");
  });
}

export const BACKEND_URL_DISPLAY = BACKEND_URL;
