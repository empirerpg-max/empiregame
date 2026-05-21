import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PlanilhaGrid } from "@/components/PlanilhaGrid";
import { api } from "@/lib/api";

export const Route = createFileRoute("/ponto/distribuir/planilha")({
  component: PontoPlanilha,
});

function PontoPlanilha() {
  return (
    <main className="flex-1 mx-auto w-full max-w-5xl px-4 pt-6 pb-24">
      <Link to="/ponto/distribuir" className="inline-flex items-center gap-1 text-muted-foreground mb-4 text-sm">
        <ChevronLeft className="size-4" /> Voltar
      </Link>
      <h1 className="text-2xl font-black italic tracking-tighter mb-1">Pontos · Manual</h1>
      <p className="text-xs text-muted-foreground mb-6">
        Edite somente as células permitidas. As alterações vão pra planilha automaticamente.
      </p>

      <PlanilhaGrid
        loader={(tgId) => api.listarPontosJogador(tgId)}
        saver={(p) => api.salvarCelulaPontos(p)}
      />
    </main>
  );
}
