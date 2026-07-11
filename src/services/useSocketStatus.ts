/**
 * useSocket — centralises all socket connection state management.
 *
 * Tracks:
 *  - isConnected        : socket is currently live
 *  - isReconnecting     : socket lost connection and is trying to come back
 *  - reconnectAttempts  : how many reconnect attempts have been made
 *  - connectionQuality  : 'good' | 'degraded' | 'offline'
 *  - latency            : round-trip ping in ms (updated every 10s when connected)
 */
import { useEffect, useState, useCallback } from "react";
import { socket } from "./socket";

export type ConnectionQuality = "good" | "degraded" | "offline";

export interface SocketStatus {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  connectionQuality: ConnectionQuality;
  latency: number | null;
  reconnectNow: () => void;
}

export function useSocketStatus(): SocketStatus {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);

  // Measure latency with socket.io's built-in ping
  useEffect(() => {
    if (!isConnected) return;

    const measureLatency = () => {
      const start = Date.now();
      socket.emit("ping", () => {
        setLatency(Date.now() - start);
      });
    };

    measureLatency();
    const id = setInterval(measureLatency, 10_000);
    return () => clearInterval(id);
  }, [isConnected]);

  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setReconnectAttempts(0);
    };

    const onDisconnect = () => {
      setIsConnected(false);
      setLatency(null);
    };

    const onReconnectAttempt = (attempt: number) => {
      setIsReconnecting(true);
      setReconnectAttempts(attempt);
    };

    const onReconnect = () => {
      setIsReconnecting(false);
      setReconnectAttempts(0);
    };

    const onReconnectFailed = () => {
      setIsReconnecting(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect", onReconnect);
    socket.io.on("reconnect_failed", onReconnectFailed);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect", onReconnect);
      socket.io.off("reconnect_failed", onReconnectFailed);
    };
  }, []);

  const connectionQuality: ConnectionQuality = !isConnected
    ? "offline"
    : latency === null || latency < 200
    ? "good"
    : latency < 500
    ? "degraded"
    : "offline";

  const reconnectNow = useCallback(() => {
    if (!socket.connected) {
      socket.connect();
    }
  }, []);

  return {
    isConnected,
    isReconnecting,
    reconnectAttempts,
    connectionQuality,
    latency,
    reconnectNow,
  };
}
