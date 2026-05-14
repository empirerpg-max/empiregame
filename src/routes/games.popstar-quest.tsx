import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Lock } from "lucide-react";

export const Route = createFileRoute("/games/popstar-quest")({
  component: ComingSoon,
});

function ComingSoon() {
  return (
    <div className="flex-1 bg-black min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <Link to="/games" className="absolute top-8 left-8 text-white/50 hover:text-white transition-colors">
        <ChevronLeft className="size-8" />
      </Link>
      <div className="size-24 bg-zinc-900 border-4 border-black shadow-[8px_8px_0px_#111] rounded-3xl flex items-center justify-center text-zinc-500 mb-8">
        <Lock className="size-10" />
      </div>
      <h1 className="text-4xl font-black italic uppercase text-white mb-2 tracking-tighter italic">Popstar Quest</h1>
      <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-[0.3em]">Em Desenvolvimento...</p>
    </div>
  );
}
