import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Music2 } from "lucide-react";

function PontoPlaylists() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pt-6 pb-24 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link to="/ponto" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Playlists</h1>
          <p className="text-xs text-muted-foreground">Invista nas suas m&#xFA;sicas</p>
        </div>
      </div>

      <button
        onClick={() => navigate({ to: "/ponto/playlists/planilha" })}
        className="w-full text-left p-5 rounded-2xl bg-card border border-white/8 hover:border-primary/50 hover:bg-white/5 transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
            <Music2 size={22} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Manual &middot; M&#xFA;sica por m&#xFA;sica</p>
            <p className="text-xs text-muted-foreground mt-0.5">Escolha a m&#xFA;sica e distribua nas plataformas</p>
          </div>
          <ChevronLeft
            size={16}
            className="text-muted-foreground rotate-180 group-hover:translate-x-1 transition-transform"
          />
        </div>
      </button>
    </div>
  );
}

export const Route = createFileRoute("/ponto/playlists")({
  component: PontoPlaylists,
});
