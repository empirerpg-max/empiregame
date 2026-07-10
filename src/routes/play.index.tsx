import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
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
  ArrowUp,
  ArrowDown,
  Minus,
  AlertCircle,
} from "lucide-react";
import { usePlay, type PlayItem } from "@/lib/playContext";

export const Route = createFileRoute("/play/")(({
  component: PlayHomePage,
  head: () => ({
    meta: [
      { title: "Empire Play \u2022 Empire Hub" },
      { property: "og:title", content: "Empire Play \u2022 Empire Hub" },
      { property: "og:description", content: "Ou\u00e7a as m\u00fasicas, clipes e v\u00eddeos do Empire RPG." },
    ],
  }),
}));

// \u2500\u2500\u2500 API URLs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const API_URL =
  "https://script.google.com/macros/s/AKfycby1S1mIBXdj4hLqc9RYv1ZJjL7d5ct6to18FNPmpJn1KOnZrYCKJKPNe2LP0dPW-G8HOg/exec";

const CHARTS_SHEET_ID = "1ThRhljmAS41JmVBPkPtYwe0JQHRx9Pih2PQAPT2ebyA";
const PLAY_SHEET_ID   = "1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo";
const SHEETS_KEY      = "AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY";

const PLAY_API = (aba: string) =>
  `https://sheets.googleapis.com/v4/spreadsheets/${PLAY_SHEET_ID}/values/${encodeURIComponent(aba)}?key=${SHEETS_KEY}`;

// \u2500\u2500\u2500 Configuracao dos Charts \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const CHARTS_CONFIG = [
  {
    aba: "Top_50_Spotify",
    nome: "Spotify",
    subtitulo: "Top 50 Spotify",
    icone: "\ud83d\udfe2",
    cor: "text-green-400",
    isVideo: false,
  },
  {
    aba: "Top_Songs_Apple_Music",
    nome: "Apple Music",
    subtitulo: "Top Songs Apple Music",
    icone: "\ud83c\udfb5",
    cor: "text-red-400",
    isVideo: false,
  },
  {
    aba: "Top_Videos_YT",
    nome: "YouTube",
    subtitulo: "Top Videos",
    icone: "\ud83d\udcf9",
    cor: "text-red-500",
    isVideo: true,
  },
] as const;

type Tab = "home" | "musicas" | "clipes" | "videos" | "forum";
type SheetItem = Record<string, string>;

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "home",    label: "In\u00edcio",  icon: Home },
  { id: "musicas", label: "M\u00fasicas",  icon: Music },
  { id: "clipes",  label: "Clipes",   icon: Clapperboard },
  { id: "videos",  label: "V\u00eddeos",  icon: Tv },
  { id: "forum",   label: "F\u00f3rum",   icon: MessageSquare },
];

export type ChartEntry = {
  posicao: number;
  titulo: string;
  artistas: string;
  status: string;
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

// \u2500\u2500\u2500 Helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

function sheetRowsToObjects(values: string[][]): SheetItem[] {
  if (!values || values.length < 2) return [];
  const headers = values[0].map((h) => String(h).trim());
  return values.slice(1).map((row) => {
    const obj: SheetItem = {};
    headers.forEach((h, i) => { obj[h] = String(row[i] ?? "").trim(); });
    return obj;
  });
}

// Parseia CSV do gviz (cada celula pode estar entre aspas com escaping)
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

// Busca uma aba: tenta Sheets API v4 primeiro, cai para gviz se falhar
async function fetchSheetValues(sheetId: string, aba: string, apiKey: string): Promise<{ values: string[][]; error?: string }> {
  const v4url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(aba)}?key=${apiKey}`;
  try {
    const res = await fetch(v4url);
    if (res.ok) {
      const j = await res.json();
      if (j.values && j.values.length > 0) return { values: j.values as string[][] };
      return { values: [], error: `v4 OK mas sem valores para aba "${aba}"` };
    }
    const errText = await res.text().catch(() => String(res.status));
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(aba)}`;
    const gvizRes = await fetch(gvizUrl);
    if (gvizRes.ok) {
      const csv = await gvizRes.text();
      const parsed = parseCSV(csv);
      if (parsed.length > 1) return { values: parsed };
      return { values: [], error: `gviz: CSV vazio para aba "${aba}" (v4 erro: ${res.status} ${errText.slice(0, 120)})` };
    }
    return { values: [], error: `v4 ${res.status} + gviz ${gvizRes.status} para aba "${aba}"` };
  } catch (e) {
    return { values: [], error: String(e) };
  }
}

