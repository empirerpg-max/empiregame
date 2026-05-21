import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { PlanilhaGrid } from "@/components/PlanilhaGrid";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/ponto/distribuir/planilha")({
  component: PontoPlanilha,
});

function PontoPlanilha() {
  const { user, ready } = useTelegramUser();
  const [debug, setDebug] = useState<string>("aguardando...");

  useEffect(() => {
    setDebug(`ready=${String(ready)} | user.id=${String(user?.id ?? "null")}`);
    if (!ready) return;
    if (!user?.id) {
      setDebug("ready=true mas user.id é null/undefined");
      return;
    }
    setDebug(`Chamando API com tgId=${user.id}...`);
    api
      .listarPontosJogador(String(user.id))
      .then((r) => {
        setDebug("Resposta: " + JSON.stringify(r).slice(0, 300));
      })
      .catch((e) => {
        setDebug("ERRO: " + e.message);
      });
  }, [ready, user?.id]);

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <Link to="/ponto/distribuir" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </Link>
      <h2 className="text-xl font-bold">Pontos · Manual</h2>

      {/* DEBUG — remover depois */}
      <div className="bg-yellow-900/40 border border-yellow-500/40 rounded-xl p-3 text-xs text-yellow-200 break-all">
        {debug}
      </div>

      <PlanilhaGrid loader={(tgId) => api.listarPontosJogador(tgId)} saver={(p) => api.salvarCelulaPontos(p)} />
    </div>
  );
}
