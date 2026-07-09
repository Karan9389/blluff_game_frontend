import type { CardData } from "@/App";
import { cn } from "@/lib/utils";

interface PlayingCardProps {
  card: CardData;
  isSelected?: boolean;
  onClick?: () => void;
  faceDown?: boolean;
  className?: string;
}

const isRed = (suit: string) => suit === "♥" || suit === "♦";

export default function PlayingCard({ card, isSelected, onClick, faceDown, className }: PlayingCardProps) {
  if (faceDown) {
    return (
      <div className={cn(
        "relative w-16 h-24 rounded-lg border border-white/20 cursor-default select-none shrink-0",
        "bg-gradient-to-br from-indigo-800 to-indigo-950",
        className
      )}>
        <div className="absolute inset-2 rounded border border-white/10 flex items-center justify-center">
          <span className="text-white/20 text-2xl font-black">B</span>
        </div>
      </div>
    );
  }

  const red = isRed(card.suit);

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative w-[72px] h-[100px] rounded-xl bg-white shadow-lg border-2 cursor-pointer select-none",
        "transition-all duration-150 flex flex-col justify-between p-1.5",
        red ? "text-red-500" : "text-slate-900",
        isSelected
          ? "border-primary -translate-y-5 shadow-xl shadow-primary/30 ring-2 ring-primary/40 ring-offset-1 ring-offset-transparent z-10"
          : "border-slate-200 hover:-translate-y-2 hover:shadow-md hover:border-slate-300",
        className
      )}
    >
      {/* Top-left */}
      <div className="flex flex-col items-center leading-none self-start">
        <span className="text-base font-black">{card.rank}</span>
        <span className="text-base leading-none">{card.suit}</span>
      </div>

      {/* Center watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`text-5xl opacity-[0.08] ${red ? "text-red-500" : "text-slate-900"}`}>
          {card.suit}
        </span>
      </div>

      {/* Bottom-right (flipped) */}
      <div className="flex flex-col items-center leading-none self-end rotate-180">
        <span className="text-base font-black">{card.rank}</span>
        <span className="text-base leading-none">{card.suit}</span>
      </div>

      {/* Selected glow overlay */}
      {isSelected && (
        <div className="absolute inset-0 rounded-xl bg-primary/10 pointer-events-none" />
      )}
    </div>
  );
}
