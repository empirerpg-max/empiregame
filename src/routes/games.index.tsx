import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Gamepad2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/games/")({
  component: GamesHub,
});

function GamesHub() {
  return (
    <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6 pb-32">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-muted-foreground mb-6 font-black uppercase text-[11px] hover:text-primary transition-colors"
      >
        <ChevronLeft className="size-4" /> Painel Geral
      </Link>

      <header className="mb-8">
        <div className="size-14 rounded-2xl bg-primary/15 text-primary grid place-items-center mb-4">
          <Gamepad2 className="size-7" />
        </div>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter">
          Empire <span className="text-primary">Games</span>
        </h1>
        <p className="text-muted-foreground text-[11px] font-bold mt-1 uppercase tracking-widest">
          Em reconstrução
        </p>
      </header>

      <section className="rounded-3xl border border-white/5 bg-card p-8 text-center flex flex-col items-center gap-4">
        <Sparkles className="size-10 text-primary" />
        <h2 className="text-lg font-black italic uppercase tracking-tight">
          Novos jogos a caminho
        </h2>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed max-w-sm">
          O catálogo foi zerado para uma nova geração de minigames do império.
          Em breve, novas experiências aparecem por aqui.
        </p>
      </section>
    </main>
  );
}