// \u2500\u2500\u2500 processChart \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Headers reais de todas as abas de chart:
//   BRASIL | POS | PA\u00cdS | CHART | M\u00daSICA | STREAMS ESTIMADOS | DATA
//
// Mapeamento:
//   POS              -> posicao
//   M\u00daSICA           -> titulo
//   BRASIL           -> artista (nome do artista brasileiro)
//   PA\u00cdS             -> pais de origem
//   STREAMS ESTIMADOS -> streams (exibido como subtitulo)
//   DATA             -> data de entrada no chart
//   (sem capa na planilha — usa placeholder)

function processChart(
  chartValues: string[][],
  _isVideo: boolean
): { entries: ChartEntry[]; capaDaPlaylist: string } {
  if (!chartValues || chartValues.length < 2) return { entries: [], capaDaPlaylist: "" };

  const rows = sheetRowsToObjects(chartValues);

  const entries: ChartEntry[] = rows
    .map((row) => {
      // Posicao: coluna "POS"
      const posicao = parseInt(
        getField(row, "POS", "pos", "posi\u00e7\u00e3o", "posicao", "position").replace(/\D/g, "")
      ) || 0;

      // Titulo: coluna "M\u00daSICA"
      const titulo = getField(row, "M\u00daSICA", "MUSICA", "musica", "m\u00fasica", "titulo", "nome", "song", "track");

      // Artista: coluna "BRASIL" (nome do artista/ato)
      const artista = getField(row, "BRASIL", "brasil", "artista", "artist", "ato", "act");

      // Streams: coluna "STREAMS ESTIMADOS" — usado como subtitulo secundario
      const streams = getField(row, "STREAMS ESTIMADOS", "streamsestimados", "streams");

      // Pais: coluna "PA\u00cdS"
      const pais = getField(row, "PA\u00cdS", "PAIS", "pais", "pa\u00eds", "country");

      if (!posicao || !titulo) return null;

      return {
        posicao,
        titulo,
        // artistas: "BRASIL (PA\u00cdS)" se tiver pais, sen\u00e3o s\u00f3 BRASIL
        artistas: pais && pais !== artista ? `${artista} \u2022 ${pais}` : artista,
        // status: reutiliza streams como badge secundario
        status: streams || "",
        capa: "",
        playItem: undefined,
      } as ChartEntry;
    })
    .filter((e): e is ChartEntry => e !== null && e.posicao > 0)
    .sort((a, b) => a.posicao - b.posicao)
    .slice(0, 50);

  return { entries, capaDaPlaylist: "" };
}

// \u2500\u2500\u2500 Skeleton \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

// \u2500\u2500\u2500 Card Components \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function SongCard({ item, queue }: { item: PlayItem; queue: PlayItem[] }) {
  const { play, state } = usePlay();
  const isActive = state.currentIdx !== null && state.queue[state.currentIdx]?.id === item.id;
  return (
    <button onClick={() => play(item, queue)} className="flex flex-col gap-2 text-left group w-full">
      <div className={`relative aspect-square w-full rounded-2xl overflow-hidden bg-primary/10 ${isActive ? "ring-2 ring-primary" : ""} transition-all`}>
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
      <div className={`relative w-full rounded-2xl overflow-hidden bg-primary/10 aspect-video ${isActive ? "ring-2 ring-primary" : ""} transition-all`}>
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

// \u2500\u2500\u2500 Status Icon \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function StatusIcon({ status }: { status: string }) {
  const s = norm(status);
  if (s === "new" || s === "novo") return <span className="text-[8px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded-full tracking-widest">NEW</span>;
  if (s.includes("subida") || s === "up" || s === "+") return <ArrowUp className="size-3 text-green-400" />;
  if (s.includes("queda") || s === "down" || s === "-") return <ArrowDown className="size-3 text-red-400" />;
  return <Minus className="size-3 text-muted-foreground/40" />;
}

