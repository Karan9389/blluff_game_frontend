import { socket } from "@/services/socket";
import type { Player } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Copy, Play, Users, Crown, LogOut, MessageCircle, Share2, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { copyToClipboard } from "@/lib/utils";

interface WaitingRoomProps {
  roomCode: string;
  players: Player[];
  playerName?: string;
  myId?: string;
  onLeave?: () => void;
  onOpenChat?: () => void;
  unreadCount?: number;
}

export default function WaitingRoom({
  roomCode,
  players,
  playerName,
  myId,
  onLeave,
  onOpenChat,
  unreadCount = 0,
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);

  // Determine host: backend marks isHost: true on host, or first player
  const host = players.find(p => p.isHost) ?? players[0];
  const isHost = Boolean(
    (host && myId && host.id === myId) ||
    (host && socket.id && host.id === socket.id) ||
    (host && playerName && host.name === playerName)
  );

  const handleCopy = async () => {
    const link = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Invite link copied to clipboard!");
    } else {
      toast.info(`Room code: ${roomCode}`);
    }
  };

  const handleStart = () => {
    if (!isHost) return toast.error("Only the host can start the game!");
    if (players.length < 2) {
      return toast.error("Need at least 2 players to start!");
    }
    socket.emit("start_game", { roomCode });
  };

  return (
    <Card className="w-full max-w-2xl border-border/50 shadow-2xl bg-card/95 backdrop-blur-sm">
      <CardHeader className="text-center pb-6 border-b border-border/10 relative">
        <div className="flex items-center justify-between absolute top-4 inset-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLeave}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs flex items-center gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            Leave
          </Button>

          {onOpenChat && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenChat}
              className="md:hidden relative text-xs flex items-center gap-1.5 border-border/50"
            >
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              Chat
              {unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {unreadCount}
                </span>
              )}
            </Button>
          )}
        </div>

        <CardDescription className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-1 pt-6">
          Room Code
        </CardDescription>
        <CardTitle className="text-5xl sm:text-6xl font-black font-mono tracking-[0.2em] text-primary flex justify-center items-center gap-3">
          {roomCode}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            title="Copy invite link"
            className="h-11 w-11 rounded-full hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
          >
            {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
          </Button>
        </CardTitle>

        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="text-xs text-muted-foreground gap-1.5 rounded-full border-border/40 hover:text-foreground"
          >
            <Share2 className="h-3 w-3" />
            Copy Shareable Link
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2 text-foreground/80">
              <Users className="h-4 w-4 text-primary" />
              Players in Lobby ({players.length}/8)
            </h3>
            <span className="text-xs text-muted-foreground">
              {players.length < 2 ? "Need 1 more player" : "Ready to play!"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {players.map((p) => {
              const playerIsHost = Boolean(p.isHost || p.id === host?.id);
              const isCurrentUser = Boolean(
                (myId && p.id === myId) ||
                (socket.id && p.id === socket.id) ||
                (playerName && p.name === playerName)
              );

              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-secondary/50 transition-all hover:bg-secondary/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <Avatar className="h-11 w-11 ring-2 ring-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-base">
                          {p.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {playerIsHost && (
                        <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 p-1 rounded-full shadow-sm" title="Host">
                          <Crown className="h-3 w-3 fill-current" />
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-base truncate flex items-center gap-1.5">
                        {p.name}
                        {isCurrentUser && <span className="text-xs text-primary font-normal">(You)</span>}
                      </span>
                      {playerIsHost && (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                          Room Host
                        </span>
                      )}
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0">
                    Ready
                  </Badge>
                </div>
              );
            })}

            {/* Empty slots placeholders */}
            {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border/40 opacity-40 select-none"
              >
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-transparent border border-dashed border-border/50 text-xs">?</AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground italic">Waiting for player...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Controls based on Host vs Non-Host */}
        <div className="pt-2">
          {isHost ? (
            <div className="space-y-2">
              <Button 
                onClick={handleStart} 
                disabled={players.length < 2}
                className="w-full h-14 text-lg font-bold rounded-xl shadow-lg transition-all hover:scale-[1.01] hover:shadow-primary/25 disabled:opacity-50"
              >
                <Play className="mr-2 h-5 w-5 fill-current" />
                {players.length < 2 ? "Waiting for More Players..." : "Start Game"}
              </Button>
              {players.length < 2 && (
                <p className="text-center text-xs text-muted-foreground">
                  Invite a friend with the room code above to begin. Minimum 2 players required.
                </p>
              )}
            </div>
          ) : (
            <div className="w-full p-4 rounded-xl bg-secondary/30 border border-border/40 flex items-center justify-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
              <p className="text-sm font-medium text-foreground/80">
                Waiting for host <span className="font-bold text-primary">{host?.name || "Host"}</span> to start the game...
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
