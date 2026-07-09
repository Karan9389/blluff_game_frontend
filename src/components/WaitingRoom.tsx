import { socket } from "@/services/socket";
import type { Player } from "@/App";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Copy, Play, Users } from "lucide-react";
import { toast } from "sonner";

interface WaitingRoomProps {
  roomCode: string;
  players: Player[];
}

export default function WaitingRoom({ roomCode, players }: WaitingRoomProps) {
  const handleCopy = () => {
    const link = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied to clipboard!");
  };

  const handleStart = () => {
    if (players.length < 2) {
      return toast.error("Need at least 2 players to start!");
    }
    socket.emit("start_game", { roomCode });
  };

  return (
    <Card className="w-full max-w-2xl border-border/50 shadow-2xl bg-card/95 backdrop-blur-sm">
      <CardHeader className="text-center pb-8 border-b border-border/10">
        <CardDescription className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-2">Room Code</CardDescription>
        <CardTitle className="text-6xl font-black font-mono tracking-[0.2em] text-primary flex justify-center items-center gap-4">
          {roomCode}
          <Button variant="ghost" size="icon" onClick={handleCopy} className="h-12 w-12 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
            <Copy className="h-6 w-6" />
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-8 space-y-8">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-foreground/80">
            <Users className="h-5 w-5" />
            Players in Lobby ({players.length}/4)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-secondary/50">
                <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                    {p.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-lg truncate">{p.name}</span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border/50 opacity-50">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-transparent border border-dashed border-border/50">?</AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground italic">Waiting...</span>
              </div>
            ))}
          </div>
        </div>

        <Button 
          onClick={handleStart} 
          className="w-full h-16 text-xl font-bold rounded-xl shadow-lg transition-all hover:scale-[1.01] hover:shadow-primary/25"
        >
          <Play className="mr-2 h-6 w-6" />
          Start Game
        </Button>
      </CardContent>
    </Card>
  );
}
