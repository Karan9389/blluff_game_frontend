import { useEffect, useRef, useState } from "react";
import { socket } from "./services/socket";
import LobbyView from "./components/LobbyView";
import WaitingRoom from "./components/WaitingRoom";
import GameBoard from "./components/GameBoard";
import ChatSidebar from "./components/ChatSidebar";
import { Toaster, toast } from "sonner";

export type ViewState = "LOBBY" | "WAITING_ROOM" | "ACTIVE_GAME";

export interface Player {
  id: string;
  name: string;
  isHost?: boolean;
  cardCount: number;
  hand?: CardData[];
}

// Cards are individual: { suit: "♠", rank: "J" }
export interface CardData {
  suit: string;
  rank: string;
}

export interface ChatMessage {
  id?: string;
  senderId?: string;
  senderName?: string;
  sender?: string;
  playerName?: string;
  text?: string;
  message?: string;
  type?: "user" | "system";
}

// Exact backend GameState shape (confirmed from backend trace)
export interface GameState {
  status: string;
  currentTurnIndex: number;
  currentClaim: { rank: string; count: number };
  centerPile: CardData[];
  lastPlayedPlayerId: string | null;
}

// ─── Session Persistence ───────────────────────────────────────────────────
// Store key state in sessionStorage so page refreshes / reconnects can resume
const SESSION_KEY = "bluff_session";

function saveSession(data: {
  playerName: string;
  roomCode: string;
  currentView: ViewState;
}) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function loadSession(): { playerName: string; roomCode: string; currentView: ViewState } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
// ──────────────────────────────────────────────────────────────────────────

