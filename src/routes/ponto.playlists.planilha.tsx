import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { PlanilhaGrid } from "@/components/PlanilhaGrid";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";

export const Route = createFileRoute("/ponto/playlists/planilha")({
  component: PlaylistsPlanilha,
});

function PlaylistsPlanilha() {
  const { user, ready } = useTelegramUser();
  const tgId = String(user?.id ?? "");

  if (!ready)
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );

  if (!tgId)
    return (
      <div className="p-6 text-center text-muted-foreground">Abra o app pelo Telegram para acessar esta tela.</div>
    );

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <Link to="/ponto/playlists" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </Link>
      <h2 className="text-xl font-bold">Playlists · Manual</h2>
      <p className="text-sm text-muted-foreground">
        Apenas as colunas marcadas como editáveis aceitam mudanças. Linhas já preenchidas por outros jogadores ficam
        travadas.
      </p>
      <PlanilhaGrid loader={() => api.listarPlaylistsJogador(tgId)} saver={(p) => api.salvarCelulaPlaylist(p)} />
    </div>
  );
}