// \u2500\u2500\u2500 Chart Row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function ChartRow({ entry, queue }: { entry: ChartEntry; queue: PlayItem[] }) {
  const { play, state } = usePlay();
  const isActive =
    entry.playItem && state.currentIdx !== null && state.queue[state.currentIdx]?.id === entry.playItem.id;
  const canPlay = !!entry.playItem;

  return (
    <button
      onClick={() => { if (entry.playItem) play(entry.playItem, queue); }}
      disabled={!canPlay}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ${
        isActive
          ? "bg-primary/10 border border-primary/30"
          : canPlay
          ? "border border-transparent active:bg-white/[0.04]"
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

      <div className="size-10 rounded-xl overflow-hidden bg-white/[0.05] flex-shrink-0 grid place-items-center">
        <Music className="size-4 text-white/10" />
      </div>

      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${isActive ? "text-primary" : canPlay ? "" : "text-muted-foreground"}`}>
          {entry.titulo}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{entry.artistas}</p>
      </div>

      <div className="flex-shrink-0 text-[9px] text-muted-foreground/50 font-mono max-w-[60px] truncate text-right">
        {entry.status}
      </div>
    </button>
  );
}

// \u2500\u2500\u2500 Section Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

// \u2500\u2500\u2500 Chart Mini Card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function ChartMiniCard({ chart, onOpen }: { chart: ChartData; onOpen: () => void }) {
  const top3 = chart.entries.slice(0, 3);
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white/[0.03] border border-white/[0.06] rounded-[1.5rem] overflow-hidden active:border-primary/30 transition-all"
    >
      {/* Sem capa na planilha: usa placeholder com icone do chart */}
      <div className="relative w-full aspect-square bg-white/[0.05] grid place-items-center">
        <span className="text-5xl">{chart.icone}</span>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/60 mb-0.5">{chart.icone} {chart.nome}</p>
          <p className="text-xs font-black text-white leading-tight">{chart.subtitulo}</p>
        </div>
      </div>
      <div className="px-3 py-2.5 space-y-1.5">
        {top3.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] font-black text-muted-foreground/50 w-3">{e.posicao}</span>
            <p className="text-[10px] font-black truncate flex-1 uppercase tracking-tight">{e.titulo}</p>
          </div>
        ))}
        <p className="text-[9px] text-muted-foreground/40 pt-0.5 text-right">Ver tudo \u2192</p>
      </div>
    </button>
  );
}

// \u2500\u2500\u2500 Chart Detail View \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function ChartDetailView({ chart, onBack }: { chart: ChartData; onBack: () => void }) {
  const queue = chart.entries.filter((e) => e.playItem).map((e) => e.playItem!) as PlayItem[];
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors">
        <ChevronLeft className="size-4" /> Charts
      </button>

      <div className="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/[0.06] rounded-[1.5rem]">
        <div className="size-16 rounded-2xl overflow-hidden bg-white/[0.05] flex-shrink-0 grid place-items-center">
          <span className="text-3xl">{chart.icone}</span>
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

// \u2500\u2500\u2500 Home Tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function HomeTab({
  playMusicasDB,
  playMusicVideosDB,
  charts,
  chartsLoading,
  chartsError,
  loading,
  onTabChange,
}: {
  playMusicasDB: SheetItem[];
  playMusicVideosDB: SheetItem[];
  charts: ChartData[];
  chartsLoading: boolean;
  chartsError: string;
  loading: boolean;
  onTabChange: (t: Tab) => void;
}) {
  const [openChart, setOpenChart] = useState<ChartData | null>(null);
  const [homeSection, setHomeSection] = useState<"charts" | "lancamentos">("charts");

  const lancMusicas = useMemo<PlayItem[]>(
    () =>
      [...playMusicasDB]
        .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
        .slice(0, 5)
        .map((m) => toPlayItem(m, "musica")),
    [playMusicasDB]
  );

  const lancVideos = useMemo<PlayItem[]>(
    () =>
      [...playMusicVideosDB]
        .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
        .slice(0, 5)
        .map((m) => toPlayItem(m, "musicvideo")),
    [playMusicVideosDB]
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
            {s === "charts" ? "\ud83c\udfc6 Top Charts" : "\u2728 Lan\u00e7amentos"}
          </button>
        ))}
      </div>

      {homeSection === "charts" && (
        <section className="space-y-4">
          {chartsLoading ? (
            <SkeletonGrid cols={3} rows={1} />
          ) : charts.length === 0 ? (
            <div className="space-y-3">
              <p className="text-center text-xs text-muted-foreground py-4 opacity-40">Nenhum chart dispon\u00edvel.</p>
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
                    title="\u00daltimas M\u00fasicas"
                    onMore={() => onTabChange("musicas")}
                  />
                  <div className="space-y-1">
                    {lancMusicas.map((item, i) => <RowTrack key={item.id} item={item} queue={lancMusicas} num={i + 1} />)}
                  </div>
                </div>
              )}
              {lancVideos.length > 0 && (
                <div>
                  <SectionHeader
                    icon={<Clapperboard className="size-4 text-primary" />}
                    title="\u00daltimos Clipes"
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

// \u2500\u2500\u2500 M\u00fasicas Tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
      <div className="grid grid-cols-3 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
        {(["lancamentos", "top", "albuns"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              subTab === t ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground"
            }`}
          >
            {t === "lancamentos" ? "Lan\u00e7amentos" : t === "top" ? "Top" : "\u00c1lbuns"}
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

// \u2500\u2500\u2500 Clipes Tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

// \u2500\u2500\u2500 V\u00eddeos Tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

// \u2500\u2500\u2500 Forum Tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

// \u2500\u2500\u2500 Main Page \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
export default function PlayHomePage() {
  const [musicasDB, setMusicasDB]         = useState<SheetItem[]>([]);
  const [musicVideosDB, setMusicVideosDB] = useState<SheetItem[]>([]);
  const [videosDB, setVideosDB]           = useState<SheetItem[]>([]);
  const [loading, setLoading]             = useState(true);

  const [charts, setCharts]               = useState<ChartData[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [chartsError, setChartsError]     = useState("");

  const [playMusicasDB, setPlayMusicasDB]         = useState<SheetItem[]>([]);
  const [playMusicVideosDB, setPlayMusicVideosDB] = useState<SheetItem[]>([]);

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const tabsRef = useRef<HTMLDivElement>(null);

  // 1. Empire Play API \u2014 M\u00fasicas, Clipes, V\u00eddeos
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}?action=conteudo&categoria=musicas`).then((r) => r.json()),
      fetch(`${API_URL}?action=conteudo&categoria=musicvideos`).then((r) => r.json()),
      fetch(`${API_URL}?action=conteudo&categoria=videos`).then((r) => r.json()),
    ])
      .then(([rm, rmv, rv]) => {
        setMusicasDB(rm.data || []);
        setMusicVideosDB(rmv.data || []);
        setVideosDB(rv.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // 2. Sheets API \u2014 planilha Empire Play (lancamentos) + Charts
  useEffect(() => {
    const playPromise = Promise.all([
      fetch(PLAY_API("Musicas")).then((r) => r.json()).catch(() => ({ values: [] })),
      fetch(PLAY_API("Music Videos")).then((r) => r.json()).catch(() => ({ values: [] })),
    ]).then(([rm, rmv]) => {
      setPlayMusicasDB(sheetRowsToObjects(rm.values || []));
      setPlayMusicVideosDB(sheetRowsToObjects(rmv.values || []));
    });

    // Charts: fetchSheetValues tenta v4 -> gviz automaticamente
    const chartsPromise = Promise.all(
      CHARTS_CONFIG.map((cfg) =>
        fetchSheetValues(CHARTS_SHEET_ID, cfg.aba, SHEETS_KEY)
          .then((res) => ({ cfg, values: res.values, error: res.error }))
      )
    ).then((results) => {
      const errors: string[] = [];
      const built: ChartData[] = results
        .map(({ cfg, values, error }) => {
          if (error) errors.push(`[${cfg.aba}] ${error}`);
          if (!values || values.length < 2) return null;
          const { entries, capaDaPlaylist } = processChart(values, cfg.isVideo);
          if (!entries.length) {
            errors.push(`[${cfg.aba}] 0 entries. Headers: ${values[0]?.join(" | ")}`);
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
      if (errors.length) setChartsError(errors.join(" \u2502 "));
    });

    Promise.all([playPromise, chartsPromise])
      .catch((e) => setChartsError(String(e)))
      .finally(() => setChartsLoading(false));
  }, []);

  const handleTabChange = (t: Tab) => {
    setActiveTab(t);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

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
        <h1 className="text-2xl font-black tracking-tighter">Ou\u00e7a agora</h1>
        <p className="text-xs text-muted-foreground mt-1">M\u00fasicas, clipes e v\u00eddeos do universo Empire</p>
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
        {activeTab === "home" && (
          <HomeTab
            playMusicasDB={playMusicasDB}
            playMusicVideosDB={playMusicVideosDB}
            charts={charts}
            chartsLoading={chartsLoading}
            chartsError={chartsError}
            loading={loading}
            onTabChange={handleTabChange}
          />
        )}
        {activeTab === "musicas" && <MusicasTab musicasDB={musicasDB} loading={loading} />}
        {activeTab === "clipes"  && <ClipesTab musicVideosDB={musicVideosDB} loading={loading} />}
        {activeTab === "videos"  && <VideosTab videosDB={videosDB} loading={loading} />}
        {activeTab === "forum"   && <ForumTab musicasDB={musicasDB} musicVideosDB={musicVideosDB} videosDB={videosDB} loading={loading} />}
      </div>
    </main>
  );
}