function App() {
  const session = loadSession();

  const [currentView, setCurrentView] = useState<ViewState>(session?.currentView ?? "LOBBY");
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [myId, setMyId] = useState<string>("");

  const [playerName, setPlayerName] = useState(session?.playerName ?? "");
  const [roomCode, setRoomCode] = useState(session?.roomCode ?? "");
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [yourHand, setYourHand] = useState<CardData[]>([]);

  // Refs so socket listeners always see latest values without stale closures
  const playerNameRef = useRef(playerName);
  const roomCodeRef = useRef(roomCode);
  const currentViewRef = useRef(currentView);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
  useEffect(() => { currentViewRef.current = currentView; }, [currentView]);

  // Persist session whenever key state changes
  useEffect(() => {
    if (currentView !== "LOBBY" && playerName && roomCode) {
      saveSession({ playerName, roomCode, currentView });
    }
  }, [playerName, roomCode, currentView]);

  useEffect(() => {
    socket.connect();

    // ── connect / disconnect ────────────────────────────────────────────
    socket.on("connect", () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setMyId(socket.id || "");

      const view = currentViewRef.current;
      const rc = roomCodeRef.current;
      const name = playerNameRef.current;

      // Auto-rejoin if we were already in a room/game
      if ((view === "WAITING_ROOM" || view === "ACTIVE_GAME") && rc && name) {
        toast.info("Reconnected — rejoining room...");
        socket.emit("join_room", { playerName: name, roomCode: rc });
      } else {
        toast.success("Connected to server");
      }
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      console.log("[disconnect] reason:", reason);
      // Only show reconnecting overlay if we were in a game
      if (currentViewRef.current !== "LOBBY") {
        setIsReconnecting(true);
        toast.error("Connection lost — reconnecting...");
      }
    });

    socket.on("connect_error", (err) => {
      console.error("[connect_error]", err.message);
    });

    // ── Room events ─────────────────────────────────────────────────────
    socket.on("room_created", (...args: any[]) => {
      console.log("[room_created]", JSON.stringify(args));
      const data = args[0];
      setRoomCode(data.roomCode || "");
      setPlayers(data.players || []);
      setCurrentView("WAITING_ROOM");
      toast.success(`Room ${data.roomCode} created!`);
    });

    socket.on("room_updated", (...args: any[]) => {
      console.log("[room_updated]", JSON.stringify(args));
      const data = args[0];
      setPlayers(data.players || []);
      if (data.messages?.length) setMessages(data.messages);
      setCurrentView(prev => prev === "LOBBY" ? "WAITING_ROOM" : prev);
      // If we were reconnecting and got room data, we're back
      setIsReconnecting(false);
    });

    // ── Game events ─────────────────────────────────────────────────────
    socket.on("game_started", (...args: any[]) => {
      console.log("[game_started]", JSON.stringify(args));
      const data = args[0];
      setGameState(data.gameState || null);
      setPlayers(data.players || []);
      setYourHand(data.yourHand || []);
      setCurrentView("ACTIVE_GAME");
      setIsReconnecting(false);
      toast.success("🃏 Game started!");
    });

    socket.on("game_state_changed", (...args: any[]) => {
      console.log("[game_state_changed]", JSON.stringify(args));
      const data = args[0];
      if (data.gameState) setGameState(data.gameState);
      if (data.players?.length) setPlayers(data.players);
      if (data.yourHand?.length) setYourHand(data.yourHand);
      setIsReconnecting(false);
    });

    socket.on("new_message", (...args: any[]) => {
      const msg = args[0];
      if (msg) setMessages(prev => [...prev, msg]);
    });

    socket.on("error_message", (...args: any[]) => {
      const e = args[0];
      const msg = typeof e === "string" ? e : e?.message || e?.error || "Something went wrong";
      toast.error(msg);
    });

    // ── Game over ───────────────────────────────────────────────────────
    socket.on("game_over", (...args: any[]) => {
      console.log("[game_over]", JSON.stringify(args));
      const data = args[0];
      const winner = data?.winner || data?.winnerName || "Someone";
      toast.success(`🏆 Game Over! ${winner} wins!`, { duration: 6000 });
      clearSession();
      setTimeout(() => {
        setCurrentView("LOBBY");
        setGameState(null);
        setYourHand([]);
        setPlayers([]);
        setMessages([]);
      }, 4000);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("room_created");
      socket.off("room_updated");
      socket.off("game_started");
      socket.off("game_state_changed");
      socket.off("new_message");
      socket.off("error_message");
      socket.off("game_over");
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground dark flex flex-col font-sans">
      <Toaster theme="dark" position="top-center" richColors closeButton />

      {/* ── Reconnecting overlay ─────────────────────────────────────── */}
      {isReconnecting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 text-center p-8">
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <h2 className="text-xl font-bold text-white">Connection Lost</h2>
            <p className="text-white/60 text-sm">
              Reconnecting to server and rejoining room <span className="font-mono text-primary">{roomCode}</span>...
            </p>
            <p className="text-white/30 text-xs">Your game is still running — please wait</p>
          </div>
        </div>
      )}

      {/* ── Views ────────────────────────────────────────────────────── */}
      {currentView === "LOBBY" && (
        <LobbyView
          isConnected={isConnected}
          playerName={playerName}
          setPlayerName={setPlayerName}
          setRoomCode={setRoomCode}
        />
      )}

      {currentView === "WAITING_ROOM" && (
        <div className="flex flex-1 h-screen overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <WaitingRoom roomCode={roomCode} players={players} />
          </div>
          <ChatSidebar messages={messages} players={players} myId={myId} roomCode={roomCode} />
        </div>
      )}

      {currentView === "ACTIVE_GAME" && (
        <div className="flex flex-1 h-screen overflow-hidden">
          <div className="flex-1 flex flex-col relative overflow-hidden">
            <GameBoard
              gameState={gameState}
              players={players}
              yourHand={yourHand}
              roomCode={roomCode}
              myId={myId}
            />
          </div>
          <ChatSidebar messages={messages} players={players} myId={myId} roomCode={roomCode} />
        </div>
      )}
    </div>
  );
}

export default App;
