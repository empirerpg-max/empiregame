import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Mic2,
  Film,
  Disc3,
  Wallet,
  Trophy,
  Zap,
  Briefcase,
  Flame,
  HandHeart,
  X,
  Loader2,
  ShoppingBag,
  Building2,
  Gavel,
  Radio,
  FileX,
  TrendingUp,
  Lock,
} from "lucide-react";
import { useTelegramUser } from "@/lib/telegram";
import { api, fmtEC, fmtMoney, driveImg, type Artist, type AlbumPayload } from "@/lib/api";
import { notify } from "@/lib/notify";

export const Route = createFileRoute("/artistas/$nome/")({
  component: ArtistDashboard,
});

function ArtistDashboard() {
  const { nome } = Route.useParams();
  const { user, ready } = useTelegramUser();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"bens" | "entretenimento" | "tours">("entretenimento");
  const [modal, setModal] = useState<
    null | "viral" | "filantropia" | "payola" | "leilao" | "rescisao" | "composicao" | "imovel"
  >(null);
  const [albuns, setAlbuns] = useState<AlbumPayload[]>([]);
  const [tourData, setTourData] = useState<any>(null);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);

    const safeNome = decodeURIComponent(nome || "")
      .trim()
      .toLowerCase();

    Promise.all([
      // Carrega TODOS os artistas para permitir visualizar qualquer perfil
      api.listarTodos().catch(() => []),
      api.listarAlbuns(nome).catch(() => []),
      api.listTours().catch(() => []),
      // Carrega artistas do usuário para verificar propriedade
      user && user.id !== "guest" ? api.meusArtistas(user.id).catch(() => []) : Promise.resolve([]),
    ]).then(([allArtists, albunsList, toursList, myArtists]) => {
      // Encontra o artista na lista completa
      const art = (allArtists as Artist[]).find((a) => a.nome?.trim().toLowerCase() === safeNome) || null;
      setArtist(art);
      setAlbuns(albunsList);

      // Verifica se o artista pertence ao usuário logado
      const mine = (myArtists as Artist[]).some((a) => a.nome?.trim().toLowerCase() === safeNome);
      setIsOwner(mine);

      // Busca dados de turnê
      const tList = (toursList as any[]).find((t) => t.artista?.trim().toLowerCase() === safeNome);
      if (tList) {
        setTourData({
          titulo: tList.titulo || "The Empire Tour",
          realizados: Number(tList.show_atual || 0),
          total: Number(tList.total_shows || 0),
          status: tList.status || "Em andamento",
        });
      } else if (art && art.tour_info) {
        let info: any = art.tour_info;
        if (typeof info === "string") {
          try {
            info = JSON.parse(
              info
                .trim()
                .replace(/^"+|"+$/g, "")
                .replace(/\\"/g, '"'),
            );
          } catch {
            info = {};
          }
        }
        if (info.titulo) {
          setTourData({
            titulo: info.titulo,
            realizados: Number(info.shows_realizados || info.realizados || 0),
            total: Number(info.qtd || info.shows || 0),
            status: info.status || "Em andamento",
          });
        }
      }

      setLoading(false);
    });
  }, [ready, user, nome]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Sincronizando Artista...
        </p>
      </div>
    );
  }

  if (!artist) {
    return (
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 pt-6">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1 text-muted-foreground mb-4"
        >
          <ChevronLeft className="size-4" /> Voltar
        </button>
        <div className="py-20 text-center">
          <FileX className="size-12 text-muted-foreground/20 mx-auto mb-4" />
          <p className="font-black uppercase italic tracking-tighter">Artista não encontrado no império.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 pb-24 bg-background">
      {/* Visual Header */}
      <div className="relative h-[30vh] min-h-[240px] overflow-hidden">
        <img
          loading="lazy"
          decoding="async"
          src={driveImg(artist.foto, 1200) || artist.foto}
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src !== artist.foto) img.src = artist.foto;
          }}
          className="w-full h-full object-cover object-top scale-105 opacity-60 transition-opacity duration-700"
          alt=""
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        <button
          onClick={() => window.history.back()}
          className="absolute top-6 left-6 z-30 size-12 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
        >
          <ChevronLeft className="size-6 text-white" />
        </button>

        {/* Badge: artista de outro jogador */}
        {!isOwner && (
          <div className="absolute top-6 right-6 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/10">
            <Lock className="size-3 text-white/50" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Visualização</span>
          </div>
        )}

        {/* Info Overlay */}
        <div className="absolute inset-x-6 bottom-6 z-20">
          <div className="flex items-end gap-4">
            <div className="size-24 rounded-[2rem] overflow-hidden border-2 border-primary/30 shadow-2xl shrink-0 bg-secondary">
              <img
                loading="lazy"
                decoding="async"
                src={driveImg(artist.foto, 400) || artist.foto}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src !== artist.foto) img.src = artist.foto;
                }}
                className="w-full h-full object-cover object-top"
                alt={artist.nome}
              />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 leading-none">
                  {artist.gravadora}
                </span>
                {artist.genero &&
                  !/GMT|\d{4}.*\d{2}:\d{2}|^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(String(artist.genero)) && (
                    <span className="text-[11px] font-black text-white/50 uppercase tracking-widest italic">
                      {artist.genero}
                    </span>
                  )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter leading-tight mb-1 drop-shadow-xl break-words">
                {artist.nome}
              </h1>
              <div className="flex items-center gap-2">
                <div
                  className={`size-1.5 rounded-full ${
                    artist.status === "Livre" ? "bg-primary animate-pulse" : "bg-yellow-500"
                  }`}
                />
                <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">{artist.status}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-8 relative z-20 -mt-2">
        {/* ── Core Stats: Empire Coin + Fortuna + Prestígio + Fadiga ── */}
        <div className="grid grid-cols-2 gap-2">
          <StatCardV2
            label="Empire Coin (E$C)"
            value={fmtEC(artist.saldo)}
            icon={<Wallet className="size-3.5" />}
            accent
          />
          <StatCardV2
            label="Fortuna Total"
            value={fmtMoney(artist.fortuna_total)}
            icon={<Briefcase className="size-3.5" />}
          />
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <StatCompact
              label="Prestígio Imperial"
              value={artist.prestigio}
              max={1000}
              icon={<Trophy className="size-3.5" />}
              color="text-amber-400"
            />
            <StatCompact
              label="Fadiga Vocal"
              value={artist.fadiga}
              max={100}
              icon={<Zap className="size-3.5" />}
              color="text-rose-400"
              reverse
            />
          </div>
          {/* Fortuna detalhada: real + bens */}
          <StatCardV2
            label="Fortuna em Caixa"
            value={fmtMoney(artist.fortuna_real)}
            icon={<Wallet className="size-3.5" />}
          />
          <StatCardV2
            label="Fortuna em Bens"
            value={fmtMoney(artist.fortuna_bens)}
            icon={<Building2 className="size-3.5" />}
          />
        </div>

        {/* ── Ações rápidas — apenas para o dono do artista ── */}
        {isOwner && (
          <div className="grid grid-cols-3 gap-3">
            <QuickAction
              icon={<Disc3 className="size-6 text-purple-400" />}
              label="Álbum"
              id="btn-album"
              to="/acoes/album"
              params={{ nome: artist.nome }}
            />
            <QuickA