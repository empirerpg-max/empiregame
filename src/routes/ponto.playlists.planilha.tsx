import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { PlanilhaGrid } from "@/components/PlanilhaGrid";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";

export const Route = createFileRoute("/ponto/playlists/planilha")({
  component: PlaylistsPlanilha,
});

const OPCOES_PLAYLISTS = {
  SPOTIFY: [
    "TOPO TODAY'S TOP HITS",
    "TODAY'S TOP HITS",
    "POP UP",
    "ROCK SOLID",
    "RAP CAVIAR",
    "MINT",
    "ARE & BE",
    "VIVA LATINO",
    "ALTERNATIVE PARTY",
    "JUST HITS",
    "NEW SONGS",
    "WORKOUT TIME",
    "RANDOM SONGS",
    "THIS IS... (ARTIST)",
  ],
  "APPLE MUSIC": [
    "TOPO TODAY'S HITS",
    "TODAY'S HITS",
    "A-LIST POP",
    "hyped<D>",
    "RAPLIFE",
    "danceXL",
    "R&B NOW",
    "!DalePlay!",
    "ALT CTRL",
    "JUST HITS",
    "JUST NEW",
    "GYM SONGS",
    "RANDOM SONGS",
    "JUST... (ARTIST)",
  ],
  YOUTUBE: ["Ad 5 segundos (Comercial/Vídeo)", "Ad 30 segundos (Comercial/Vídeo)", "Ad (Vídeo Completo)"],
};

function PlaylistsPlanilha() {
  const { user, ready } = useTelegramUser();

  if (!ready)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );

  if (!user?.id)
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Abra o app pelo Telegram para acessar esta tela.
      </div>
    );

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <Link to="/ponto/playlists" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </Link>
      <div>
        <h2 className="text-xl font-black italic tracking-tighter">Playlists · Manual</h2>
        <p className="text-xs text-muted-foreground mt-1">Toque em uma música para escolher as playlists.</p>
      </div>
      <PlanilhaGrid
        tgId={String(user.id)}
        loader={(tgId) => api.listarPlaylistsJogador(tgId)}
        saver={(p) => api.salvarCelulaPlaylist(p)}
        opcoesColunas={OPCOES_PLAYLISTS}
      />
    </div>
  );
}
