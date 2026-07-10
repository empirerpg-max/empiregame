import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  Radio,
  Play,
  TrendingUp,
  Music,
  Tv,
  ListMusic,
  MessageSquare,
  Send,
  ChevronRight,
  Star,
  Home,
  Mic2,
  Clapperboard,
  ChevronLeft,
} from "lucide-react";
import { usePlay, type PlayItem } from "@/lib/playContext";

export const Route = createFileRoute("/play/")({
  component: PlayHomePage,
  head: () => ({
    meta: [
      { title: "Empire Play \u2022 Empire Hub" },
      { property: "og:title", content: "Empire Play \u2022 Empire Hub" },
      { property: "og:description", content: "Ou\u00e7a as m\u00fasicas, clipes e v\u00eddeos do Empire RPG." },
    ],
  }),
});

const API_URL =
  "https://script.google.com/macros/s/AKfycby1S1mIBXdj4hLqc9RYv1ZJjL7d5ct6to18FNPmpJn1KOnZrYCKJKPNe2LP0dPW-G8HOg/exec";

type Tab = "home" | "musicas" | "clipes" | "videos" | "forum";
type SheetItem = Record<string, string>;

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "home",    label: "In\u00edcio",  icon: Home },
  { id: "musicas", label: "M\u00fasicas",  icon: Music },
  { id: "clipes",  label: "Clipes",   icon: Clapperboard },
  { id: "videos",  label: "V\u00eddeos",  icon: Tv },
  { id: "forum",   label: "F\u00f3rum",   icon: MessageSquare },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s: string) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function getField(item: Record<string, string>, ...aliases: string[]): string {
  if (!item) return "";
  const keys = Object.keys(item);
  const normKeys = keys.map((k) => ({ orig: k, norm: norm(k) }));
  for (const alias of aliases) {
    const target = norm(alias);
    const found = normKeys.find((k) => k.norm === target);
    if (found && item[found.orig] != null && item[found.orig] !== "") return item[found.orig];
  }
  return "";
}

function extractDriveId(str: string): string | null {
  if (!str) return null;
  const m = String(str).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(str).match(/id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (!/^https?:\/\//.test(str) && !str.includes("/")) return str.trim();
  return null;
}

function driveThumb(capa: string, size = 300): string {
  if (!capa) return "";
  const id = extractDriveId(capa) || (capa.match(/^[a-zA-Z0-9_-]{20,}$/) ? capa : null);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${size}`;
  return capa;
}

function parseDataLancamento(item: SheetItem): number {
  const d = getField(item, "data_de_lancamento", "datadelancamento", "data");
  if (!d) return 0;
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
}

function toPlayItem(m: SheetItem, cat: PlayItem["categoria"]): PlayItem {
  const idTopico = getField(m, "id_do_topico", "idtopico", "id_topico");
  const audioSrc = getField(m, "id_do_arquivo", "idarquivo", "id_arquivo", "arquivo", "link", "url");
  const titulo =
    cat === "musica"
      ? getField(m, "nome_da_musica", "nomedamusica", "nome", "titulo")
      : getField(m, "tipo_de_clipe", "tipodeclipe", "tipo", "titulo");
  return {
    id: idTopico,
    titulo,
    artista: getField(m, "act_principal", "actprincipal"),
    capa: getField(m, "capa_da_musica", "capadamusica", "capa", "cover"),
    audioSrc,
    letra: getField(m, "letra", "lyrics"),
    categoria: cat,
  };
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonGrid({ cols = 3, rows = 2 }: { cols?: number; rows?: number }) {
  return (
    <div className={`grid grid-cols-${cols} gap-3`}>
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-square rounded-2xl bg-white/[0.05] animate-pulse" />
          <div className="h-3 w-3/4 rounded-full bg-white/[0.04] animate-pulse" />
          <div className="h-2.5 w-1/2 rounded-full bg-white/[0.03] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="size-12 rounded-xl bg-white/[0.05] animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded-full bg-white/[0.04] animate-pulse" />
            <div className="h-2.5 w-1/3 rounded-full bg-white/[0.03] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Card Components ──────────────────────────────────────────────────────────

function SongCard({ item, queue, idx }: { item: PlayItem; queue: PlayItem[]; idx: number }) {
  const { play, state } = usePlay();
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id;
  return (
    <button onClick={() => play(item, queue)} className="flex flex-col gap-2 text-left group w-full">
      <div className={`relative aspect-square w-full rounded-2xl overflow-hidden bg-primary/10 ${isActive ? "ring-2 ring-primary" : ""}  transition-all`}>
        {item.capa ? (
          <img src={driveThumb(item.capa, 300)} alt={item.titulo} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center"><Music className="size-8 text-primary/40" /></div>
        )}
        <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 grid place-items-center">
          <div className="size-10 rounded-full bg-primary/0 group-active:bg-primary/90 grid place-items-center transition-all">
            <Play className="size-5 text-white opacity-0 group-active:opacity-100" fill="white" />
          </div>
        </div>
        {isActive && (
          <div className="absolute bottom-2 left-2 flex gap-0.5 items-end">
            {[3, 5, 4].map((h, i) => (
              <div key={i} className="w-1 bg-primary rounded-full animate-bounce" style={{ height: `${h * 3}px`, animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? "text-primary" : ""}`}>{item.titulo || "\u2014"}</p>
        <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
      </div>
    </button>
  );
}

