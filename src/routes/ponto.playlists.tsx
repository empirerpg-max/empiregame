import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ListMusic, Music2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/ponto/playlists")({
  component: PontoPlaylists,
});

function PontoPlaylists() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pt-6 pb-24 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/ponto" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Playlists</h1>
          <p className="text-xs text-muted-foreground">Invista nas suas músicas</p>
        </div>
      </div>

      {/* Cards de opção */}
      <div className="flex flex-col gap-3 mt-2">
        <button
          onClick={() => navigate({ to: "/ponto/playlists/planilha" })}
          className="w-full text-left p-5 rounded-2xl bg-card border border-white/8 hover:border-primary/50 hover:bg-white/5 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
              <Music2 size={22} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Manual · Música por música</p>
              <p className="text-xs text-muted-foreground mt-0.5">Escolha a música e distribua nas plataformas</p>
            </div>
            <ChevronLeft
              size={16}
              className="text-muted-foreground rotate-180 group-hover:translate-x-1 transition-transform"
            />
          </div>
        </button>

        <button
          onClick={() => navigate({ to: "/ponto/playlists/planilha" })}
          className="w-full text-left p-5 rounded-2xl bg-card border border-white/8 hover:border-primary/50 hover:bg-white/5 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
              <ListMusic size={22} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Planilha completa</p>
              <p className="text-xs text-muted-foreground mt-0.5">Edite todas as músicas diretamente na tabela</p>
            </div>
            <ChevronLeft
              size={16}
              className="text-muted-foreground rotate-180 group-hover:translate-x-1 transition-transform"
            />
          </div>
        </button>
      </div>
    </div>
  );
}
