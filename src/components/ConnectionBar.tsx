import { useSocketStatus } from "@/services/useSocketStatus";
import { Wifi, WifiOff, Loader2, RefreshCw, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConnectionBar() {
  const { isConnected, isReconnecting, reconnectAttempts, connectionQuality, transport, latency, reconnectNow } =
    useSocketStatus();

  if (isReconnecting) {
    return (
      <div className="fixed top-3 right-3 z-[100] flex items-center gap-2 bg-amber-950/90 border border-amber-500/40 text-amber-300 text-xs font-medium px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        <span>Reconnecting… ({reconnectAttempts})</span>
        <button onClick={reconnectNow} className="hover:text-white transition-colors ml-1" title="Retry now">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="fixed top-3 right-3 z-[100] flex items-center gap-2 bg-red-950/90 border border-red-500/40 text-red-300 text-xs font-medium px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
        <WifiOff className="h-3 w-3 shrink-0" />
        <span>Offline</span>
        <button onClick={reconnectNow} className="hover:text-white transition-colors ml-1" title="Reconnect">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    );
  }

  const isWs = transport === "websocket";
  const dotColor =
    connectionQuality === "good" ? "bg-emerald-400"
    : connectionQuality === "degraded" ? "bg-amber-400"
    : "bg-red-400";

  const colors =
    connectionQuality === "good"
      ? { text: "text-emerald-300", border: "border-emerald-500/25" }
      : connectionQuality === "degraded"
      ? { text: "text-amber-300", border: "border-amber-500/35" }
      : { text: "text-red-300", border: "border-red-500/35" };

  return (
    <div
      className={cn(
        "fixed top-3 right-3 z-[100] flex items-center gap-1.5 bg-black/60 border text-xs font-medium px-2.5 py-1 rounded-full shadow-md backdrop-blur-sm transition-all select-none",
        colors.border,
        colors.text
      )}
      title={`${isWs ? "WebSocket" : "HTTP Polling"} · ${latency ?? "—"}ms`}
    >
      {/* Quality dot */}
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor, connectionQuality === "good" && "animate-pulse")} />

      {/* Icon: Radio = WS, Wifi = polling */}
      {isWs ? <Radio className="h-3 w-3 shrink-0" /> : <Wifi className="h-3 w-3 shrink-0" />}

      {/* Transport + latency */}
      <span>
        {isWs ? "WS" : "Poll"}
        {latency !== null && ` · ${latency}ms`}
      </span>
    </div>
  );
}
