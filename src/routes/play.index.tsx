import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  Radio,
  Play,
  Music,
  Tv,
  MessageSquare,
  Send,
  ChevronRight,
  Home,
  Clapperboard,
  ChevronLeft,
  AlertCircle,
  PlusCircle,
  Smile,
  X,
  ExternalLink,
} from "lucide-react";
import { usePlay, type PlayItem, extractYouTubeId, detectMediaType } from "@/lib/playContext";

export const Route = createFileRoute("/play/")({
  component: PlayHomePage,
  head: () => ({
    meta: [
      { title: "Empire Play • Empire Hub" },
      { property: "og:title", content: "Empire Play • Empire Hub" },
      { property: "og:description", content: "Ouça as músicas, clipes e vídeos do Empire RPG." },
    ],
  }),
});

// ─── API URLs ──────────────────────────────────────────────────────────────
const API_URL =
  "https://script.google.com/macros/s/AKfycby1S1mIBXdj4hLqc9RYv1ZJjL7d5ct6to18FNPmpJn1KOnZrYCKJKPNe2LP0dPW-G8HOg/exec";

const SHEET_ID = "1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo";

const ABA_MUSICAS     = "Musicas";
const ABA_MUSICVIDEOS = "Music Videos";
const ABA_VIDEOS      = "videos";

// ─── Cloudflare Worker (proxy de mídia Telegram) ───────────────────────────
const TG_WORKER = "https://falling-cloud-c041.empirerpg-forum.workers.dev";

// ─── Emoji picker ──────────────────────────────────────────────────────────
const EMOJI_LIST = [
  "😀","😂","🥹","😍","🤩","😎","🥶","😭","😤","🤯",
  "🔥","❤️","💯","👏","🎵","🎶","🎤","🎸","🥁","🎧",
  "🏆","⭐","✨","💥","👑","🙌","💪","🫶","🤝","👀",
];

// ─── Reações rápidas ───────────────────────────────────────────────────────
const QUICK_REACTIONS = ["❤️", "🔥", "👏", "😂", "🤩", "😎", "💯", "👑"];

// ─── Tipos ─────────────────────────────────────────────────────────────────
type Tab = "home" | "musicas" | "clipes" | "videos" | "forum";
type SheetItem = Record<string, string>;

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "home",    label: "Início",  icon: Home },
  { id: "musicas", label: "Músicas", icon: Music },
  { id: "clipes",  label: "Clipes",  icon: Clapperboard },
  { id: "videos",  label: "Vídeos",  icon: Tv },
  { id: "forum",   label: "Fórum",   icon: MessageSquare },
];

export type ChartEntry = {
  posicao: number;
  titulo: string;
  capa: string;
  playItem?: PlayItem;
};

export type ChartData = {
  nome: string;
  subtitulo: string;
  icone: string;
  cor: string;
  capaDaPlaylist: string;
  entries: ChartEntry[];
};

// ─── Charts config ─────────────────────────────────────────────────────────
const CHARTS_CONFIG = [
  {
    aba: "Top_50_Spotify",
    nome: "Spotify",
    subtitulo: "Top 100 Global Spotify",
    icone: "🟢",
    cor: "text-green-400",
    isVideo: false,
    maxEntries: 100,
  },
  {
    aba: "Top_Songs_Apple_Music",
    nome: "Apple Music",
    subtitulo: "Top Songs Apple Music",
    icone: "🎵",
    cor: "text-red-400",
    isVideo: false,
    maxEntries: 100,
  },
  {
    aba: "Top_Videos_YT",
    nome: "YouTube",
    subtitulo: "Top Videos",
    icone: "📹",
    cor: "text-red-500",
    isVideo: true,
    maxEntries: 100,
  },
] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────
function norm(s: string) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
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
  if (!/^https?:\/\//.test(str) && !str.includes("/") && str.length > 10) return str.trim();
  return null;
}

/**
 * Resolve qualquer identificador de mídia para uma URL reproduzível.
 * - file_id do Telegram (≥ 20 chars, sem "/" e sem "http"): roteia pelo Worker /file?id=
 * - URL t.me/... ou telegram.me/...: exibir botão externo (não embeddable)
 * - Qualquer outra URL: retorna diretamente
 */
function resolveMediaUrl(src: string): string {
  if (!src) return "";
  if (src.startsWith("http")) return src;
  if (/^[A-Za-z0-9_-]{20,}$/.test(src)) {
    return `${TG_WORKER}/file?id=${src}`;
  }
  return src;
}

/**
 * Detecta se a source é de origem Telegram (não embeddable via iframe).
 */
function isTelegramSource(src: string): boolean {
  if (!src) return false;
  return src.includes("t.me/") || src.includes("telegram.me/") || src.includes("tg://");
}

function sheetCsvUrl(aba: string): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(aba)}`;
}

/**
 * Resolve thumbnail de capa:
 * - file_id do Telegram → Worker /file?id=<id>
 * - Google Drive id / URL → lh3.googleusercontent
 * - Qualquer outra URL → direto
 */
function resolveThumb(capa: string, size = 300): string {
  if (!capa) return "";
  if (/^[A-Za-z0-9_-]{20,}$/.test(capa) && !capa.startsWith("http")) {
    return `${TG_WORKER}/file?id=${capa}`;
  }
  const id = extractDriveId(capa);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${size}`;
  return capa;
}

type ReacaoTipo = "emoji" | "gif" | "sticker";
function detectReacaoTipo(val: string): ReacaoTipo {
  if (!val) return "emoji";
  if (val.startsWith("http") && (/\.gif(\?|$)/i.test(val) || /\/gif/i.test(val))) return "gif";
  if (/^[A-Za-z0-9_-]{20,}$/.test(val) && !val.startsWith("http")) return "sticker";
  return "emoji";
}

function ReacaoMedia({ value }: { value: string }) {
  const tipo = detectReacaoTipo(value);
  if (tipo === "gif") {
    return <img src={value} alt="reação" className="h-10 w-auto rounded-lg object-contain" loading="lazy" decoding="async" />;
  }
  if (tipo === "sticker") {
    const url = `${TG_WORKER}/file?id=${value}`;
    return <img src={url} alt="sticker" className="h-10 w-auto object-contain" loading="lazy" decoding="async" />;
  }
  return <span className="text-lg leading-none">{value}</span>;
}

