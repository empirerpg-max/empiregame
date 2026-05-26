// URL do Apps Script — usada APENAS no proxy, nunca chamada diretamente do frontend
export const EMPIRETV_SCRIPT_URL =
  "https://script.google.com/macros/s/1onh3JyLiMWozurKqg10O2_0gNm_pia_Cm9vemiIStwk/exec";

// Proxy que resolve CORS
const PROXY_BASE = "https://ais-pre-xdvvwb2nomenedx7hnl5yn-237278842798.us-east5.run.app";

export const KICK_CHANNEL = "empiretvoficial";

export interface TvProgram {
  id?:             string;
  programa?:       string;
  titulo?:         string;
  tipo?:           string;
  material?:       string;
  buff?:           string;
  capaUrl?:        string;
  inicio?:         number | string;
  fim?:            number | string;
  horario?:        string;
  data?:           string;
  duracao?:        number;
  driveId?:        string;
  topicoId?:       string;
  topicoUrl?:      string;
  status?:         string;
  rowNum?:         number;
  seekOffset?:     number;
  secondsToStart?: number;
  isBackup?:       boolean;
  [k: string]:     unknown;
}

export interface TvStatus {
  status?:       string;
  message?:      string;
  timestamp?:    string;
  current?:      TvProgram | null;
  fullSchedule?: TvProgram[];
}

export interface GifResult {
  id:      string;
  url:     string;
  preview: string;
  title:   string;
}

async function call<T = unknown>(
  params: Record<string, unknown>,
  method: "GET" | "POST" = "GET"
): Promise<T> {
  const isPost = method === "POST";

  // Roteia pelo proxy para evitar CORS
  // GET  → /tv-status?_t=...
  // POST → /tv-action  (body JSON com { acao, ... })
  const endpoint = isPost
    ? `${PROXY_BASE}/tv-action`
    : `${PROXY_BASE}/tv-status?_t=${Date.now()}`;

  const res = await fetch(endpoint, {
    method,
    headers: isPost ? { "Content-Type": "application/json" } : undefined,
    body: isPost ? JSON.stringify({ ...params, _scriptUrl: EMPIRETV_SCRIPT_URL }) : undefined,
  });

  const text = await res.text();
  try { return JSON.parse(text) as T; }
  catch { return text as unknown as T; }
}

export const tvApi = {
  status(): Promise<TvStatus> {
    return call<TvStatus>({});
  },
  async registrarParticipacao(p: { tgId: string; nome: string; programa: string; tipo?: string }) {
    return call<{ ok?: boolean }>(
      { acao: "tv_participacao", tgId: p.tgId, nome: p.nome, programa: p.programa, tipo: p.tipo || "" },
      "POST"
    );
  },
};

export async function searchGifs(query: string): Promise<GifResult[]> {
  try {
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyAyimkuYQYF_FXVALexPmHA0hUeP4pIHEA&limit=12&media_filter=gif`;
    const res  = await fetch(url);
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      id:      r.id,
      url:     r.media_formats?.gif?.url || "",
      preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || "",
      title:   r.content_description || "",
    }));
  } catch { return []; }
}

export function buildPlayerSrc(_p?: TvProgram | null): string {
  return `https://player.kick.com/${KICK_CHANNEL}?autoplay=true&muted=false`;
}

export function groupByDate(schedule: TvProgram[]): Record<string, TvProgram[]> {
  const groups: Record<string, TvProgram[]> = {};
  for (const p of schedule) {
    const key = String(p.data || "Sem data");
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return groups;
}

export function groupByPrograma(schedule: TvProgram[]): Record<string, TvProgram[]> {
  const groups: Record<string, TvProgram[]> = {};
  for (const p of schedule) {
    const key = String(p.programa || p.titulo || "Sem nome");
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return groups;
}

export function getProgramStatus(p: TvProgram, currentRowNum?: number): "live" | "upcoming" | "ended" {
  const s = String(p.status || "").toLowerCase();
  if (s === "transmitindo" || p.rowNum === currentRowNum) return "live";
  if (s === "finalizado") return "ended";
  return "upcoming";
}
