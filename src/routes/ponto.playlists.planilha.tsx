import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PlanilhaGrid } from "@/components/PlanilhaGrid";
import { api } from "@/lib/api";

export const Route = createFileRoute("/ponto/playlists/planilha")({
  component: PontoPlaylistsPlanilha,
});

function PontoPlaylistsPlanilha() {
  return (
    <main className="flex-1 mx-auto w-full max-w-md px-6 pt-6 pb-24">
      <Link to="/ponto/playlists" className="inline-flex items-center gap-1 text-muted-foreground mb-6 text-sm">
        <ChevronLeft className="size-4" /> Voltar
      </Link>
      <h1 className="text-2xl font-black italic tracking-tighter mb-1">Playlists · Manual</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Escolha a playlist para cada plataforma. Linhas já preenchidas por outros jogadores ficam travadas.
      </p>
      <PlanilhaGrid loader={(tgId) => api.listarPlaylistsJogador(tgId)} saver={(p) => api.salvarCelulaPlaylist(p)} />
    </main>
  );
}
