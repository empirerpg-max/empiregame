import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PlanilhaGrid } from "@/components/PlanilhaGrid";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";

export const Route = createFileRoute("/ponto/distribuir/planilha")({
  component: PontoPlanilha,
});

function PontoPlanilha() {
  const { user } = useTelegramUser();
  const tgId = String(user?.id ?? "");

  return (
    <div className="...">
      <Link to="/ponto/distribuir">
        <ChevronLeft /> Voltar
      </Link>
      <h2>Pontos · Manual</h2>
      <p>Edite somente as células permitidas. As alterações vão pra planilha automaticamente.</p>
      <PlanilhaGrid loader={(p) => api.listarPontosJogador(tgId)} saver={(p) => api.salvarCelulaPontos(p)} />
    </div>
  );
}