function parseDataLancamento(item: SheetItem): number {
  const raw = getField(
    item,
    "Data de lançamento", "Data de lancamento", "data_de_lancamento",
    "datadelancamento", "data_lancamento", "datalancamento",
    "data", "release_date", "releasedate",
  );
  if (!raw || raw.trim() === "") return 0;
  const s = raw.trim();
  const brDate = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brDate) {
    const iso = `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}`;
    const t = new Date(iso).getTime();
    return isNaN(t) ? 0 : t;
  }
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n < 1e12 ? n * 1000 : n;
  }
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

function formatDate(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function formatRelativo(isoStr: string): string {
  if (!isoStr) return "";
  const ts = new Date(isoStr).getTime();
  if (isNaN(ts)) return isoStr;
  const diff = Date.now() - ts;
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `há ${Math.floor(diff / 86_400_000)}d`;
  return formatDate(ts);
}

function toPlayItemMusica(m: SheetItem): PlayItem {
  const idTopico = getField(m,
    "id_do_topico", "idtopico", "id_topico",
    "ID do tópico", "ID do topico", "id",
  );
  const titulo = getField(m,
    "nome_da_musica", "nomedamusica", "nome_musica", "nomemusica", "nome", "titulo", "title",
    "Nome da música", "Nome da musica", "Nome da Música", "track", "song",
  );
  const artista = getField(m,
    "act_principal", "actprincipal", "id_do_criador", "iddocriador", "idcriador",
    "artista", "artist", "autor", "author",
    "ACT Principal", "ID do Criador", "ID do criador",
  );
  const capa = getField(m,
    "capa_da_musica", "capadamusica", "capa", "cover", "thumb", "thumbnail",
    "Capa da música", "Capa da musica", "Capa da Música",
  );
  const audioSrc = getField(m,
    "id_do_arquivo", "idarquivo", "id_arquivo", "arquivo",
    "link_do_audio", "linkdoaudio",
    "link", "url", "audio",
    "ID do arquivo", "ID do Arquivo",
    "Link do áudio", "Link do audio",
  );
  const letra = getField(m,
    "letra", "Letra", "LETRA",
    "lyrics", "Lyrics", "LYRICS",
    "lyric", "Lyric",
  );
  return {
    id: idTopico || audioSrc || `musica-${titulo}`,
    titulo, artista, capa, audioSrc, letra,
    categoria: "musica",
  };
}

function toPlayItem(m: SheetItem, cat: PlayItem["categoria"]): PlayItem {
  const idTopico = getField(m,
    "id_do_topico", "idtopico", "id_topico", "id",
    "ID do tópico", "ID do topico",
  );
  const titulo =
    cat === "musica"
      ? getField(m,
          "nome_da_musica", "nomedamusica", "nome_musica", "nome", "titulo", "title",
          "Nome da Música", "Nome da musica", "Música", "musica", "track", "song",
        )
      : getField(m,
          "tipo_de_clipe", "tipodeclipe", "tipo", "titulo", "title",
          "nome_do_clipe", "nomedoclipe",
          "Tipo de Clipe", "Nome do Clipe", "Nome do Vídeo", "nome do video",
          "nomedovideo", "clipe", "video", "nome",
        );
  const artista = getField(m,
    "act_principal", "actprincipal", "act principal",
    "artista", "artist",
    "ACT Principal", "Act Principal",
    "Artista", "Artista Principal",
    "ID do criador", "iddocriador",
    "autor", "author",
  );
  const capa = getField(m,
    "capa_da_musica", "capadamusica", "capa", "cover",
    "Capa da Música", "Capa da musica",
    "Thumb", "thumb", "thumbnail",
  );
  const audioSrc = getField(m,
    "id_do_arquivo", "idarquivo", "id_arquivo", "arquivo",
    "ID do Arquivo", "ID do arquivo",
    "Link do áudio", "Link do audio", "linkdoaudio",
    "ID do vídeo", "ID do video", "idvideo", "id_video",
    "link_do_video", "linkdovideo", "Link do vídeo", "Link do video",
    "youtube_id", "youtubeid", "yt_id", "ytid",
    "Link", "link", "url", "URL",
    "audio", "Audio",
    "video", "Video",
    "src", "file", "File",
  );
  const letra = getField(m,
    "letra", "Letra", "LETRA",
    "lyrics", "Lyrics", "LYRICS",
    "lyric", "Lyric",
  );
  return {
    id: idTopico || audioSrc || `item-${titulo}`,
    titulo, artista, capa, audioSrc, letra,
    categoria: cat,
  };
}

function sheetRowsToObjects(values: string[][]): SheetItem[] {
  if (!values || values.length < 2) return [];
  const headers = values[0].map((h) => String(h).trim());
  return values.slice(1).map((row) => {
    const obj: SheetItem = {};
    headers.forEach((h, i) => { obj[h] = String(row[i] ?? "").trim(); });
    return obj;
  });
}

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  for (const line of csv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cols.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

async function fetchSheetValues(aba: string): Promise<{ values: string[][]; error?: string }> {
  try {
    const res = await fetch(sheetCsvUrl(aba));
    if (!res.ok) return { values: [], error: `HTTP ${res.status} ao buscar aba "${aba}"` };
    const csv = await res.text();
    const parsed = parseCSV(csv);
    if (parsed.length > 1) return { values: parsed };
    return { values: [], error: `CSV vazio para aba "${aba}"` };
  } catch (e) {
    return { values: [], error: String(e) };
  }
}

function processChart(
  chartValues: string[][],
  isVideo: boolean,
  maxEntries = 100
): { entries: ChartEntry[]; capaDaPlaylist: string } {
  if (!chartValues || chartValues.length < 2) return { entries: [], capaDaPlaylist: "" };
  const rows = sheetRowsToObjects(chartValues);
  const entries: ChartEntry[] = rows
    .map((row) => {
      const posStr = getField(row, "Posição", "Posicao", "Pos", "position", "rank");
      const posicao = parseInt(posStr.replace(/\D/g, "")) || 0;
      const titulo = isVideo
        ? getField(row, "Nome do vídeo", "Nome do video", "nomedovideo", "titulo", "title")
        : getField(row, "Nome da música", "Nome da musica", "nomedamusica", "titulo", "title", "nome");
      const capa = isVideo
        ? getField(row, "Thumb", "thumb", "thumbnail", "capa", "Capa da música", "Capa da musica")
        : getField(row, "Capa da música", "Capa da musica", "capadamusica", "capa", "cover");
      const idTopico  = getField(row, "ID do tópico", "ID do topico", "idtopico", "id");
      const linkAudio = getField(row, "Link do áudio", "Link do audio", "linkdoaudio", "link", "audio", "url");
      const criador   = getField(row, "ID do criador", "iddocriador", "criador", "artista", "artist");
      if (!posicao || !titulo) return null;
      const playItem: PlayItem = {
        id: idTopico || `chart-${posicao}`,
        titulo, artista: criador, capa, audioSrc: linkAudio, letra: "",
        categoria: isVideo ? "musicvideo" : "musica",
      };
      return { posicao, titulo, capa, playItem } as ChartEntry;
    })
    .filter((e): e is ChartEntry => e !== null && e.posicao > 0)
    .sort((a, b) => a.posicao - b.posicao)
    .slice(0, maxEntries);
  return { entries, capaDaPlaylist: entries[0]?.capa ?? "" };
}

// ─── Video Modal (fullscreen 16:9) ─────────────────────────────────────────
/**
 * Modal dedicado para reprodução de vídeo.
 * Suporta: YouTube embed, Google Drive iframe, MP4/WebM nativo, Telegram (link externo).
 * FIX: substitui o drive-iframe-wrap sobreposto ao player de música.
 */
function VideoModal({ item, onClose }: { item: PlayItem; onClose: () => void }) {
  const src = item.audioSrc || "";
  const ytId = extractYouTubeId(src);
  const mediaType = detectMediaType(src);
  const isTg = isTelegramSource(src);

  // Bloqueia scroll do body enquanto modal está aberto
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const renderPlayer = () => {
    // YouTube
    if (ytId || mediaType === "youtube") {
      const embedId = ytId || src;
      return (
        <iframe
          src={`https://www.youtube.com/embed/${embedId}?rel=0&modestbranding=1&autoplay=1`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={item.titulo}
        />
      );
    }

    // Google Drive
    if (mediaType === "drive" || extractDriveId(src)) {
      const driveId = extractDriveId(src);
      if (driveId) {
        return (
          <iframe
            src={`https://drive.google.com/file/d/${driveId}/preview`}
            className="w-full h-full"
            allow="autoplay"
            allowFullScreen
            title={item.titulo}
          />
        );
      }
    }

    // Telegram — não embeddable, exibir botão de link externo
    if (isTg || (src && /^[A-Za-z0-9_-]{20,}$/.test(src) && !src.startsWith("http"))) {
      const externalUrl = isTg ? src : `https://t.me/`;
      return (
        <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-6">
          <div className="size-16 rounded-full bg-white/10 grid place-items-center">
            <Tv className="size-8 text-white/60" />
          </div>
          <p className="text-sm font-black text-white uppercase tracking-tight">{item.titulo}</p>
          <p className="text-xs text-white/50 max-w-[28ch]">
            Vídeos do Telegram não podem ser embutidos aqui por restrição do aplicativo.
          </p>
          {isTg && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2AABEE] text-white text-xs font-black uppercase tracking-widest"
            >
              <ExternalLink className="size-3.5" />
              Abrir no Telegram
            </a>
          )}
        </div>
      );
    }

    // MP4 / WebM / arquivo direto (incluindo file_id Telegram via Worker)
    const mediaSrc = resolveMediaUrl(src);
    return (
      <video
        src={mediaSrc}
        controls
        autoPlay
        className="w-full h-full"
        playsInline
        preload="metadata"
      />
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe-top py-3 flex-shrink-0">
        <div className="min-w-0 flex-1 mr-3">
          <p className="text-xs font-black text-white truncate uppercase tracking-tight">{item.titulo}</p>
          {item.artista && <p className="text-[10px] text-white/50 truncate">{item.artista}</p>}
        </div>
        <button
          onClick={onClose}
          className="size-9 rounded-full bg-white/10 grid place-items-center flex-shrink-0"
          aria-label="Fechar"
        >
          <X className="size-4 text-white" />
        </button>
      </div>

      {/* Player 16:9 */}
      <div className="flex-1 flex items-center justify-center px-0">
        <div className="w-full aspect-video bg-black overflow-hidden">
          {renderPlayer()}
        </div>
      </div>

      {/* Padding seguro inferior */}
      <div className="py-4 flex-shrink-0" />
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────
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

// ─── Card Components ────────────────────────────────────────────────────────
function SongCardWithDate({
  item, queue, rawDate,
}: {
  item: PlayItem; queue: PlayItem[]; rawDate: string;
}) {
  const { play, state } = usePlay();
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id;

  const { dataFormatada, isNovo } = useMemo(() => {
    if (!rawDate || rawDate.trim() === "") return { dataFormatada: "", isNovo: false };
    const s = rawDate.trim();
    let ts = 0;
    const brDate = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brDate) {
      ts = new Date(`${brDate[3]}-${brDate[2].padStart(2,"0")}-${brDate[1].padStart(2,"0")}`).getTime();
    } else if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      ts = n < 1e12 ? n * 1000 : n;
    } else {
      ts = new Date(s).getTime();
    }
    if (!ts || isNaN(ts)) return { dataFormatada: "", isNovo: false };
    return {
      dataFormatada: formatDate(ts),
      isNovo: (Date.now() - ts) / (1000 * 60 * 60 * 24) <= 30,
    };
  }, [rawDate]);

  return (
    <button onClick={() => play(item, queue, { autoPlay: true })} className="flex flex-col gap-2 text-left group w-full">
      <div className={`relative aspect-square w-full rounded-2xl overflow-hidden bg-primary/10 ${isActive ? "ring-2 ring-primary" : ""} transition-all`}>
        {item.capa
          ? <img src={resolveThumb(item.capa, 300)} alt={item.titulo} className="w-full h-full object-cover" loading="lazy" decoding="async" />
          : <div className="w-full h-full grid place-items-center"><Music className="size-8 text-primary/40" /></div>
        }
        {isNovo && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-widest">
            Novo
          </div>
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
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? "text-primary" : ""}`}>{item.titulo || "—"}</p>
        <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
        {dataFormatada && (
          <p className="text-[9px] text-muted-foreground/50 truncate mt-0.5">Lançada em {dataFormatada}</p>
        )}
      </div>
    </button>
  );
}

/**
 * VideoCard — abre o VideoModal dedicado ao invés de disparar o player de música.
 * FIX: resolve o conflito do drive-iframe-wrap sobreposto ao botão de play.
 */
function VideoCard({ item, queue: _queue }: { item: PlayItem; queue: PlayItem[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const { state } = usePlay();
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id;

  return (
    <>
      <button onClick={() => setModalOpen(true)} className="flex flex-col gap-2 text-left group w-full">
        <div className={`relative w-full rounded-2xl overflow-hidden bg-primary/10 aspect-video ${isActive ? "ring-2 ring-primary" : ""} transition-all`}>
          {item.capa
            ? <img src={resolveThumb(item.capa, 400)} alt={item.titulo} className="w-full h-full object-cover" loading="lazy" decoding="async" />
            : <div className="w-full h-full grid place-items-center"><Tv className="size-8 text-primary/40" /></div>
          }
          <div className="absolute inset-0 grid place-items-center">
            <div className="size-10 rounded-full bg-black/40 group-active:bg-primary/90 grid place-items-center transition-all">
              <Play className="size-5 text-white" fill="white" />
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? "text-primary" : ""}`}>{item.titulo || "—"}</p>
          <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
        </div>
      </button>
      {modalOpen && <VideoModal item={item} onClose={() => setModalOpen(false)} />}
    </>
  );
}

function RowTrack({ item, queue, num, rawDate }: {
  item: PlayItem; queue: PlayItem[]; num: number; rawDate?: string;
}) {
  const { play, state } = usePlay();
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id;

  const dataFormatada = useMemo(() => {
    if (!rawDate || rawDate.trim() === "") return "";
    const s = rawDate.trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      return formatDate(n < 1e12 ? n * 1000 : n);
    }
    const t = new Date(s).getTime();
    return isNaN(t) ? s : formatDate(t);
  }, [rawDate]);

  return (
    <button
      onClick={() => play(item, queue, { autoPlay: true })}
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
        {item.capa
          ? <img src={resolveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          : <div className="w-full h-full grid place-items-center"><Music className="size-4 text-primary/30" /></div>
        }
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? "text-primary" : ""}`}>{item.titulo || "—"}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {item.artista}
          {dataFormatada && <span className="ml-1.5 opacity-50">· {dataFormatada}</span>}
        </p>
      </div>
      <Play className="size-4 text-muted-foreground/40 flex-shrink-0" fill="currentColor" />
    </button>
  );
}

function ChartRow({ entry, queue }: { entry: ChartEntry; queue: PlayItem[] }) {
  const { play, state } = usePlay();
  const isActive = entry.playItem && state.currentIdx !== null && state.queue[state.currentIdx]?.id === entry.playItem.id;
  const canPlay = !!entry.playItem?.audioSrc;
  return (
    <button
      onClick={() => { if (entry.playItem) play(entry.playItem, queue, { autoPlay: true }); }}
      disabled={!canPlay}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ${
        isActive ? "bg-primary/10 border border-primary/30"
        : canPlay ? "border border-transparent active:bg-white/[0.04]"
        : "border border-transparent opacity-60 cursor-default"
      }`}
    >
      <div className="w-5 flex-shrink-0 text-center">
        {isActive ? (
          <div className="flex gap-0.5 items-end justify-center">
            {[3, 5, 4].map((h, i) => (
              <div key={i} className="w-0.5 bg-primary rounded-full animate-bounce" style={{ height: `${h * 2}px`, animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ) : (
          <span className={`text-[10px] font-black ${entry.posicao <= 3 ? "text-primary" : "text-muted-foreground/50"}`}>
            {entry.posicao}
          </span>
        )}
      </div>
      <div className="size-10 rounded-xl overflow-hidden bg-white/[0.05] flex-shrink-0">
        {entry.capa
          ? <img src={resolveThumb(entry.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          : <div className="w-full h-full grid place-items-center"><Music className="size-4 text-white/10" /></div>
        }
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? "text-primary" : canPlay ? "" : "text-muted-foreground"}`}>
          {entry.titulo}
        </p>
      </div>
    </button>
  );
}

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

function ChartMiniCard({ chart, onOpen }: { chart: ChartData; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white/[0.03] border border-white/[0.06] rounded-[1.5rem] overflow-hidden active:border-primary/30 transition-all"
    >
      <div className="relative w-full aspect-square bg-white/[0.05] grid place-items-center">
        {chart.capaDaPlaylist
          ? <img src={resolveThumb(chart.capaDaPlaylist, 300)} alt={chart.nome} className="w-full h-full object-cover" loading="lazy" decoding="async" />
          : <span className="text-5xl">{chart.icone}</span>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[11px] font-black text-white leading-tight">{chart.subtitulo}</p>
        </div>
      </div>
    </button>
  );
}

function ChartDetailView({ chart, onBack }: { chart: ChartData; onBack: () => void }) {
  const queue = chart.entries.filter((e) => e.playItem?.audioSrc).map((e) => e.playItem!) as PlayItem[];
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors">
        <ChevronLeft className="size-4" /> Charts
      </button>
      <div className="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-[1.5rem]">
        <div className="size-16 rounded-2xl overflow-hidden bg-white/[0.05] flex-shrink-0">
          {chart.capaDaPlaylist
            ? <img src={resolveThumb(chart.capaDaPlaylist, 120)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            : <div className="w-full h-full grid place-items-center"><span className="text-3xl">{chart.icone}</span></div>
          }
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">{chart.icone} {chart.nome}</p>
          <p className="text-base font-black tracking-tight">{chart.subtitulo}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{chart.entries.length} faixas</p>
        </div>
      </div>
      <div className="space-y-0.5">
        {chart.entries.map((entry) => (
          <ChartRow key={entry.posicao} entry={entry} queue={queue} />
        ))}
      </div>
    </div>
  );
}

// ─── Home Tab ───────────────────────────────────────────────────────────────
function HomeTab({
  musicasDB, musicVideosDB, charts, chartsLoading, chartsError, loading, onTabChange,
}: {
  musicasDB: SheetItem[];
  musicVideosDB: SheetItem[];
  charts: ChartData[];
  chartsLoading: boolean;
  chartsError: string;
  loading: boolean;
  onTabChange: (t: Tab) => void;
}) {
  const [openChart, setOpenChart] = useState<ChartData | null>(null);
  const [homeSection, setHomeSection] = useState<"charts" | "lancamentos">("charts");

  const lancMusicas = useMemo<{ item: PlayItem; rawDate: string }[]>(
    () =>
      [...musicasDB]
        .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
        .slice(0, 5)
        .map((m) => ({
          item: toPlayItemMusica(m),
          rawDate: getField(m,
            "Data de lançamento", "Data de lancamento", "data_de_lancamento",
            "datadelancamento", "data_lancamento", "datalancamento",
            "data", "release_date", "releasedate",
          ),
        })),
    [musicasDB]
  );

  const lancVideos = useMemo<PlayItem[]>(
    () =>
      [...musicVideosDB]
        .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
        .slice(0, 5)
        .map((m) => toPlayItem(m, "musicvideo")),
    [musicVideosDB]
  );

  if (openChart) return <ChartDetailView chart={openChart} onBack={() => setOpenChart(null)} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(["charts", "lancamentos"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setHomeSection(s)}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              homeSection === s ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
            }`}
          >
            {s === "charts" ? "🏆 Top Charts" : "✨ Lançamentos"}
          </button>
        ))}
      </div>

      {homeSection === "charts" && (
        <section className="space-y-4">
          <SectionHeader icon={<span>🏆</span>} title="Top Charts" />
          {chartsLoading ? (
            <SkeletonGrid cols={3} rows={1} />
          ) : charts.length === 0 ? (
            <div className="space-y-3">
              <p className="text-center text-xs text-muted-foreground py-4 opacity-40">
                Nenhum chart disponível no momento.
              </p>
              {chartsError && (
                <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-3 flex gap-2">
                  <AlertCircle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-400/80 font-mono break-all">{chartsError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {charts.map((c) => (
                <ChartMiniCard key={c.nome} chart={c} onOpen={() => setOpenChart(c)} />
              ))}
            </div>
          )}
        </section>
      )}

      {homeSection === "lancamentos" && (
        <section className="space-y-6">
          {loading ? (
            <><SkeletonList rows={5} /><SkeletonList rows={5} /></>
          ) : (
            <>
              {lancMusicas.length > 0 && (
                <div>
                  <SectionHeader
                    icon={<Music className="size-4 text-primary" />}
                    title="Últimas Músicas"
                    onMore={() => onTabChange("musicas")}
                  />
                  <div className="space-y-1">
                    {lancMusicas.map(({ item, rawDate }, i) => (
                      <RowTrack
                        key={item.id}
                        item={item}
                        queue={lancMusicas.map((x) => x.item)}
                        num={i + 1}
                        rawDate={rawDate}
                      />
                    ))}
                  </div>
                </div>
              )}
              {lancVideos.length > 0 && (
                <div>
                  <SectionHeader
                    icon={<Clapperboard className="size-4 text-primary" />}
                    title="Últimos Clipes"
                    onMore={() => onTabChange("clipes")}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    {lancVideos.map((item) => <VideoCard key={item.id} item={item} queue={lancVideos} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Músicas Tab ─────────────────────────────────────────────────────────────
type MusicasSubTab = "lancamentos" | "albuns" | "lancar";

function MusicasTab({ musicasDB, loading }: { musicasDB: SheetItem[]; loading: boolean }) {
  const [subTab, setSubTab] = useState<MusicasSubTab>("lancamentos");

  const SUB_TABS: { id: MusicasSubTab; label: string; icon: React.ElementType }[] = [
    { id: "lancamentos", label: "Últimos lançamentos", icon: Music },
    { id: "albuns",      label: "Álbuns",              icon: Music },
    { id: "lancar",      label: "Lançar",              icon: PlusCircle },
  ];

  const lancamentos = useMemo<{ item: PlayItem; rawDate: string }[]>(() => {
    return [...musicasDB]
      .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
      .slice(0, 30)
      .map((m) => ({
        item: toPlayItemMusica(m),
        rawDate: getField(m,
          "Data de lançamento", "Data de lancamento", "data_de_lancamento",
          "datadelancamento", "data_lancamento", "datalancamento",
          "data", "release_date", "releasedate",
        ),
      }));
  }, [musicasDB]);

  const albuns = useMemo(() => {
    const map: Record<string, { title: string; artist: string; capa: string; faixas: PlayItem[] }> = {};
    musicasDB.forEach((m) => {
      const album = getField(m, "album");
      if (!album) return;
      if (!map[album]) {
        map[album] = {
          title: album,
          artist: getField(m, "act_principal", "actprincipal"),
          capa: getField(m, "capa_da_musica", "capadamusica", "capa", "cover"),
          faixas: [],
        };
      }
      map[album].faixas.push(toPlayItem(m, "musica"));
    });
    return Object.values(map);
  }, [musicasDB]);

  if (loading && musicasDB.length === 0) return <SkeletonGrid cols={3} rows={4} />;

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex-shrink-0 transition-all ${
              subTab === id ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-3" />
            {label}
          </button>
        ))}
      </div>

      {subTab === "lancamentos" && (
        <div className="space-y-3">
          {lancamentos.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-12 opacity-40">Nenhuma música ainda.</p>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-black px-1 pb-1">
                {lancamentos.length} músicas · mais recente primeiro
              </p>
              <div className="grid grid-cols-3 gap-3">
                {lancamentos.map(({ item, rawDate }) => (
                  <SongCardWithDate
                    key={item.id}
                    item={item}
                    queue={lancamentos.map((x) => x.item)}
                    rawDate={rawDate}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {subTab === "albuns" && (
        <div className="grid grid-cols-2 gap-3">
          {albuns.length === 0 ? (
            <p className="col-span-2 text-center text-xs text-muted-foreground py-12 opacity-40">
              Nenhum álbum ainda. Adicione a coluna "album" na planilha de músicas.
            </p>
          ) : (
            albuns.map((a) => (
              <div key={a.title} className="flex flex-col gap-2">
                <div className="aspect-square rounded-2xl overflow-hidden bg-primary/10">
                  {a.capa
                    ? <img src={resolveThumb(a.capa, 300)} alt={a.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    : <div className="w-full h-full grid place-items-center"><Music className="size-8 text-primary/30" /></div>
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate uppercase tracking-tight">{a.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{a.artist}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {subTab === "lancar" && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="size-16 rounded-full bg-primary/10 grid place-items-center">
            <PlusCircle className="size-8 text-primary/60" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-tight">Lançar música</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[24ch]">
              Em breve você poderá submeter suas músicas aqui.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Clipes Tab ──────────────────────────────────────────────────────────────
function ClipesTab({ musicVideosDB, loading }: { musicVideosDB: SheetItem[]; loading: boolean }) {
  const [subTab, setSubTab] = useState<"novos" | "top">("novos");
  const novos = useMemo<PlayItem[]>(
    () => [...musicVideosDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)).map((m) => toPlayItem(m, "musicvideo")),
    [musicVideosDB]
  );
  const top = useMemo<PlayItem[]>(
    () => [...musicVideosDB]
      .sort((a, b) =>
        (parseInt(getField(b, "weeks_video", "weeksvideo")) || 0) -
        (parseInt(getField(a, "weeks_video", "weeksvideo")) || 0)
      )
      .map((m) => toPlayItem(m, "musicvideo")),
    [musicVideosDB]
  );
  const list = subTab === "novos" ? novos : top;

  // FIX: se weeks_video não existe, avisa o usuário em vez de renderizar lista desorganizada
  const hasWeeksData = useMemo(
    () => musicVideosDB.some((m) => !!getField(m, "weeks_video", "weeksvideo")),
    [musicVideosDB]
  );

  if (loading) return <SkeletonGrid cols={2} rows={3} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(["novos", "top"] as const).map((t) => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              subTab === t ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
            }`}>
            {t === "novos" ? "Lançamentos" : "Top Clipes"}
          </button>
        ))}
      </div>

      {subTab === "top" && !hasWeeksData && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <AlertCircle className="size-4 text-muted-foreground/40 flex-shrink-0" />
          <p className="text-[10px] text-muted-foreground/50">
            Coluna <code className="text-primary/60">weeks_video</code> não encontrada na planilha — exibindo ordem padrão.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {list.length === 0
          ? <p className="col-span-2 text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum clipe ainda.</p>
          : list.map((item) => <VideoCard key={item.id} item={item} queue={list} />)
        }
      </div>
    </div>
  );
}

// ─── Vídeos Tab ───────────────────────────────────────────────────────────────
function VideosTab({ videosDB, loading }: { videosDB: SheetItem[]; loading: boolean }) {
  const list = useMemo<PlayItem[]>(
    () => [...videosDB].sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a)).map((m) => toPlayItem(m, "video")),
    [videosDB]
  );
  if (loading) return <SkeletonGrid cols={2} rows={3} />;
  return (
    <div className="grid grid-cols-2 gap-3">
      {list.length === 0
        ? <p className="col-span-2 text-center text-xs text-muted-foreground py-12 opacity-40">Nenhum vídeo ainda.</p>
        : list.map((item) => <VideoCard key={item.id} item={item} queue={list} />)
      }
    </div>
  );
}

// ─── Forum ────────────────────────────────────────────────────────────────────
type Comentario = {
  nome: string;
  texto: string;
  reacao?: string;
  timestamp?: string;
};

/**
 * InlineMediaPlayer — player inline no tópico do fórum.
 * Vídeos abrem o VideoModal; músicas disparam o player de áudio.
 * FIX: file_ids do Telegram roteados via Worker.
 */
function InlineMediaPlayer({ item }: { item: PlayItem }) {
  const { play } = usePlay();
  const [modalOpen, setModalOpen] = useState(false);
  const src = item.audioSrc || "";
  const isVideo = item.categoria === "video" || item.categoria === "musicvideo";

  const ytId = extractYouTubeId(src);

  if (isVideo) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="mt-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1"
        >
          <Play className="size-3" fill="currentColor" />
          {ytId ? "Assistir no player" : "Assistir vídeo"}
        </button>
        {modalOpen && <VideoModal item={item} onClose={() => setModalOpen(false)} />}
      </>
    );
  }

  return (
    <button
      onClick={() => play(item, [item], { autoPlay: true })}
      className="mt-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1"
    >
      <Play className="size-3" fill="currentColor" /> Tocar
    </button>
  );
}

function ReacoesAgrupadas({ comentarios }: { comentarios: Comentario[] }) {
  const grupos = useMemo(() => {
    const map: Record<string, number> = {};
    comentarios.forEach((c) => {
      if (c.reacao) map[c.reacao] = (map[c.reacao] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [comentarios]);
  if (!grupos.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {grupos.map(([emoji, count]) => (
        <div key={emoji} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.10] text-[11px] font-bold">
          <ReacaoMedia value={emoji} />
          {count > 1 && <span className="text-muted-foreground">{count}</span>}
        </div>
      ))}
    </div>
  );
}

function ForumTopicoDetalhe({ item, categoria, onBack }: { item: PlayItem; categoria: string; onBack: () => void }) {
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null);
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [letraExpandida, setLetraExpandida] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() =>
    fetch(`${API_URL}?action=comentarios&categoria=${categoria}&idTopico=${encodeURIComponent(item.id)}`)
      .then((r) => r.json())
      .then((j) =>
        setComentarios(
          (j.data || []).map((c: Record<string, string>) => ({
            nome: getField(c, "nome_do_jogador", "nomedojogador", "autor", "author", "nome", "name") || "Anônimo",
            texto: getField(c, "comentario", "comentário", "texto", "text", "mensagem", "message"),
            reacao: getField(c, "reacao", "reação", "emoji", "reaction") || undefined,
            timestamp: getField(c, "timestamp", "data", "criado_em", "created_at", "hora") || undefined,
          }))
        )
      )
      .catch(() => setComentarios([])),
    [item.id, categoria]
  );

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [texto]);

  useEffect(() => {
    if (comentarios !== null) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [comentarios]);

  const insertEmoji = (e: string) => {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? texto.length;
      const end = el.selectionEnd ?? texto.length;
      setTexto(texto.slice(0, start) + e + texto.slice(end));
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + e.length;
        el.focus();
      });
    } else {
      setTexto((t) => t + e);
    }
    setShowPicker(false);
  };

  const enviar = async (emojiOverride?: string) => {
    const comentarioTexto = texto.trim();
    const emojiEnvio = emojiOverride || undefined;
    if (!comentarioTexto && !emojiEnvio) return;
    if (enviando) return;
    setEnviando(true);
    setEnviado(false);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "novoComentario",
          categoria,
          idTopico: item.id,
          nomeJogador: nome.trim() || "Anônimo",
          comentario: comentarioTexto || emojiEnvio || "👍",
          emoji: emojiEnvio,
        }),
      });
      setTexto("");
      setEnviado(true);
      setTimeout(() => {
        load();
        setEnviado(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
      }, 800);
    } catch {
      // silencia erro de rede
    } finally {
      setEnviando(false);
    }
  };

  const catLabel =
    categoria === "musicas" ? "🎵 Músicas"
    : categoria === "musicvideos" ? "🎬 Clipes"
    : "📺 Vídeos";

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors">
        <ChevronLeft className="size-4" />
        <span>{catLabel}</span>
      </button>

      <div className="rounded-[1.5rem] overflow-hidden bg-white/[0.03] border border-white/[0.06]">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/70">{catLabel}</span>
            <span className="text-[9px] text-muted-foreground/40">· tópico</span>
          </div>
          <div className="flex items-start gap-3">
            <div className="size-14 rounded-2xl overflow-hidden bg-primary/10 flex-shrink-0">
              {item.capa
                ? <img src={resolveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <div className="w-full h-full grid place-items-center"><Music className="size-5 text-primary/40" /></div>
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-sm uppercase tracking-tight leading-tight">{item.titulo}</p>
              {item.artista && <p className="text-[10px] text-muted-foreground mt-0.5">{item.artista}</p>}
            </div>
          </div>
          <InlineMediaPlayer item={item} />
        </div>

        {item.letra && (
          <div className="border-t border-white/[0.06]">
            <button
              onClick={() => setLetraExpandida((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary active:opacity-70 transition-opacity select-none"
              aria-expanded={letraExpandida}
            >
              <span>📝 {letraExpandida ? "Ocultar Letra" : "Ver Letra Completa"}</span>
              <ChevronRight className={`size-3.5 transition-transform duration-200 ${letraExpandida ? "rotate-90" : ""}`} />
            </button>
            {letraExpandida && (
              <div className="px-4 pb-4">
                <pre
                  className="whitespace-pre-wrap font-sans text-xs text-foreground/75 leading-relaxed max-h-[60vh] overflow-y-auto pr-1"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {item.letra}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-white/[0.06] px-4 py-3 flex items-center gap-1.5 flex-wrap">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => enviar(e)}
              disabled={enviando}
              className="text-lg leading-none px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] active:bg-primary/20 active:border-primary/40 transition-all disabled:opacity-40"
              aria-label={`Reagir com ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {comentarios && comentarios.length > 0 && (
        <ReacoesAgrupadas comentarios={comentarios} />
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 px-1">
          💬 {comentarios === null ? "..." : `${comentarios.length} comentário${comentarios.length !== 1 ? "s" : ""}`}
        </p>

        {comentarios === null
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 rounded-2xl bg-white/[0.03] animate-pulse" />
            ))
          : comentarios.length === 0
          ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <MessageSquare className="size-8 text-muted-foreground/20" />
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-black">Seja o primeiro a comentar</p>
            </div>
          )
          : comentarios.map((c, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="size-7 rounded-full bg-primary/20 flex-shrink-0 grid place-items-center mb-0.5">
                <span className="text-[10px] font-black text-primary uppercase">{c.nome.charAt(0)}</span>
              </div>
              <div className="max-w-[85%] bg-white/[0.05] border border-white/[0.07] rounded-[1.25rem] rounded-bl-sm px-3 py-2.5 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-wide text-primary">{c.nome}</p>
                  {c.timestamp && (
                    <p className="text-[9px] text-muted-foreground/30 flex-shrink-0">{formatRelativo(c.timestamp)}</p>
                  )}
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{c.texto}</p>
                {c.reacao && (
                  <div className="pt-1">
                    <ReacaoMedia value={c.reacao} />
                  </div>
                )}
              </div>
            </div>
          ))
        }
        <div ref={bottomRef} />
      </div>

      {enviado && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-primary/10 border border-primary/20">
          <span className="text-primary text-xs font-black">✓ Enviado! Atualizando...</span>
        </div>
      )}

      <div className="sticky bottom-0 pt-2 pb-1 space-y-2 bg-background/80" style={{ backdropFilter: "blur(16px)" }}>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome (opcional)"
          className="w-full h-9 bg-white/5 border border-white/10 rounded-2xl px-3 text-xs font-bold uppercase tracking-tight outline-none focus:border-primary/40 transition-colors"
        />
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
              }}
              placeholder="Escreva uma mensagem..."
              rows={1}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 pr-9 text-xs font-bold outline-none focus:border-primary/40 resize-none overflow-hidden leading-relaxed transition-colors"
              style={{ minHeight: "40px", maxHeight: "120px" }}
            />
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className="absolute right-2.5 bottom-2.5 text-muted-foreground/50 active:text-primary transition-colors"
              aria-label="Inserir emoji"
            >
              <Smile className="size-4" />
            </button>
          </div>
          <button
            onClick={() => enviar()}
            disabled={enviando || !texto.trim()}
            className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-30 flex-shrink-0 transition-opacity"
            aria-label="Enviar"
          >
            {enviando
              ? <span className="size-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              : <Send className="size-4" />
            }
          </button>
        </div>
        {showPicker && (
          <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-3">
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_LIST.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => insertEmoji(e)}
                  className="text-xl leading-none p-1 rounded-lg active:bg-white/10 transition-colors"
                  aria-label={e}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ForumTab({ musicasDB, musicVideosDB, videosDB, loading }: {
  musicasDB: SheetItem[];
  musicVideosDB: SheetItem[];
  videosDB: SheetItem[];
  loading: boolean;
}) {
  const [cat, setCat] = useState<"musicas" | "musicvideos" | "videos">("musicas");
  const [detalhe, setDetalhe] = useState<{ item: PlayItem; cat: string } | null>(null);

  const list = useMemo<PlayItem[]>(() => {
    if (cat === "musicas") return musicasDB.map((m) => toPlayItemMusica(m));
    if (cat === "musicvideos") return musicVideosDB.map((m) => toPlayItem(m, "musicvideo"));
    return videosDB.map((m) => toPlayItem(m, "video"));
  }, [cat, musicasDB, musicVideosDB, videosDB]);

  if (loading) return <SkeletonList rows={5} />;
  if (detalhe) return <ForumTopicoDetalhe item={detalhe.item} categoria={detalhe.cat} onBack={() => setDetalhe(null)} />;

  const catIcon = cat === "musicas" ? "🎵" : cat === "musicvideos" ? "🎬" : "📺";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <MessageSquare className="size-4 text-primary" />
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Empire Fórum</p>
          <p className="text-[9px] text-muted-foreground/50">Comente e reaja às músicas e vídeos</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(["musicas", "musicvideos", "videos"] as const).map((t) => (
          <button key={t} onClick={() => { setCat(t); setDetalhe(null); }}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              cat === t ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
            }`}>
            {t === "musicas" ? "Músicas" : t === "musicvideos" ? "Clipes" : "Vídeos"}
          </button>
        ))}
      </div>

      <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-black px-1">
        {catIcon} {list.length} tópico{list.length !== 1 ? "s" : ""}
      </p>

      <div className="space-y-2">
        {list.length === 0
          ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <MessageSquare className="size-10 text-muted-foreground/20" />
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest font-black">Nenhum tópico ainda</p>
            </div>
          )
          : list.map((item) => (
            <button
              key={item.id}
              onClick={() => setDetalhe({ item, cat })}
              className="w-full flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-[1.5rem] active:border-primary/30 transition-colors text-left"
            >
              <div className="size-12 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
                {item.capa
                  ? <img src={resolveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" />
                  : <div className="w-full h-full grid place-items-center"><Music className="size-4 text-primary/40" /></div>
                }
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-xs truncate uppercase tracking-tight">{item.titulo || "—"}</p>
                {item.artista && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.artista}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[9px] text-primary/50 font-bold">{catIcon} Tópico aberto</p>
                  {item.letra && (
                    <span className="text-[9px] text-muted-foreground/40 font-bold">· 📝 com letra</span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-1 text-muted-foreground/30">
                <MessageSquare className="size-3.5" />
                <ChevronRight className="size-3.5" />
              </div>
            </button>
          ))
        }
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
/**
 * FIX — Carregamento em 2 fases:
 * Fase 1 (init): busca só "musicas" → renderiza home, lançamentos, swiper → showLoading(false)
 * Fase 2 (background): busca musicvideos + videos + charts em paralelo sem bloquear a tela
 *
 * FIX — Lazy render: tabs secundárias (clipes, vídeos, fórum) só montam quando visitadas pela
 * primeira vez, via `visitedTabs` set. Zero DOM desnecessário no init.
 */
export default function PlayHomePage() {
  const [musicasDB, setMusicasDB]         = useState<SheetItem[]>([]);
  const [musicVideosDB, setMusicVideosDB] = useState<SheetItem[]>([]);
  const [videosDB, setVideosDB]           = useState<SheetItem[]>([]);

  // Fase 1 concluída quando músicas carregam
  const [phase1Done, setPhase1Done]       = useState(false);
  // Fase 2 concluída quando tudo carrega
  const [phase2Done, setPhase2Done]       = useState(false);

  const [charts, setCharts]               = useState<ChartData[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [chartsError, setChartsError]     = useState("");

  const [activeTab, setActiveTab]         = useState<Tab>("home");
  // Lazy render: mantém quais tabs já foram visitadas
  const [visitedTabs, setVisitedTabs]     = useState<Set<Tab>>(new Set(["home"]));
  const tabsRef = useRef<HTMLDivElement>(null);

  // ── Fase 1: só músicas (mais crítico para home) ──────────────────────────
  useEffect(() => {
    fetchSheetValues(ABA_MUSICAS).then(({ values, error }) => {
      setMusicasDB(sheetRowsToObjects(values));
      if (error) console.warn("[Play] musicas:", error);
      setPhase1Done(true);
    });
  }, []);

  // ── Fase 2: clipes + vídeos + charts em background após fase 1 ──────────
  useEffect(() => {
    if (!phase1Done) return;

    // MusicVideos + Videos em paralelo
    Promise.all([
      fetchSheetValues(ABA_MUSICVIDEOS),
      fetchSheetValues(ABA_VIDEOS),
    ]).then(([rmv, rv]) => {
      setMusicVideosDB(sheetRowsToObjects(rmv.values));
      setVideosDB(sheetRowsToObjects(rv.values));
      if (rmv.error) console.warn("[Play] musicvideos:", rmv.error);
      if (rv.error)  console.warn("[Play] videos:",      rv.error);
      setPhase2Done(true);
    });

    // Charts em paralelo (independente de clipes/vídeos)
    Promise.all(
      CHARTS_CONFIG.map((cfg) =>
        fetchSheetValues(cfg.aba).then((res) => ({ cfg, values: res.values, error: res.error }))
      )
    ).then((results) => {
      const errors: string[] = [];
      const built: ChartData[] = results
        .map(({ cfg, values, error }) => {
          if (error) errors.push(`[${cfg.aba}] ${error}`);
          if (!values || values.length < 2) return null;
          const { entries, capaDaPlaylist } = processChart(values, cfg.isVideo, cfg.maxEntries);
          if (!entries.length) {
            errors.push(`[${cfg.aba}] 0 entradas. Headers: ${values[0]?.join(" | ")}`);
            return null;
          }
          return {
            nome: cfg.nome,
            subtitulo: cfg.subtitulo,
            icone: cfg.icone,
            cor: cfg.cor,
            capaDaPlaylist,
            entries,
          } as ChartData;
        })
        .filter((c): c is ChartData => c !== null);
      setCharts(built);
      if (errors.length) setChartsError(errors.join(" │ "));
    })
    .catch((e) => setChartsError(String(e)))
    .finally(() => setChartsLoading(false));
  }, [phase1Done]);

  const handleTabChange = useCallback((t: Tab) => {
    setActiveTab(t);
    setVisitedTabs((prev) => new Set([...prev, t]));
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  // Carregando Fase 1
  const loading = !phase1Done;
  // Clipes e vídeos ficam em loading até fase 2
  const loadingSecundario = !phase2Done;

  return (
    <main className="flex-1 pb-40">
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
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground active:text-foreground"
                }`}
              >
                <Icon className="size-3.5" strokeWidth={active ? 2.5 : 2} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-6">
        {/* Home — sempre montada */}
        {activeTab === "home" && (
          <HomeTab
            musicasDB={musicasDB}
            musicVideosDB={musicVideosDB}
            charts={charts}
            chartsLoading={chartsLoading}
            chartsError={chartsError}
            loading={loading}
            onTabChange={handleTabChange}
          />
        )}

        {/* Músicas — lazy: só monta quando visitada pela 1ª vez */}
        {visitedTabs.has("musicas") && (
          <div className={activeTab === "musicas" ? "" : "hidden"}>
            <MusicasTab musicasDB={musicasDB} loading={loading} />
          </div>
        )}

        {/* Clipes — lazy + espera fase 2 */}
        {visitedTabs.has("clipes") && (
          <div className={activeTab === "clipes" ? "" : "hidden"}>
            <ClipesTab musicVideosDB={musicVideosDB} loading={loadingSecundario} />
          </div>
        )}

        {/* Vídeos — lazy + espera fase 2 */}
        {visitedTabs.has("videos") && (
          <div className={activeTab === "videos" ? "" : "hidden"}>
            <VideosTab videosDB={videosDB} loading={loadingSecundario} />
          </div>
        )}

        {/* Fórum — lazy: dados das 3 fontes */}
        {visitedTabs.has("forum") && (
          <div className={activeTab === "forum" ? "" : "hidden"}>
            <ForumTab
              musicasDB={musicasDB}
              musicVideosDB={musicVideosDB}
              videosDB={videosDB}
              loading={loading}
            />
          </div>
        )}
      </div>
    </main>
  );
}
