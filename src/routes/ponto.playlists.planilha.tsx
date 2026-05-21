import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PlanilhaGrid } from "@/components/PlanilhaGrid";
import { api } from "@/lib/api";

export const Route = createFileRoute("/ponto/playlists/planilha")({
  component: PlaylistsPlanilha,
});

function PlaylistsPlanilha() {
  return (
    <main className="flex-1 mx-auto w-full max-w-5xl px-4 pt-6 pb-24">
      <Link to="/ponto/playlists" className="inline-flex items-center gap-1 text-muted-foreground mb-4 text-sm">
        <ChevronLeft className="size-4" /> Voltar
      </Link>
      <h1 className="text-2xl font-black italic tracking-tighter mb-1">Playlists · Manual</h1>
      <p className="text-xs text-muted-foreground mb-6">
        Apenas as colunas marcadas como editáveis aceitam mudanças. Linhas já preenchidas por outros jogadores ficam travadas.
      </p>

      <PlanilhaGrid
        loader={(tgId) => api.listarPlaylistsJogador(tgId)}
        saver={(p) => api.salvarCelulaPlaylist(p)}
      />
    </main>
  );
}
