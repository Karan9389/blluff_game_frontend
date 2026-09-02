import { useState, useEffect, useRef } from "react";
import { socket } from "@/services/socket";
import type { GameState, Player, CardData, ChatMessage } from "@/App";
import PlayingCard from "./PlayingCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  Info,
  Loader2,
  Trophy,
  Sparkles,
  LogOut,
  MessageCircle,
  ArrowUpDown,
  CheckCheck,
  RotateCcw,
  Copy,
  Check,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  copyToClipboard,
  playTurnSound,
  playCardSound,
  playBluffAlert,
  playVictorySound,
} from "@/lib/utils";

interface GameBoardProps {
  gameState: GameState | null;
  players: Player[];
  yourHand: CardData[];
  roomCode: string;
  myId: string;
  playerName?: string;
  messages?: ChatMessage[];
  onLeave?: () => void;
  onOpenChat?: () => void;
  unreadCount?: number;
}

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const rankOrder: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  "J": 11, "Q": 12, "K": 13, "A": 14,
};
const suitOrder: Record<string, number> = { "♠": 1, "♥": 2, "♦": 3, "♣": 4 };

export default function GameBoard({
  gameState,
  players,
  yourHand,
  roomCode,
  myId,
  playerName,
  messages = [],
  onLeave,
  onOpenChat,
  unreadCount = 0,
}: GameBoardProps) {
  const [selectedCardIndices, setSelectedCardIndices] = useState<Set<number>>(new Set());
  const [claimedRank, setClaimedRank] = useState<string>("A");
  const [sortBy, setSortBy] = useState<"rank" | "suit" | "dealt">("rank");
  const [copied, setCopied] = useState(false);
  const [showBluffBanner, setShowBluffBanner] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const lastProcessedMsgRef = useRef<string | null>(null);
  const prevIsMyTurnRef = useRef(false);

  // Pile count and claim rank locking
  const pileCount = gameState?.centerPile?.length ?? 0;
  const isClaimRankLocked = pileCount > 0 && Boolean(gameState?.currentClaim?.rank);

  // Sync claimedRank with gameState claim if active
  useEffect(() => {
    if (gameState?.currentClaim?.rank) {
      setClaimedRank(gameState.currentClaim.rank);
    }
  }, [gameState?.currentClaim?.rank]);

  // Watch for latest bluff announcements from system messages (both bluff calls and wrong calls)
  useEffect(() => {
    const latestSys = [...messages].reverse().find(m => {
      if (m.type !== "system") return false;
      const text = (m.text || m.message || "").toUpperCase();
      return text.includes("BLUFF") || text.includes("WRONG CALL");
    });

    if (latestSys) {
      const sysId = latestSys.id || `${latestSys.text || latestSys.message}`;
      if (lastProcessedMsgRef.current !== sysId) {
        lastProcessedMsgRef.current = sysId;
        const text = latestSys.text || latestSys.message || "";
        setShowBluffBanner(text);
        playBluffAlert();
        const timer = setTimeout(() => setShowBluffBanner(null), 6500);
        return () => clearTimeout(timer);
      }
    }
  }, [messages]);

  // Prune invalid selected indices if hand shrinks/updates
  useEffect(() => {
    setSelectedCardIndices(prev => {
      const next = new Set<number>();
      prev.forEach(idx => {
        if (idx < yourHand.length && yourHand[idx]) {
          next.add(idx);
        }
      });
      return next;
    });
  }, [yourHand]);

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground p-6 max-w-sm text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">Connecting to Game...</h3>
            <p className="text-xs text-muted-foreground">Waiting for game data from server.</p>
          </div>
          {onLeave && (
            <Button variant="outline" size="sm" onClick={onLeave} className="mt-2 text-xs">
              Back to Lobby
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Correct Player Turn Indexing ─────────────────────────────────────────
  const currentPlayer = players[gameState.currentTurnIndex] ?? null;

  // Identify current player robustly by socket ID or name
  const me = players.find(p => (myId && p.id === myId) || (socket.id && p.id === socket.id))
    ?? (playerName ? players.find(p => p.name === playerName) : null);
  const myEffectiveId = me?.id ?? myId;

  // Turn check
  const isMyTurn = Boolean(
    currentPlayer && (
      currentPlayer.id === myEffectiveId ||
      (socket.id && currentPlayer.id === socket.id) ||
      (playerName && currentPlayer.name === playerName)
    )
  );

  // Play audio chime and clear selections on turn transition
  useEffect(() => {
    if (!isMyTurn) {
      setSelectedCardIndices(new Set());
    } else if (!prevIsMyTurnRef.current) {
      playTurnSound();
    }
    prevIsMyTurnRef.current = isMyTurn;
  }, [isMyTurn]);

  const opponents = players.filter(p => p !== me && p.id !== myEffectiveId && p.name !== playerName);

  // Last played player check
  const lastPlayedPlayer = players.find(p => p.id === gameState.lastPlayedPlayerId);
  const isLastPlayerMe = Boolean(
    gameState.lastPlayedPlayerId && (
      gameState.lastPlayedPlayerId === myEffectiveId ||
      gameState.lastPlayedPlayerId === socket.id ||
      (lastPlayedPlayer && playerName && lastPlayedPlayer.name === playerName)
    )
  );

  // Claim display
  const claim = gameState.currentClaim;
  const hasValidClaim = claim && (claim.count > 0 || claim.rank !== "");
  const claimDisplay = hasValidClaim ? `${claim.count} × ${claim.rank || "?"}` : null;

  // Check Game Over
  const isGameOver = gameState.status === "GAME_OVER";
  const winner = players.find(p => p.cardCount === 0);
  const isWinnerMe = Boolean(
    winner && (
      winner.id === myEffectiveId ||
      (socket.id && winner.id === socket.id) ||
      (playerName && winner.name === playerName)
    )
  );

  useEffect(() => {
    if (isGameOver && isWinnerMe) {
      playVictorySound();
    }
  }, [isGameOver, isWinnerMe]);

  // ── Indexed & Sorted Hand ────────────────────────────────────────────────
  const indexedHand = yourHand.map((card, originalIndex) => ({ card, originalIndex }));
  const sortedHand = [...indexedHand].sort((a, b) => {
    if (sortBy === "rank") {
      const diff = (rankOrder[a.card.rank] ?? 0) - (rankOrder[b.card.rank] ?? 0);
      return diff !== 0 ? diff : (suitOrder[a.card.suit] ?? 0) - (suitOrder[b.card.suit] ?? 0);
    }
    if (sortBy === "suit") {
      const diff = (suitOrder[a.card.suit] ?? 0) - (suitOrder[b.card.suit] ?? 0);
      return diff !== 0 ? diff : (rankOrder[a.card.rank] ?? 0) - (rankOrder[b.card.rank] ?? 0);
    }
    return a.originalIndex - b.originalIndex;
  });

  const totalSelected = selectedCardIndices.size;

  const toggleCard = (originalIdx: number) => {
    if (!isMyTurn || isGameOver) return;
    const next = new Set(selectedCardIndices);
    if (next.has(originalIdx)) next.delete(originalIdx);
    else next.add(originalIdx);
    setSelectedCardIndices(next);
  };

  const handleSelectAllOfRank = (rankToSelect: string) => {
    if (!isMyTurn || isGameOver) return;
    const next = new Set(selectedCardIndices);
    yourHand.forEach((c, idx) => {
      if (c.rank === rankToSelect) next.add(idx);
    });
    setSelectedCardIndices(next);
  };

  const handleClearSelection = () => {
    setSelectedCardIndices(new Set());
  };

  const handlePlayCards = () => {
    if (!isMyTurn) return toast.error("It's not your turn!");
    if (totalSelected === 0) return toast.error("Select at least one card!");

    const cardsPlayed = Array.from(selectedCardIndices)
      .map(i => yourHand[i])
      .filter(Boolean);

    if (cardsPlayed.length === 0) {
      setSelectedCardIndices(new Set());
      return toast.error("Selected cards are not available!");
    }

    const rankToClaim = isClaimRankLocked ? (gameState.currentClaim.rank || claimedRank) : claimedRank;

    // ✅ Backend expects: { roomCode, cardsPlayed, claimedRank }
    socket.emit("play_cards", { roomCode, cardsPlayed, claimedRank: rankToClaim });
    setSelectedCardIndices(new Set());
    playCardSound();
    toast.info(`Played ${cardsPlayed.length} card(s) as ${rankToClaim}`);
  };

  const handleCallBluff = () => {
    if (pileCount === 0) return toast.error("No cards in the pile to challenge!");
    if (isLastPlayerMe) {
      return toast.error("You can't call bluff on yourself!");
    }
    if (!gameState.lastPlayedPlayerId) {
      return toast.error("No recent play to challenge!");
    }
    // ✅ Backend expects: { roomCode }
    socket.emit("call_bluff", { roomCode });
    playBluffAlert();
    toast.info("Bluff called! Revealing cards…");
  };

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(roomCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Room code copied!");
    } else {
      toast.info(`Room code: ${roomCode}`);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col h-full relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #1e1b4b 0%, #0d0d1a 65%)" }}
    >
      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-white/10 bg-black/40 backdrop-blur shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyCode}
            className="h-7 px-2 font-mono text-xs border border-white/15 bg-black/30 hover:bg-white/10 text-white/80 gap-1.5"
            title="Click to copy room code"
          >
            ROOM: <span className="text-primary font-bold">{roomCode}</span>
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-white/40" />}
          </Button>

          {onLeave && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLeave}
              className="h-7 px-2 text-xs text-white/50 hover:text-destructive hover:bg-destructive/10"
              title="Leave room"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Leave</span>
            </Button>
          )}
        </div>

        {/* PROMINENT TURN BANNER */}
        <div className={`flex items-center gap-2 px-3 sm:px-5 py-1 rounded-full font-bold text-xs sm:text-sm border transition-all duration-300 ${
          isGameOver
            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
            : isMyTurn
            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/40 animate-pulse"
            : "bg-black/50 text-white/70 border-white/15"
        }`}>
          {isGameOver ? (
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-amber-400" />
              Game Finished
            </span>
          ) : isMyTurn ? (
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

        <div className="flex items-center gap-2">
          {onOpenChat && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenChat}
              className="md:hidden relative h-7 px-2 text-xs text-white/70 hover:text-white border border-white/15 bg-black/30"
            >
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              {unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1 rounded-full ml-1">
                  {unreadCount}
                </span>
              )}
            </Button>
          )}

          <span className="text-xs text-white/50 hidden sm:inline">
            {me?.name ?? "You"} · <span className="font-bold text-white">{yourHand.length}</span> cards
          </span>
        </div>
      </div>

      {/* ── IN-GAME BLUFF OUTCOME BANNER ── */}
      {showBluffBanner && (
        <div className="absolute top-14 inset-x-4 z-30 flex justify-center animate-in slide-in-from-top duration-300 pointer-events-none">
          <div className="max-w-xl w-full bg-black/85 border border-amber-500/50 text-white px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 text-center justify-center">
            <span className="text-xl">📢</span>
            <p className="text-sm font-semibold tracking-wide text-amber-200">
              {showBluffBanner}
            </p>
          </div>
        </div>
      )}

      {/* ── OPPONENTS ── */}
      <div className="flex justify-center items-end pt-4 pb-2 gap-6 sm:gap-10 shrink-0 px-4 flex-wrap min-h-[110px]">
        {opponents.length === 0 ? (
          <p className="text-white/30 italic text-xs self-center">No opponents in game</p>
        ) : (
          opponents.map(opp => {
            const isTheirTurn = currentPlayer?.id === opp.id;
            return (
              <div key={opp.id} className="flex flex-col items-center gap-1.5 transition-transform">
                <div className="relative">
                  {isTheirTurn && (
                    <div className="absolute -inset-2.5 rounded-full bg-primary/40 animate-pulse" />
                  )}
                  <Avatar className={`h-14 w-14 border-2 transition-all duration-300 ${
                    isTheirTurn ? "border-primary scale-110 shadow-xl shadow-primary/40" : "border-white/15"
                  }`}>
                    <AvatarFallback className="bg-indigo-900 text-white text-lg font-bold">
                      {opp.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-1 -right-2 bg-slate-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-1 ring-black/50">
                    {opp.cardCount}🃏
                  </span>
                </div>
                <span className="text-xs font-semibold text-white/80 max-w-[80px] truncate text-center">
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
      <div className="flex-1 flex flex-col items-center justify-center gap-3 relative py-2">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl" />
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
                    className="absolute inset-0 rounded-xl border border-white/20 shadow-md"
                    style={{
                      transform: `rotate(${angle}deg) translate(${tx}px, ${ty}px)`,
                      zIndex: i,
                      background: "linear-gradient(135deg, #3730a3, #1e1b4b)",
                    }}
                  >
                    <div className="absolute inset-1.5 rounded-lg border border-white/10 flex items-center justify-center">
                      <span className="text-white/20 text-2xl font-black select-none">B</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Badge className="absolute -right-7 -top-3 z-20 bg-primary text-primary-foreground font-bold px-2.5 shadow-lg">
              {pileCount} {pileCount === 1 ? "card" : "cards"}
            </Badge>
          </div>
        ) : (
          <div className="w-20 h-28 border-2 border-dashed border-white/15 rounded-xl flex flex-col items-center justify-center text-white/30 gap-1 select-none">
            <span className="text-2xl">🃏</span>
            <span className="text-[10px] font-medium">Empty Pile</span>
          </div>
        )}

        {/* Claim display */}
        {claimDisplay ? (
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur px-4 py-1.5 rounded-full border border-white/10 shadow-lg">
            <Info className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm text-white/80">
              Current Claim: <span className="font-bold text-amber-300">{claimDisplay}</span>
            </span>
          </div>
        ) : (
          <span className="text-white/30 text-xs italic">No claim yet — play cards to set the rank!</span>
        )}
      </div>

      {/* ── ACTION PANEL + HAND ── */}
      <div className={`shrink-0 border-t transition-colors duration-300 ${
        isMyTurn ? "border-primary/50 bg-indigo-950/90" : "border-white/10 bg-black/60"
      } backdrop-blur-xl`}>
        <div className="max-w-5xl mx-auto px-3 sm:px-4 pt-2.5 pb-3 space-y-2.5">

          {/* Controls bar */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs sm:text-sm text-white/60">
                {isGameOver ? (
                  <span className="text-amber-400 font-semibold">Game is finished!</span>
                ) : isMyTurn ? (
                  <span className="text-primary font-semibold">Select cards → choose claim rank → Play!</span>
                ) : (
                  <span>Waiting for <b className="text-white">{currentPlayer?.name}</b>...</span>
                )}
              </p>

              {/* Hand sorting toggles */}
              <div className="flex items-center gap-1 border border-white/15 rounded-md p-0.5 bg-black/30">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortBy("rank")}
                  className={`h-6 px-1.5 text-[10px] rounded ${sortBy === "rank" ? "bg-primary text-primary-foreground font-bold" : "text-white/50"}`}
                  title="Sort cards by rank"
                >
                  <ArrowUpDown className="h-3 w-3 mr-0.5" /> Rank
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortBy("suit")}
                  className={`h-6 px-1.5 text-[10px] rounded ${sortBy === "suit" ? "bg-primary text-primary-foreground font-bold" : "text-white/50"}`}
                  title="Sort cards by suit"
                >
                  Suit
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Quick helper to select matching claim cards */}
              {isMyTurn && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAllOfRank(claimedRank)}
                  className="h-8 px-2 text-xs border-white/20 bg-white/5 text-white/80 hover:bg-white/15"
                  title={`Select all ${claimedRank} cards in hand`}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  All {claimedRank}s
                </Button>
              )}

              {totalSelected > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="h-8 px-2 text-xs text-white/50 hover:text-white"
                  title="Clear card selection"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}

              <div className="flex items-center gap-1.5">
                <label className="text-xs text-white/50 uppercase font-semibold tracking-wider">Claim:</label>
                <select
                  value={claimedRank}
                  onChange={e => setClaimedRank(e.target.value)}
                  disabled={!isMyTurn || isGameOver}
                  className="h-8 w-16 bg-white/10 border border-white/25 rounded-md px-1.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-30 cursor-pointer"
                >
                  {RANKS.map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                </select>
              </div>

              <Button
                onClick={handlePlayCards}
                disabled={!isMyTurn || totalSelected === 0 || isGameOver}
                className="h-8 px-3 text-xs sm:text-sm font-bold active:scale-95 transition-all"
              >
                {totalSelected > 0
                  ? `Play ${totalSelected} as ${claimedRank}`
                  : `Select to Play`}
              </Button>

              <Button
                variant="destructive"
                onClick={handleCallBluff}
                disabled={pileCount === 0 || isLastPlayerMe || gameState.lastPlayedPlayerId === null || isGameOver}
                className="h-8 px-3 text-xs sm:text-sm font-bold active:scale-95 flex items-center gap-1.5 shadow-lg disabled:opacity-40"
                title={isLastPlayerMe ? "You cannot call bluff on yourself" : "Challenge the last play"}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Call Bluff!
              </Button>
            </div>
          </div>

          {/* Hand Cards */}
          <div className="flex flex-wrap gap-2 justify-center items-end min-h-[105px] max-h-[190px] pb-1 overflow-y-auto overflow-x-auto px-2">
            {yourHand.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-emerald-400 gap-1">
                <Sparkles className="h-6 w-6 animate-bounce" />
                <p className="font-bold text-sm">Hand Cleared!</p>
              </div>
            ) : (
              sortedHand.map(({ card, originalIndex }) => (
                <PlayingCard
                  key={`${card.rank}-${card.suit}-${originalIndex}`}
                  card={card}
                  isSelected={selectedCardIndices.has(originalIndex)}
                  disabled={!isMyTurn || isGameOver}
                  onClick={() => toggleCard(originalIndex)}
                />
              ))
            )}
          </div>

          {totalSelected > 0 && (
            <p className="text-center text-xs text-primary/80 font-medium">
              {totalSelected} card{totalSelected !== 1 ? "s" : ""} selected — playing face-down as {totalSelected} × {claimedRank}
            </p>
          )}
        </div>
      </div>

      {/* ── GAME OVER VICTORY / DEFEAT MODAL ── */}
      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="max-w-md w-full bg-card border-2 border-primary/40 rounded-2xl p-6 text-center shadow-2xl space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-primary shadow-lg shadow-primary/30">
                <Trophy className="h-10 w-10 fill-current animate-bounce" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black tracking-tight text-foreground">
                {isWinnerMe ? "🎉 YOU WON!" : "👑 GAME OVER!"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {isWinnerMe
                  ? "Congratulations! You successfully cleared all your cards."
                  : `${winner?.name || "A player"} cleared their hand and won the game!`}
              </p>
            </div>

            {/* Players summary */}
            <div className="bg-secondary/40 rounded-xl p-3 divide-y divide-border/40 text-left">
              <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground pb-2">Final Standings</p>
              {players.map((p) => {
                const won = p.cardCount === 0;
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-semibold flex items-center gap-1.5">
                      {won && <Trophy className="h-3.5 w-3.5 text-amber-400 fill-current" />}
                      {p.name}
                      {p.name === playerName && <span className="text-xs text-primary font-normal">(You)</span>}
                    </span>
                    <Badge variant={won ? "default" : "outline"} className="text-xs font-mono">
                      {won ? "Winner!" : `${p.cardCount} cards left`}
                    </Badge>
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <Button
                onClick={onLeave}
                className="w-full h-12 text-base font-bold shadow-lg"
              >
                Return to Lobby
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
