import { useState } from "react";
import { socket } from "@/services/socket";
import type { GameState, Player, CardData } from "@/App";
import PlayingCard from "./PlayingCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface GameBoardProps {
  gameState: GameState | null;
  players: Player[];
  yourHand: CardData[];
  roomCode: string;
  myId: string;
}

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export default function GameBoard({ gameState, players, yourHand, roomCode, myId }: GameBoardProps) {
  const [selectedCardIndices, setSelectedCardIndices] = useState<Set<number>>(new Set());
  const [claimedRank, setClaimedRank] = useState<string>("A");

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  // ── Deduplicate players by name (keep last — the reconnected socket ID) ──
  // This prevents the "ghost player" issue when a reconnect creates a duplicate.
  const deduped = Object.values(
    players.reduce((acc, p) => {
      acc[p.name] = p; // last one wins (newest socket ID after reconnect)
      return acc;
    }, {} as Record<string, typeof players[0]>)
  );

  // ── Find myself — first by socket ID, then by socket ID in deduped list ──
  const me = deduped.find(p => p.id === myId) ?? deduped.find(p => p.id === socket.id);
  const myEffectiveId = me?.id ?? myId;

  const currentPlayer = deduped[gameState.currentTurnIndex] ?? null;
  const isMyTurn = !!currentPlayer && currentPlayer.id === myEffectiveId;
  const opponents = deduped.filter(p => p.id !== myEffectiveId);
  const pileCount = gameState.centerPile?.length ?? 0;

  // Claim display
  const claim = gameState.currentClaim;
  const hasValidClaim = claim && (claim.count > 0 || claim.rank !== "");
  const claimDisplay = hasValidClaim
    ? `${claim.count} × ${claim.rank || "?"}`
    : null;

  const totalSelected = selectedCardIndices.size;

  const toggleCard = (idx: number) => {
    const next = new Set(selectedCardIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedCardIndices(next);
  };

  const handlePlayCards = () => {
    if (!isMyTurn) return toast.error("It's not your turn!");
    if (totalSelected === 0) return toast.error("Select at least one card!");

    const cards = Array.from(selectedCardIndices).map(i => yourHand[i]);
    socket.emit("play_cards", { roomCode, cards, claimedRank });
    console.log("[play_cards]", { roomCode, cards, claimedRank });
    setSelectedCardIndices(new Set());
    toast.info(`Playing ${totalSelected} card(s) as ${claimedRank}`);
  };

  const handleCallBluff = () => {
    if (!isMyTurn) return toast.error("It's not your turn!");
    if (pileCount === 0) return toast.error("The pile is empty!");
    socket.emit("call_bluff", { roomCode });
    console.log("[call_bluff]", { roomCode });
  };

  return (
    <div
      className="flex-1 flex flex-col h-full relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #1e1b4b 0%, #0d0d1a 65%)" }}
    >
      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/30 backdrop-blur shrink-0">
        <Badge variant="outline" className="font-mono tracking-widest text-xs border-white/20 bg-black/30">
          ROOM: {roomCode}
        </Badge>

        {/* PROMINENT TURN BANNER */}
        <div className={`flex items-center gap-2 px-5 py-1.5 rounded-full font-bold text-sm border transition-all duration-300 ${
          isMyTurn
            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/40"
            : "bg-black/50 text-white/60 border-white/15"
        }`}>
          {isMyTurn ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              YOUR TURN — Play your cards!
            </>
          ) : (
            <>⏳ Waiting for <span className="text-white font-bold ml-1">{currentPlayer?.name ?? "..."}</span></>
          )}
        </div>

        <span className="text-xs text-white/40">
          {me?.name ?? "You"} · {yourHand.length} cards
        </span>
      </div>

      {/* ── OPPONENTS ── */}
      <div className="flex justify-center items-end pt-6 pb-4 gap-10 shrink-0 px-4 flex-wrap min-h-[120px]">
        {opponents.length === 0 ? (
          <p className="text-white/25 italic text-sm self-center">No opponents</p>
        ) : (
          opponents.map(opp => {
            const isTheirTurn = currentPlayer?.id === opp.id;
            return (
              <div key={opp.id} className="flex flex-col items-center gap-2">
                <div className="relative">
                  {isTheirTurn && (
                    <div className="absolute -inset-3 rounded-full bg-primary/30 animate-pulse" />
                  )}
                  <Avatar className={`h-16 w-16 border-2 transition-all duration-300 ${
                    isTheirTurn ? "border-primary scale-110 shadow-xl shadow-primary/40" : "border-white/15"
                  }`}>
                    <AvatarFallback className="bg-indigo-900 text-white text-xl font-bold">
                      {opp.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-1 -right-2 bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-1 ring-black/50">
                    {opp.cardCount}🃏
                  </span>
                </div>
                <span className="text-xs font-semibold text-white/70 max-w-[80px] truncate text-center">
                  {opp.name}
                </span>
                {isTheirTurn && (
                  <span className="text-[10px] text-primary font-black uppercase tracking-widest animate-pulse">
                    ● PLAYING
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── CENTER PILE ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 relative">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-72 rounded-full bg-indigo-500/8 blur-3xl" />
        </div>

        {/* Stacked face-down cards */}
        {pileCount > 0 ? (
          <div className="relative">
            <div className="relative w-20 h-28">
              {[...Array(Math.min(pileCount, 7))].map((_, i) => {
                const angle = ((i * 41) % 22) - 11;
                const tx = ((i * 17) % 12) - 6;
                const ty = ((i * 11) % 8) - 4;
                return (
                  <div
                    key={i}
                    className="absolute inset-0 rounded-xl border border-white/20"
                    style={{
                      transform: `rotate(${angle}deg) translate(${tx}px, ${ty}px)`,
                      zIndex: i,
                      background: "linear-gradient(135deg, #3730a3, #1e1b4b)",
                    }}
                  >
                    <div className="absolute inset-1.5 rounded-lg border border-white/10 flex items-center justify-center">
                      <span className="text-white/15 text-2xl font-black select-none">B</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Badge className="absolute -right-7 -top-3 z-20 bg-primary text-primary-foreground font-bold px-2.5 shadow-lg">
              {pileCount} cards
            </Badge>
          </div>
        ) : (
          <div className="w-20 h-28 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-white/20 gap-1">
            <span className="text-2xl">🃏</span>
            <span className="text-[10px] font-medium">Empty</span>
          </div>
        )}

        {/* Claim display */}
        {claimDisplay ? (
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur px-5 py-2 rounded-full border border-white/10 shadow-lg">
            <Info className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-sm text-white/80">
              Claimed: <span className="font-bold text-amber-300">{claimDisplay}</span>
            </span>
          </div>
        ) : (
          <span className="text-white/20 text-xs italic">No claim yet — start the round!</span>
        )}
      </div>

      {/* ── ACTION PANEL + HAND ── */}
      <div className={`shrink-0 border-t transition-colors duration-300 ${
        isMyTurn ? "border-primary/50 bg-indigo-950/80" : "border-white/10 bg-black/50"
      } backdrop-blur-xl`}>
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-4 space-y-3">

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap justify-between">
            <p className="text-sm text-white/50">
              {isMyTurn
                ? <span className="text-primary font-semibold">Select cards → choose rank to claim → Play!</span>
                : <span>Waiting for <b className="text-white">{currentPlayer?.name}</b>...</span>
              }
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-white/40 uppercase tracking-wider">Claim:</label>
              <select
                value={claimedRank}
                onChange={e => setClaimedRank(e.target.value)}
                disabled={!isMyTurn}
                className="h-9 w-20 bg-white/10 border border-white/20 rounded-md px-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-30 cursor-pointer"
              >
                {RANKS.map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
              </select>

              <Button
                onClick={handlePlayCards}
                disabled={!isMyTurn || totalSelected === 0}
                className="h-9 px-5 font-bold active:scale-95 transition-all"
              >
                {totalSelected > 0
                  ? `Play ${totalSelected} as ${claimedRank}`
                  : `Select cards to play`}
              </Button>

              <Button
                variant="destructive"
                onClick={handleCallBluff}
                disabled={!isMyTurn || pileCount === 0 || gameState.lastPlayedPlayerId === myEffectiveId}
                className="h-9 px-4 font-bold active:scale-95 flex items-center gap-1.5 shadow-lg"
              >
                <ShieldAlert className="h-4 w-4" />
                Bluff!
              </Button>
            </div>
          </div>

          {/* Hand — real cards with suit & rank */}
          <div className="flex flex-wrap gap-2 justify-center items-end min-h-[110px] pb-1 overflow-x-auto">
            {yourHand.length === 0 ? (
              <p className="text-white/25 italic text-sm self-center">No cards</p>
            ) : (
              yourHand.map((card, idx) => (
                <PlayingCard
                  key={`${card.rank}-${card.suit}-${idx}`}
                  card={card}
                  isSelected={selectedCardIndices.has(idx)}
                  onClick={() => isMyTurn && toggleCard(idx)}
                />
              ))
            )}
          </div>

          {totalSelected > 0 && (
            <p className="text-center text-xs text-primary/70 font-medium">
              {totalSelected} card{totalSelected !== 1 ? "s" : ""} selected — claiming {totalSelected} × {claimedRank}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
