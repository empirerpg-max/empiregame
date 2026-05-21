import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { PlanilhaGrid } from "@/components/PlanilhaGrid";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";

export const Route = createFileRoute("/ponto/playlists/planilha")({
  component: PlaylistsPlanilha,
});

function PlaylistsPlanilha() {
  const { user } = useTelegramUser();
  const tgId = String(user?.id ?? "");

  return (
    <div className="...">
      <Link to="/ponto/playlists">
        <ChevronLeft /> Voltar
      </Link>
      <h2>Playlists · Manual</h2>
      <p>
        Apenas as colunas marcadas como editáveis aceitam mudanças. Linhas já preenchidas por outros jogadores ficam
        travadas.
      </p>
      <PlanilhaGrid loader={(p) => api.listarPlaylistsJogador(tgId)} saver={(p) => api.salvarCelulaPlaylist(p)} />
    </div>
  );
}
