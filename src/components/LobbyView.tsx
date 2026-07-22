import { useState } from "react";
import { socket } from "@/services/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface LobbyViewProps {
  isConnected: boolean;
  playerName: string;
  setPlayerName: (name: string) => void;
  setRoomCode: (code: string) => void;
}

export default function LobbyView({ isConnected, playerName, setPlayerName, setRoomCode }: LobbyViewProps) {
  const [showJoin, setShowJoin] = useState(false);
  const [localRoomCode, setLocalRoomCode] = useState("");

  const handleCreate = () => {
    if (!playerName.trim()) return toast.error("Enter a player name first!");
    socket.emit("create_room", { playerName });
  };

  const handleJoin = () => {
    if (!playerName.trim()) return toast.error("Enter a player name first!");
    if (!localRoomCode.trim()) return toast.error("Enter a room code!");
    const code = localRoomCode.toUpperCase();
    setRoomCode(code);
    socket.emit("join_room", { playerName, roomCode: code });
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md border-border/50 shadow-2xl backdrop-blur-xl bg-card/95">
        <CardHeader className="space-y-3 text-center pb-8">
          <div className="flex justify-center mb-2">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center transform rotate-12 shadow-lg ring-1 ring-primary/20">
              <span className="text-3xl font-black text-primary-foreground -rotate-12">BS</span>
            </div>
          </div>
          <CardTitle className="text-4xl font-extrabold tracking-tight">Bluff</CardTitle>
          <CardDescription className="text-base font-medium flex items-center justify-center gap-2">
            <Badge variant="outline" className="px-3 py-1 gap-2 border-border/40">
              <span className="relative flex h-2.5 w-2.5">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500' : 'bg-destructive'}`}></span>
              </span>
              {isConnected ? "Connected to Server" : "Disconnected"}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground ml-1 uppercase tracking-wider">Player Name</label>
            <Input 
              placeholder="Enter your alias..." 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="h-12 text-lg bg-background/50 border-border/50 focus-visible:ring-primary/50 transition-all"
            />
          </div>

          <div className="pt-4 flex flex-col gap-3">
            {!showJoin ? (
              <>
                <Button onClick={handleCreate} className="h-12 w-full text-base font-semibold shadow-md transition-all hover:scale-[1.02]">
                  Create New Game
                </Button>
                <Button onClick={() => setShowJoin(true)} variant="secondary" className="h-12 w-full text-base font-semibold transition-all hover:scale-[1.02]">
                  Join Game
                </Button>
              </>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-muted-foreground ml-1 uppercase tracking-wider">Room Code</label>
                  <Input 
                    placeholder="e.g. ABCD" 
                    value={localRoomCode}
                    onChange={(e) => setLocalRoomCode(e.target.value.toUpperCase())}
                    maxLength={4}
                    className="h-12 text-center text-2xl font-mono tracking-[0.25em] uppercase bg-background/50 border-border/50 focus-visible:ring-primary/50"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setShowJoin(false)} variant="ghost" className="h-12 flex-1">Back</Button>
                  <Button onClick={handleJoin} className="h-12 flex-[2] font-bold">Join Room</Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
