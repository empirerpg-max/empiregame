import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Loader2, Zap, Edit3 } from "lucide-react";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";
import { notify } from "@/lib/notify";

export const Route = createFileRoute("/ponto/playlists")({
  component: PontoPlaylists,
});

function PontoPlaylists() {
  const { user } = useTelegramUser();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);

  async function distribuirAuto() {
    if (!user?.id) return;
    setRunning(true);
    const r = await api.distribuirPlaylistsAuto(String(user.id));
    notify(r, { successFallback: "Playlists distribuídas" });
    setRunning(false);
  }

  return (
    <main className="flex-1 mx-auto w-full max-w-md px-6 pt-6 pb-24">
      <Link to="/ponto" className="inline-flex items-center gap-1 text-muted-foreground mb-6 text-sm">
        <ChevronLeft className="size-4" /> Voltar
      </Link>
      <h1 className="text-2xl font-black italic tracking-tighter mb-1">Aplicar playlists</h1>
      <p className="text-sm text-muted-foreground mb-6">Como você quer aplicar?</p>

      <div className="space-y-3">
        <button
          onClick={distribuirAuto}
          disabled={running}
          className="w-full text-left p-5 rounded-3xl bg-card border border-white/5 hover:border-primary/40 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
              {running ? <Loader2 className="size-6 animate-spin" /> : <Zap className="size-6" />}
            </div>
            <div>
              <h2 className="font-black uppercase">Conforme meu saldo</h2>
              <p className="text-xs text-muted-foreground">Música mais recente recebe playlist máxima primeiro</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate({ to: "/ponto/playlists/planilha" })}
          className="w-full text-left p-5 rounded-3xl bg-card border border-white/5 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
              <Edit3 className="size-6" />
            </div>
            <div>
              <h2 className="font-black uppercase">Manualmente</h2>
              <p className="text-xs text-muted-foreground">Editar a planilha ECOIN + INVESTIMENTO no app</p>
            </div>
          </div>
        </button>
      </div>
    </main>
  );
}
