import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Music2 } from "lucide-react";

export const Route = createFileRoute("/ponto/playlists/")({
  component: PontoPlaylistsHome,
});

function PontoPlaylistsHome() {
  return (
    <main className="flex-1 mx-auto w-full max-w-md px-6 pt-6 pb-24">
      <Link to="/ponto" className="inline-flex items-center gap-1 text-muted-foreground mb-6 text-sm">
        <ChevronLeft className="size-4" /> Voltar
      </Link>
      <h1 className="text-2xl font-black italic tracking-tighter mb-1">Aplicar playlists</h1>
      <p className="text-sm text-muted-foreground mb-6">Invista nas suas músicas.</p>

      <Link
        to="/ponto/playlists/planilha"
        className="w-full text-left p-5 rounded-3xl bg-card border border-white/5 hover:border-primary/40 transition-colors flex items-center gap-4"
      >
        <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
          <Music2 className="size-6" />
        </div>
        <div className="flex-1">
          <h2 className="font-black uppercase tracking-tight">Manual</h2>
          <p className="text-xs text-muted-foreground">Música por música nas plataformas</p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
    </main>
  );
}