function VideoCard({ item, queue }: { item: PlayItem; queue: PlayItem[] }) {
  const { play, state } = usePlay();
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id;
  return (
    <button onClick={() => play(item, queue)} className="flex flex-col gap-2 text-left group w-full">
      <div className={`relative w-full rounded-2xl overflow-hidden bg-primary/10 aspect-video ${isActive ? "ring-2 ring-primary" : ""}  transition-all`}>
        {item.capa ? (
          <img src={driveThumb(item.capa, 400)} alt={item.titulo} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center"><Tv className="size-8 text-primary/40" /></div>
        )}
        <div className="absolute inset-0 grid place-items-center">
          <div className="size-10 rounded-full bg-black/40 group-active:bg-primary/90 grid place-items-center transition-all">
            <Play className="size-5 text-white" fill="white" />
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? "text-primary" : ""}`}>{item.titulo || "\u2014"}</p>
        <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
      </div>
    </button>
  );
}

function RowTrack({ item, queue, num }: { item: PlayItem; queue: PlayItem[]; num: number }) {
  const { play, state } = usePlay();
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id;
  return (
    <button
      onClick={() => play(item, queue)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ${
        isActive ? "bg-primary/10 border border-primary/30" : "hover:bg-white/[0.04] border border-transparent"
      }`}
    >
      <div className="size-5 flex-shrink-0 grid place-items-center">
        {isActive ? (
          <div className="flex gap-0.5 items-end">
            {[3, 5, 4].map((h, i) => (
              <div key={i} className="w-0.5 bg-primary rounded-full animate-bounce" style={{ height: `${h * 2}px`, animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ) : (
          <span className="text-[10px] font-black text-muted-foreground/50">{num}</span>
        )}
      </div>
      <div className="size-10 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
        {item.capa ? (
          <img src={driveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full grid place-items-center"><Music className="size-4 text-primary/30" /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? "text-primary" : ""}`}>{item.titulo || "\u2014"}</p>
        <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
      </div>
      <Play className="size-4 text-muted-foreground/40 flex-shrink-0" fill="currentColor" />
    </button>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, onMore }: { icon: React.ReactNode; title: string; onMore?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
        {icon}{title}
      </h2>
      {onMore && (
        <button onClick={onMore} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1 active:text-primary transition-colors">
          Ver tudo <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}

// ─── Tab Views ────────────────────────────────────────────────────────────────

function HomeTab({ musicasDB, musicVideosDB, videosDB, loading, onTabChange }: {
  musicasDB: SheetItem[];
  musicVideosDB: SheetItem[];
  videosDB: SheetItem[];
  loading: boolean;
  onTabChange: (t: Tab) => void;
}) {
  const destaques = useMemo<PlayItem[]>(
    () => [...musicasDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)).slice(0, 6).map((m) => toPlayItem(m, "musica")),
    [musicasDB]
  );
  const novosClipes = useMemo<PlayItem[]>(
    () => [...musicVideosDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)).slice(0, 4).map((m) => toPlayItem(m, "musicvideo")),
    [musicVideosDB]
  );
  const novosVideos = useMemo<PlayItem[]>(
    () => [...videosDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)).slice(0, 4).map((m) => toPlayItem(m, "video")),
    [videosDB]
  );

  if (loading) return <div className="space-y-8"><SkeletonGrid /><SkeletonGrid cols={2} /></div>;

  return (
    <div className="space-y-8">
      {destaques.length > 0 && (
        <section>
          <SectionHeader icon={<Star className="size-4 text-primary" />} title="Destaques" onMore={() => onTabChange("musicas")} />
          <div className="grid grid-cols-3 gap-3">
            {destaques.map((item, i) => <SongCard key={item.id} item={item} queue={destaques} idx={i} />)}
          </div>
        </section>
      )}
      {novosClipes.length > 0 && (
        <section>
          <SectionHeader icon={<Clapperboard className="size-4 text-primary" />} title="Novos Clipes" onMore={() => onTabChange("clipes")} />
          <div className="grid grid-cols-2 gap-3">
            {novosClipes.map((item) => <VideoCard key={item.id} item={item} queue={novosClipes} />)}
          </div>
        </section>
      )}
      {novosVideos.length > 0 && (
        <section>
          <SectionHeader icon={<Tv className="size-4 text-primary" />} title="V\u00eddeos" onMore={() => onTabChange("videos")} />
          <div className="grid grid-cols-2 gap-3">
            {novosVideos.map((item) => <VideoCard key={item.id} item={item} queue={novosVideos} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function MusicasTab({ musicasDB, loading }: { musicasDB: SheetItem[]; loading: boolean }) {
  const [subTab, setSubTab] = useState<"lancamentos" | "top" | "albuns">("lancamentos");

  const lancamentos = useMemo<PlayItem[]>(
    () => [...musicasDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)).map((m) => toPlayItem(m, "musica")),
    [musicasDB]
  );
  const top = useMemo<PlayItem[]>(
    () => [...musicasDB].sort((a, b) => (parseInt(getField(b, "weeks")) || 0) - (parseInt(getField(a, "weeks")) || 0)).map((m) => toPlayItem(m, "musica")),
    [musicasDB]
  );
  const albuns = useMemo(() => {
    const map: Record<string, { title: string; artist: string; item: PlayItem }> = {};
    musicasDB.forEach((m) => {
      const album = getField(m, "album");
      if (album && !map[album]) map[album] = { title: album, artist: getField(m, "act_principal", "actprincipal"), item: toPlayItem(m, "musica") };
    });
    return Object.values(map);
  }, [musicasDB]);

  if (loading) return <SkeletonList rows={6} />;

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(["lancamentos", "top", "albuns"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              subTab === t ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
            }`}
          >
            {t === "lancamentos" ? "Lan\u00e7" : t === "top" ? "Top" : "\u00c1lbuns"}
          </button>
        ))}
      </div>

      {subTab === "lancamentos" && (
        <div className="space-y-1">
          {lancamentos.map((item, i) => <RowTrack key={item.id} item={item} queue={lancamentos} num={i + 1} />)}
        </div>
      )}

      {subTab === "top" && (
        <div className="space-y-1">
          {top.map((item, i) => <RowTrack key={item.id} item={item} queue={top} num={i + 1} />)}
        </div>
      )}

      {subTab === "albuns" && (
        <div className="grid grid-cols-2 gap-3">
          {albuns.map((a) => (
            <div key={a.title} className="flex flex-col gap-2">
              <div className="aspect-square rounded-2xl overflow-hidden bg-primary/10">
                {a.item.capa ? (
                  <img src={driveThumb(a.item.capa, 300)} alt={a.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-full h-full grid place-items-center"><Music className="size-8 text-primary/30" /></div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black truncate uppercase tracking-tight">{a.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{a.artist}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClipesTab({ musicVideosDB, loading }: { musicVideosDB: SheetItem[]; loading: boolean }) {
  const [subTab, setSubTab] = useState<"novos" | "top">("novos");
  const novos = useMemo<PlayItem[]>(
    () => [...musicVideosDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)).map((m) => toPlayItem(m, "musicvideo")),
    [musicVideosDB]
  );
  const top = useMemo<PlayItem[]>(
    () => [...musicVideosDB].sort((a, b) => (parseInt(getField(b, "weeks_video", "weeksvideo")) || 0) - (parseInt(getField(a, "weeks_video", "weeksvideo")) || 0)).map((m) => toPlayItem(m, "musicvideo")),
    [musicVideosDB]
  );
  const list = subTab === "novos" ? novos : top;

  if (loading) return <SkeletonGrid cols={2} rows={3} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(["novos", "top"] as const).map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              subTab === t ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
            }`}>
            {t === "novos" ? "Lan\u00e7amentos" : "Top Clipes"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {list.map((item) => <VideoCard key={item.id} item={item} queue={list} />)}
      </div>
    </div>
  );
}

function VideosTab({ videosDB, loading }: { videosDB: SheetItem[]; loading: boolean }) {
  const list = useMemo<PlayItem[]>(
    () => [...videosDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)).map((m) => toPlayItem(m, "video")),
    [videosDB]
  );
  if (loading) return <SkeletonGrid cols={2} rows={3} />;
  return (
    <div className="grid grid-cols-2 gap-3">
      {list.length === 0
        ? <p className="col-span-2 text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum v\u00eddeo ainda.</p>
        : list.map((item) => <VideoCard key={item.id} item={item} queue={list} />)
      }
    </div>
  );
}

// ─── Forum Tab ─────────────────────────────────────────────────────────────────

type Comentario = { nome: string; texto: string };

function ForumTopicoDetalhe({ item, categoria, onBack }: { item: PlayItem; categoria: string; onBack: () => void }) {
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null);
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { play } = usePlay();

  const load = () =>
    fetch(`${API_URL}?action=comentarios&categoria=${categoria}&idTopico=${item.id}`)
      .then((r) => r.json())
      .then((j) => setComentarios((j.data || []).map((c: Record<string, string>) => ({ nome: getField(c, "nome_do_jogador", "nome") || "An\u00f4nimo", texto: getField(c, "comentario", "texto") }))))
      .catch(() => setComentarios([]));

  useEffect(() => { load(); }, [item.id, categoria]);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "novoComentario", categoria, idTopico: item.id, nomeJogador: nome.trim() || "An\u00f4nimo", comentario: texto.trim() }) });
    setTexto("");
    setEnviando(false);
    load();
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors">
        <ChevronLeft className="size-4" /> T\u00f3picos
      </button>

      <div className="flex items-start gap-3 p-4 bg-white/[0.03] border border-white/5 rounded-[1.5rem]">
        <div className="size-14 rounded-2xl overflow-hidden bg-primary/10 flex-shrink-0">
          {item.capa ? <img src={driveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full grid place-items-center"><Music className="size-5 text-primary/40" /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm truncate uppercase tracking-tight">{item.titulo}</p>
          <p className="text-[10px] text-muted-foreground mb-2">{item.artista}</p>
          <button onClick={() => play(item)} className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1">
            <Play className="size-3" fill="currentColor" /> Tocar
          </button>
        </div>
      </div>

      {item.letra && (
        <details className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
          <summary className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-primary">Ver Letra</summary>
          <pre className="mt-3 whitespace-pre-wrap text-xs font-sans text-foreground/80">{item.letra}</pre>
        </details>
      )}

      <div className="space-y-2">
        {comentarios === null
          ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-2xl bg-white/[0.03] animate-pulse" />)
          : comentarios.length === 0
          ? <p className="text-[10px] text-muted-foreground text-center py-6 opacity-50">Seja o primeiro a comentar.</p>
          : comentarios.map((c, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-1">{c.nome}</p>
              <p className="text-xs text-foreground/80">{c.texto}</p>
            </div>
          ))
        }
      </div>

      <div className="flex gap-2 pt-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="h-10 flex-[0.4] bg-white/5 border border-white/10 rounded-2xl px-3 text-xs font-bold uppercase tracking-tight outline-none focus:border-primary/40" />
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Comentar..." className="h-10 flex-1 bg-white/5 border border-white/10 rounded-2xl px-3 text-xs font-bold outline-none focus:border-primary/40" onKeyDown={(e) => e.key === "Enter" && enviar()} />
        <button onClick={enviar} disabled={enviando || !texto.trim()} className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-30" aria-label="Enviar"><Send className="size-4" /></button>
      </div>
    </div>
  );
}

function ForumTab({ musicasDB, musicVideosDB, videosDB, loading }: { musicasDB: SheetItem[]; musicVideosDB: SheetItem[]; videosDB: SheetItem[]; loading: boolean }) {
  const [cat, setCat] = useState<"musicas" | "musicvideos" | "videos">("musicas");
  const [detalhe, setDetalhe] = useState<{ item: PlayItem; cat: string } | null>(null);

  const list = useMemo<PlayItem[]>(() => {
    if (cat === "musicas") return musicasDB.map((m) => toPlayItem(m, "musica"));
    if (cat === "musicvideos") return musicVideosDB.map((m) => toPlayItem(m, "musicvideo"));
    return videosDB.map((m) => toPlayItem(m, "video"));
  }, [cat, musicasDB, musicVideosDB, videosDB]);

  if (loading) return <SkeletonList rows={5} />;

  if (detalhe) return <ForumTopicoDetalhe item={detalhe.item} categoria={detalhe.cat} onBack={() => setDetalhe(null)} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(["musicas", "musicvideos", "videos"] as const).map((t) => (
          <button key={t} onClick={() => { setCat(t); setDetalhe(null); }}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              cat === t ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
            }`}>
            {t === "musicas" ? "M\u00fasicas" : t === "musicvideos" ? "Clipes" : "V\u00eddeos"}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {list.length === 0
          ? <p className="text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum t\u00f3pico.</p>
          : list.map((item) => (
            <button key={item.id} onClick={() => setDetalhe({ item, cat })}
              className="w-full flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-[1.5rem] active:border-primary/30 transition-colors text-left">
              <div className="size-10 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
                {item.capa ? <img src={driveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full grid place-items-center"><Music className="size-4 text-primary/40" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-xs truncate uppercase tracking-tight">{item.titulo || "\u2014"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
              </div>
              <MessageSquare className="size-4 text-muted-foreground/40 flex-shrink-0" />
            </button>
          ))
        }
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlayHomePage() {
  const [musicasDB, setMusicasDB] = useState<SheetItem[]>([]);
  const [musicVideosDB, setMusicVideosDB] = useState<SheetItem[]>([]);
  const [videosDB, setVideosDB] = useState<SheetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}?action=conteudo&categoria=musicas`).then((r) => r.json()),
      fetch(`${API_URL}?action=conteudo&categoria=musicvideos`).then((r) => r.json()),
      fetch(`${API_URL}?action=conteudo&categoria=videos`).then((r) => r.json()),
    ])
      .then(([rm, rmv, rv]) => { setMusicasDB(rm.data || []); setMusicVideosDB(rmv.data || []); setVideosDB(rv.data || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleTabChange = (t: Tab) => {
    setActiveTab(t);
    // Scroll tab bar into view on mobile
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <main className="flex-1 pb-40">
      {/* ── Hero ─────────────────────────────────── */}
      <div
        className="px-4 pt-6 pb-6"
        style={{ background: "linear-gradient(180deg, oklch(0.22 0.10 280 / 0.55), oklch(0.12 0 0) 100%)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Radio className="size-4 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Empire Play</p>
        </div>
        <h1 className="text-2xl font-black tracking-tighter">Ouça agora</h1>
        <p className="text-xs text-muted-foreground mt-1">Músicas, clipes e vídeos do universo Empire</p>
      </div>

      {/* ── Tab Bar (sticky) ─────────────────────── */}
      <div
        ref={tabsRef}
        className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 bg-background/90 border-b border-white/[0.06]"
        style={{ backdropFilter: "blur(20px) saturate(160%)" }}
      >
        <div className="flex items-stretch overflow-x-auto scrollbar-hide px-2">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-[11px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground active:text-foreground"
                }`}
              >
                <Icon className="size-3.5" strokeWidth={active ? 2.5 : 2} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ──────────────────────────── */}
      <div className="px-4 pt-6">
        {activeTab === "home" && (
          <HomeTab musicasDB={musicasDB} musicVideosDB={musicVideosDB} videosDB={videosDB} loading={loading} onTabChange={handleTabChange} />
        )}
        {activeTab === "musicas" && (
          <MusicasTab musicasDB={musicasDB} loading={loading} />
        )}
        {activeTab === "clipes" && (
          <ClipesTab musicVideosDB={musicVideosDB} loading={loading} />
        )}
        {activeTab === "videos" && (
          <VideosTab videosDB={videosDB} loading={loading} />
        )}
        {activeTab === "forum" && (
          <ForumTab musicasDB={musicasDB} musicVideosDB={musicVideosDB} videosDB={videosDB} loading={loading} />
        )}
      </div>
    </main>
  );
}
