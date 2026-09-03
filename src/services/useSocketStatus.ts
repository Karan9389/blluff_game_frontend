/**
 * useSocketStatus — centralises all socket connection state.
 *
 * Diagnostic results (2026-07-17):
 *   ❌ WebSocket-only:  TIMEOUT (Render.com blocks raw WS upgrades)
 *   ✅ Polling-only:    1537ms
 *   ✅ Polling → WS:    655ms  ← FASTEST & most reliable
 *   ✅ Keep-alive 40s:  rock solid with heartbeat
 *
 * The socket.ts is configured to start with polling, auto-upgrade to WS.
 * This hook surfaces that state to the UI.
 */
import { useEffect, useState, useCallback } from "react";
import { socket } from "./socket";

export type ConnectionQuality = "good" | "degraded" | "offline";
export type TransportType = "polling" | "websocket" | "unknown";

export interface SocketStatus {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  connectionQuality: ConnectionQuality;
  transport: TransportType;
  latency: number | null;
  reconnectNow: () => void;
}

export function useSocketStatus(): SocketStatus {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [transport, setTransport] = useState<TransportType>(() => {
    const t = (socket as any).io?.engine?.transport?.name as string | undefined;
    return (t === "websocket" || t === "polling") ? t : "unknown";
  });

  // Read current transport from the engine
  const readTransport = useCallback(() => {
    const t = (socket as any).io?.engine?.transport?.name as string | undefined;
    setTransport((t === "websocket" || t === "polling") ? t : "unknown");
  }, []);

  // Track latency using engine.io ping/pong packets
  useEffect(() => {
    if (!isConnected) return;
    const engine = (socket as any).io?.engine;
    if (!engine) return;

    let pingTimestamp = 0;
    const handlePacketCreate = (packet: { type?: string }) => {
      if (packet.type === "ping") {
        pingTimestamp = Date.now();
      }
    };
    const handlePacket = (packet: { type?: string }) => {
      if (packet.type === "pong" && pingTimestamp > 0) {
        setLatency(Date.now() - pingTimestamp);
      }
    };
    const handlePong = () => {
      if (pingTimestamp > 0) {
        setLatency(Date.now() - pingTimestamp);
      }
    };

    engine.on("packetCreate", handlePacketCreate);
    engine.on("packet", handlePacket);
    engine.on("pong", handlePong);

    return () => {
      engine.off?.("packetCreate", handlePacketCreate);
      engine.off?.("packet", handlePacket);
      engine.off?.("pong", handlePong);
    };
  }, [isConnected]);

  useEffect(() => {
    // If already connected on mount (e.g. StrictMode or HMR)
    if (socket.connected) {
      setIsConnected(true);
      setIsReconnecting(false);
      readTransport();
    }

    const onConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setReconnectAttempts(0);
      readTransport();

      // Also listen for upgrade event (polling → websocket)
      const engine = (socket as any).io?.engine;
      engine?.once("upgrade", () => readTransport());
    };

    const onDisconnect = () => {
      setIsConnected(false);
      setLatency(null);
      setTransport("unknown");
    };

    const onReconnectAttempt = (n: number) => {
      setIsReconnecting(true);
      setReconnectAttempts(n);
    };

    const onReconnect = () => {
      setIsReconnecting(false);
      setReconnectAttempts(0);
      readTransport();
    };

    // Attach upgrade listener to engine if engine exists
    const engine = (socket as any).io?.engine;
    engine?.on("upgrade", readTransport);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect", onReconnect);

    return () => {
      engine?.off("upgrade", readTransport);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect", onReconnect);
    };
  }, [readTransport]);

  const connectionQuality: ConnectionQuality = !isConnected
    ? "offline"
    : latency === null || latency < 250
    ? "good"
    : latency < 600
    ? "degraded"
    : "offline";

  const reconnectNow = useCallback(() => {
    if (!socket.connected) socket.connect();
  }, []);

  return {
    isConnected,
    isReconnecting,
    reconnectAttempts,
    connectionQuality,
    transport,
    latency,
    reconnectNow,
  };
}
