/**
 * ConnectionBar — a sticky status pill shown in the top-right corner.
 * Shows connection quality, latency, and reconnect progress.
 */
import { useSocketStatus } from "@/services/useSocketStatus";
import { Wifi, WifiOff, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConnectionBar() {
  const { isConnected, isReconnecting, reconnectAttempts, connectionQuality, latency, reconnectNow } =
    useSocketStatus();

  if (isReconnecting) {
    return (
      <div className="fixed top-3 right-3 z-[100] flex items-center gap-2 bg-amber-950/90 border border-amber-500/50 text-amber-300 text-xs font-medium px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
        <Loader2 className="h-3 w-3 animate-spin" />
        Reconnecting… (attempt {reconnectAttempts})
        <button
          onClick={reconnectNow}
          className="ml-1 hover:text-white transition-colors"
          title="Try now"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="fixed top-3 right-3 z-[100] flex items-center gap-2 bg-red-950/90 border border-red-500/50 text-red-300 text-xs font-medium px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
        <WifiOff className="h-3 w-3" />
        Offline
        <button
          onClick={reconnectNow}
          className="ml-1 hover:text-white transition-colors"
          title="Reconnect"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
    );
  }

  const dotColor =
    connectionQuality === "good"
      ? "bg-emerald-400"
      : connectionQuality === "degraded"
      ? "bg-amber-400"
      : "bg-red-400";

  const textColor =
    connectionQuality === "good"
      ? "text-emerald-300"
      : connectionQuality === "degraded"
      ? "text-amber-300"
      : "text-red-300";

  const borderColor =
    connectionQuality === "good"
      ? "border-emerald-500/30"
      : connectionQuality === "degraded"
      ? "border-amber-500/40"
      : "border-red-500/40";

  return (
    <div
      className={cn(
        "fixed top-3 right-3 z-[100] flex items-center gap-1.5 bg-black/60 border text-xs font-medium px-2.5 py-1 rounded-full shadow-md backdrop-blur-sm transition-all",
        borderColor,
        textColor
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", dotColor, connectionQuality === "good" && "animate-pulse")} />
      <Wifi className="h-3 w-3" />
      {latency !== null ? `${latency}ms` : "Connected"}
    </div>
  );
}
