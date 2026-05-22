import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Shuffle, Edit3 } from "lucide-react";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";
import { notify } from "@/lib/notify";

export const Route = createFileRoute("/ponto/distribuir/")({
  component: PontoDistribuirHome,
});

function PontoDistribuirHome() {
  const { user } = useTelegramUser();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);

  async function distribuirAleatorio() {
    if (!user?.id) return;
    setRunning(true);
    const r = await api.distribuirPontosAleatorio(String(user.id));
    notify(r, { successFallback: "Pontos atribuídos com sucesso" });
    setRunning(false);
  }

  return (
    <main className="flex-1 mx-auto w-full max-w-md px-6 pt-6 pb-24">
      <Link to="/ponto" className="inline-flex items-center gap-1 text-muted-foreground mb-6 text-sm">
        <ChevronLeft className="size-4" /> Voltar
      </Link>
      <h1 className="text-2xl font-black italic tracking-tighter mb-1">Distribuir pontos</h1>
      <p className="text-sm text-muted-foreground mb-6">Como você quer fazer?</p>

      <div className="space-y-3">
        <button
          onClick={distribuirAleatorio}
          disabled={running}
          className="w-full text-left p-5 rounded-3xl bg-card border border-white/5 hover:border-primary/40 transition-colors disabled:opacity-50 flex items-center gap-4"
        >
          <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
            {running ? <Loader2 className="size-6 animate-spin" /> : <Shuffle className="size-6" />}
          </div>
          <div className="flex-1">
            <h2 className="font-black uppercase tracking-tight">Aleatoriamente</h2>
            <p className="text-xs text-muted-foreground">O script distribui % por categoria (soma 100)</p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>

        <button
          onClick={() => navigate({ to: "/ponto/distribuir/planilha" })}
          className="w-full text-left p-5 rounded-3xl bg-card border border-white/5 hover:border-primary/40 transition-colors flex items-center gap-4"
        >
          <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <Edit3 className="size-6" />
          </div>
          <div className="flex-1">
            <h2 className="font-black uppercase tracking-tight">Manualmente</h2>
            <p className="text-xs text-muted-foreground">Editar a planilha de pontos no app</p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
      </div>
    </main>
  );
}
