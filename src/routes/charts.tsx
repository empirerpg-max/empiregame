import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Music, TrendingUp, User } from "lucide-react";
import { api, fmtMoney, driveImg, type Artist } from "@/lib/api";

export const Route = createFileRoute("/charts")({
  component: Charts,
});

function Charts() {
  const [data, setData] = useState<Artist[] | null>(null);
  const [tab, setTab] = useState<"prestigio" | "fortuna" | "saldo">("prestigio");

  useEffect(() => {
    api.listarTodos().then(setData);
  }, []);

  const sorted = (data || []).slice().sort((a, b) => {
    if (tab === "prestigio") return b.prestigio - a.prestigio;
    if (tab === "fortuna") return b.fortuna_total - a.fortuna_total;
    return b.saldo - a.saldo;
  });

  return (
    <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6 pb-20">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Crown className="size-6 text-primary" fill="currentColor" />
          <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Empire Rankings</h1>
        </div>
        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest pl-1">
          O estado atual da soberania musical
        </p>
      </header>

      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {[
          { id: "prestigio" as const, label: "Prestígio", icon: <TrendingUp className="size-3" /> },
          { id: "fortuna" as const, label: "Fortuna", icon: <Crown className="size-3" /> },
          { id: "saldo" as const, label: "Empire Coin", icon: <User className="size-3" /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${
              tab === t.id 
                ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" 
                : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <section>
        {data === null ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-2xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : (
          <ol className="space-y-2">
            {sorted.slice(0, 50).map((a, i) => (
              <li key={a.nome} className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                <span
                  className={`w-6 text-center font-black text-lg ${i < 3 ? "text-primary" : "text-muted-foreground/30"}`}
                >
                  {i + 1}
                </span>
                <img
                  src={driveImg(a.foto)}
                  alt={a.nome}
                  loading="lazy"
                  className="size-12 rounded-xl object-cover bg-secondary border border-white/10 grayscale"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm uppercase tracking-tight truncate">{a.nome}</p>
                  <p className="text-[10px] font-bold text-muted-foreground">{a.gravadora}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black ${tab === "prestigio" ? "text-[11px]" : "text-xs"}`}>
                    {tab === "prestigio"
                      ? `${a.prestigio}`
                      : tab === "fortuna"
                        ? fmtMoney(a.fortuna_total)
                        : `EC ${a.saldo.toLocaleString("pt-BR")}`}
                  </p>
                  <p className="text-[7px] text-muted-foreground uppercase font-black">
                    {tab === "prestigio" ? "PONTOS" : "TOTAL"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
