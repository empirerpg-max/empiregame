import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  RefreshCw,
  ChevronRight,
  TrendingUp,
  User,
  Wallet,
  Star,
  Plus,
  Radio,
  Music2,
  Music,
  PlayCircle,
  Disc,
  BarChart3,
  ListMusic,
} from "lucide-react";
import { toast } from "sonner";
import { useTelegramUser } from "@/lib/telegram";
import { api, driveImg, fmtEC, type Artist, type RadarItem, invalidateCache, type ChartData } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [myArtists, setMyArtists] = useState<Artist[] | null>(null);
  const [radarFeed, setRadarFeed] = useState<RadarItem[] | null>(null);
  const [topCharts, setTopCharts] = useState<Record<string, ChartData>>({});
  const { user, ready } = useTelegramUser();

  const fetchData = async () => {
    // Carregar Meus Artistas
    if (user && user.id !== "guest") {
      api.meusArtistas(user.id).then(setMyArtists).catch(() => setMyArtists([]));
    } else {
      setMyArtists([]);
    }
    
    // Carregar Radar
    api.radar().then(setRadarFeed).catch(() => setRadarFeed([]));
    
    // Carregar Charts
    api.topCharts().then(setTopCharts).catch(() => {});
  };

  useEffect(() => {
    if (!ready) return;
    fetchData();
  }, [ready, user]);

  const handleSync = () => {
    invalidateCache();
    toast.success("Empire Sincronizado", {
      description: "Dados imperiais atualizados com sucesso.",
    });
    fetchData();
  };

  const openLinkModal = () => (window as any).setShowLinkModal?.(true);

  return (
    <div className="pb-24 px-4 pt-6 max-w-md mx-auto min-h-screen">
      {/* Header Estilo Dashboard */}
      <header className="flex items-center justify-between mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none mb-1">
            Empire <span className="text-primary">Hub</span>
          </h1>
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-[0.2em] pr-1">
            Plataforma de Gestão Imperial
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSync}
            className="size-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center active:scale-90 transition-transform hover:bg-primary/10 hover:text-primary transition-colors"
            title="Sincronizar"
          >
            <RefreshCw className="size-4" />
          </button>
          <div className="size-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
            {user?.photo_url ? (
               <img src={user.photo_url} className="size-10 rounded-full object-cover" />
            ) : (
               <User className="size-5 text-primary" />
            )}
          </div>
        </div>
      </header>

      {/* CARROSSEL MEUS ARTISTAS (Destaque Principal) */}
      <section className="mb-10 animate-in fade-in slide-in-from-left-4 duration-1000 delay-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2">
            <div className="size-2 rounded-full bg-primary animate-pulse" />
            Meus Artistas
          </h2>
          <div className="flex items-center gap-4">
            <Link 
              to="/artistas" 
              search={{ filter: "all" }}
              className="text-[10px] font-black uppercase text-muted-foreground tracking-widest hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <div className="size-1 bg-muted-foreground rounded-full" />
              Empire Artists
            </Link>
            <Link 
              to="/artistas" 
              search={{ filter: "mine" }}
              className="text-[10px] font-black uppercase text-primary tracking-widest hover:underline"
            >
              Ver Tudo
            </Link>
          </div>
        </div>
        
        {myArtists === null ? (
          <div className="flex gap-3 overflow-x-hidden">
            {[1,2].map(i => <div key={i} className="min-w-[180px] h-24 rounded-[1.5rem] bg-white/5 animate-pulse" />)}
          </div>
        ) : myArtists.length === 0 ? (
          <div 
            onClick={openLinkModal}
            className="p-6 rounded-[2rem] bg-card/50 border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-primary/5 transition-all group"
          >
            <Plus className="size-6 text-primary/40 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Nenhum artista vinculado - Toque para conectar
            </span>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 snap-x">
            {myArtists.map((a) => (
              <Link
                key={a.nome}
                to="/artistas/$nome"
                params={{ nome: a.nome }}
                className="min-w-[110px] snap-center p-2 rounded-[1.5rem] bg-white/5 backdrop-blur-md border border-white/10 flex flex-col items-center gap-2 active:scale-95 transition-all group"
              >
                <div className="size-14 rounded-[1rem] bg-secondary overflow-hidden flex-shrink-0 border border-white/10 shadow-lg group-hover:scale-105 transition-transform">
                  <img src={driveImg(a.foto, 150)} className="w-full h-full object-cover" alt={a.nome} />
                </div>
                <div className="text-center w-full px-1 overflow-hidden">
                  <h3 className="text-xs font-black uppercase truncate leading-tight group-hover:text-primary transition-colors">
                    {a.nome}
                  </h3>
                  <p className="text-[10px] font-bold text-primary/70 mt-0.5 whitespace-nowrap overflow-hidden">{fmtEC(a.saldo)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* BILLBOARD HOT 100 - Glass Style Highlight */}
      {(topCharts.billboard_hot_100 || true) && (() => {
        const data = topCharts.billboard_hot_100;
        const finalUrl = data?.url || 'https://empirerpg-max.github.io/central/charts.html?tab=BILLBOARD%20HOT%20100';
        
        return (
          <section className="mb-12 animate-in fade-in zoom-in duration-1000 delay-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black uppercase tracking-[0.3em]">Billboard Hot 100 #1</h2>
            </div>
            <a 
              href={finalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-[16/10] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl bg-white/5"
            >
              {data?.foto ? (
                <img 
                  src={driveImg(data.foto, 800)} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                  alt="Billboard #1"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 opacity-20">
                  <TrendingUp className="size-20" />
                  <span className="text-[10px] font-black uppercase tracking-[0.5em]">Global Chart</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
              
              {/* Glass Info Overlay */}
              <div className="absolute inset-x-4 bottom-4 p-5 rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0 animate-bounce">
                     <TrendingUp className="size-6 text-black" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-white text-xs font-black uppercase tracking-tight leading-tight mb-1 line-clamp-1">
                      {data?.musica || "Ver Billboard Hot 100"}
                    </h4>
                    <p className="text-primary text-[10px] font-black uppercase tracking-widest truncate">
                      {data?.artista || "Dados Semanais"}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="absolute top-6 right-6">
                <div className="px-5 py-2.5 rounded-full bg-primary text-black text-[10px] font-black uppercase tracking-widest shadow-xl">
                  Charts This Week
                </div>
              </div>
            </a>
          </section>
        );
      })()}

      {/* PLATFORM CHARTS - INTERACTIVE SCROLL */}
      <section className="mb-12 animate-in fade-in slide-in-from-right-4 duration-1000 delay-400">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] mb-4 px-1 opacity-50 text-center">Global Top Positions</h2>
        <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide -mx-4 px-4 snap-x">
          {[
            { id: 'spotify', label: 'Spotify', icon: Music2, color: 'text-[#1DB954]', link: 'https://empirerpg-max.github.io/central/charts.html?tab=SPOTIFY' },
            { id: 'apple_music', label: 'Apple Music', icon: Music, color: 'text-[#FC3C44]', link: 'https://empirerpg-max.github.io/central/charts.html?tab=APPLE%20MUSIC' },
            { id: 'youtube', label: 'YouTube', icon: PlayCircle, color: 'text-[#FF0000]', link: 'https://empirerpg-max.github.io/central/charts.html?tab=YOUTUBE' },
            { id: 'billboard_200', label: 'Billboard 200', icon: Disc, color: 'text-primary', link: 'https://empirerpg-max.github.io/central/charts.html?tab=DADOS%20%C3%81LBUNS' },
            { id: 'digital_sales', label: 'Digital Sales', icon: BarChart3, color: 'text-blue-500', link: 'https://empirerpg-max.github.io/central/charts.html?tab=DIGITAL%20SALES' }
          ].map(plat => {
            const data = topCharts[plat.id];
            const finalUrl = data?.url || plat.link;
            return (
              <a
                key={plat.id}
                href={finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-[150px] snap-center group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 backdrop-blur-md active:scale-95 transition-all shadow-xl"
              >
                <div className="aspect-square overflow-hidden relative">
                  {data?.foto ? (
                    <img 
                      src={driveImg(data.foto, 400)} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 grayscale group-hover:grayscale-0" 
                      alt={plat.label}
                    />
                  ) : (
                    <div className="w-full h-full bg-secondary flex flex-col items-center justify-center p-4">
                       <plat.icon className={`size-12 ${plat.color} opacity-20 mb-2`} />
                       <span className="text-[8px] font-black uppercase opacity-20 text-center">Abrir Parada</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3 size-9 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10">
                    <plat.icon className={`size-5 ${plat.color}`} />
                  </div>
                </div>
                <div className="p-4">
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] text-primary mb-1 block">{plat.label}</span>
                  <h4 className="text-xs font-black uppercase leading-tight line-clamp-1">
                    {data?.musica || "Ver Parada"}
                  </h4>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold truncate opacity-60">
                    {data?.artista || "Clique para abrir"}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* EMPIRE PLAYLISTS - NOVA SEÇÃO */}
      <section className="mb-12 animate-in fade-in slide-in-from-left-4 duration-1000 delay-[450ms]">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2">
            <ListMusic className="size-4 text-primary" />
            Empire Playlists
          </h2>
          <Link to="/playlists" className="text-[9px] font-black uppercase text-muted-foreground tracking-widest hover:text-primary transition-colors">Explorar Todas</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <a 
            href="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group relative h-28 rounded-[2rem] overflow-hidden border border-white/5 bg-[#1DB954]/10 transition-all hover:border-[#1DB954]/40"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#1DB954]/20 to-transparent" />
            <div className="relative p-4 h-full flex flex-col justify-between">
              <Music2 className="size-6 text-[#1DB954]" />
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-[#1DB954]/70">Spotify</p>
                <h4 className="text-[11px] font-black uppercase tracking-tight text-white leading-tight">Elite Hits</h4>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 size-16 bg-[#1DB954] opacity-5 blur-2xl group-hover:opacity-20 transition-opacity" />
          </a>
          
          <a 
            href="https://music.apple.com/us/playlist/todays-hits/pl.f4d1e2e1" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group relative h-28 rounded-[2rem] overflow-hidden border border-white/5 bg-[#FC3C44]/10 transition-all hover:border-[#FC3C44]/40"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#FC3C44]/20 to-transparent" />
            <div className="relative p-4 h-full flex flex-col justify-between">
              <Music className="size-6 text-[#FC3C44]" />
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-[#FC3C44]/70">Apple Music</p>
                <h4 className="text-[11px] font-black uppercase tracking-tight text-white leading-tight">Chart Top 50</h4>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 size-16 bg-[#FC3C44] opacity-5 blur-2xl group-hover:opacity-20 transition-opacity" />
          </a>
        </div>
      </section>

      {/* Radar Feed - Compact Design */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2">
             <Radio className="size-4 text-red-500 animate-pulse" />
             Radar Feed
          </h2>
          <span className="text-[10px] font-black uppercase text-muted-foreground opacity-30">Últimas Atualizações</span>
        </div>
        
        <div className="space-y-4">
          {radarFeed === null ? (
            [1,2,3].map(i => <div key={i} className="h-20 rounded-[2rem] bg-white/5 animate-pulse" />)
          ) : radarFeed.length === 0 ? (
             <div className="p-10 text-center text-xs uppercase font-black text-muted-foreground opacity-30">Silêncio no Radar...</div>
          ) : (
            radarFeed.map((item, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-4 p-5 rounded-[2.5rem] bg-card/40 border border-white/5 hover:bg-white/5 transition-colors group"
              >
                <div className="size-14 rounded-[1.5rem] bg-secondary flex-shrink-0 overflow-hidden ring-2 ring-white/5 border border-white/10">
                  <img src={driveImg(item.foto, 150)} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="Radar" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-xs font-black uppercase truncate group-hover:text-primary transition-colors">
                      {item.nome}
                    </h4>
                    <span className="text-[10px] font-mono text-primary/50 flex-shrink-0 uppercase">
                      Live
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/80 font-medium line-clamp-1 mt-0.5">
                    {item.acao}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <footer className="mt-16 text-center pb-8 border-t border-white/5 pt-8">
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground/20">
           Empire Hub • Est. 2026 • RPG Industry
        </p>
      </footer>
    </div>
  );
}
