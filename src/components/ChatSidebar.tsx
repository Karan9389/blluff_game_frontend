import { useEffect, useRef, useState } from "react";
import { socket } from "@/services/socket";
import type { ChatMessage, Player } from "@/App";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SendHorizontal, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  messages: ChatMessage[];
  players: Player[];
  myId: string;
  roomCode: string;
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function ChatSidebar({
  messages,
  players,
  myId,
  roomCode,
  isOpenOnMobile = false,
  onCloseMobile,
}: ChatSidebarProps) {
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build id→name and name→id lookups
  const nameMap: Record<string, string> = {};
  const myName = players.find(p => p.id === myId)?.name ?? "";
  players.forEach(p => { nameMap[p.id] = p.name; });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    // ✅ Backend expects: { roomCode, text, senderName }
    socket.emit("send_message", { roomCode, text: inputText.trim(), senderName: myName });
    setInputText("");
    inputRef.current?.focus();
  };

  const resolveName = (msg: ChatMessage): string => {
    if (msg.type === "system") return "System";
    const senderName = msg.sender || msg.senderName || msg.playerName || "";
    if (!senderName) return "Unknown";
    return senderName;
  };

  const resolveText = (msg: ChatMessage): string => {
    return msg.text || msg.message || "";
  };

  const isMyMessage = (msg: ChatMessage): boolean => {
    const senderName = msg.sender || msg.senderName || "";
    return !!myName && senderName === myName;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenOnMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
        />
      )}

      <div
        className={cn(
          "border-l border-border/50 bg-card/95 flex flex-col h-full backdrop-blur-xl shrink-0 transition-all duration-300",
          isOpenOnMobile
            ? "fixed inset-y-0 right-0 w-[85vw] max-w-sm z-50 shadow-2xl flex"
            : "w-80 hidden md:flex"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border/50 bg-background/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <h2 className="font-bold text-sm tracking-tight">Live Chat</h2>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          {isOpenOnMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCloseMobile}
              className="h-8 w-8 rounded-full md:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground/40 italic mt-6">
              No messages yet...
            </p>
          )}

          {messages.map((msg, idx) => {
            const text = resolveText(msg);
            const type = msg.type ?? "user";
            const isMe = isMyMessage(msg);
            const name = resolveName(msg);

            if (!text) return null;

            if (type === "system") {
              return (
                <div key={idx} className="text-center w-full my-1">
                  <span className="text-xs italic text-muted-foreground/70 bg-muted/30 px-3 py-1 rounded-full">
                    {text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={idx}
                className={`flex flex-col max-w-[85%] gap-0.5 ${isMe ? "self-end items-end" : "self-start items-start"}`}
              >
                <span className="text-[10px] font-semibold text-muted-foreground px-1 uppercase tracking-wider">
                  {isMe ? "You" : name}
                </span>
                <div
                  className={`px-3.5 py-2 rounded-2xl text-sm shadow-sm break-words max-w-full ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-secondary-foreground rounded-bl-sm"
                  }`}
                >
                  {text}
                </div>
              </div>
            );
          })}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-border/50 bg-background/30 flex gap-2">
        <Input
          ref={inputRef}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-secondary/20 border-border/30 rounded-full px-4 text-sm"
        />
        <Button
          type="submit"
          size="icon"
          className="rounded-full shrink-0 transition-transform hover:scale-105 active:scale-95"
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </div>
  </>
);
}
