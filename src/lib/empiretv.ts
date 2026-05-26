export const EMPIRETV_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby7OeFYuai1QoTEXD427-Kn_2KBvh3nakD4iKSuOji9-i3x7sK8DD59BHRBRc5Ow1YB/exec";

export const KICK_CHANNEL = "empiretvoficial"; // troca pelo nome real do canal no Kick

export interface TvProgram {
  programa?:       string;
  titulo?:         string;
  tipo?:           string;
  material?:       string;
  buff?:           string;
  inicio?:         number | string;
  fim?:            number | string;
  horario?:        string;
  duracao?:        number;
  driveId?:        string;
  driveUrl?:       string;
  streamUrl?:      string;
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

export interface TvChatMessage {
  id?:     string;
  tgId?:   string;
  nome?:   string;
  texto:   string;
  tipo?:   "texto" | "gif";
  gifUrl?: string;
  data?:   string;
}

export interface GifResult {
  id:      string;
  url:     string;
  preview: string;
  title:   string;
}

function qs(p: Record<string, string | number | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null) continue;
    u.set(k, String(v));
  }
  u.set("_t", String(Date.now()));
  return u.toString();
}

async function call<T = unknown>(
  params: Record<string, unknown>,
  method: "GET" | "POST" = "GET"
): Promise<T> {
  const isPost = method === "POST";
  const url = isPost
    ? EMPIRETV_SCRIPT_URL
    : `${EMPIRETV_SCRIPT_URL}?${qs(params as any)}`;
  const res = await fetch(url, {
    method,
    body: isPost ? JSON.stringify(params) : undefined,
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

export function extractDriveId(v?: string | null): string | null {
  if (!v) return null;
  const m = String(v).trim().match(/[-\w]{25,}/);
  return m ? m[0] : null;
}

export function buildPlayerSrc(_p?: TvProgram | null): string {
  return `https://player.kick.com/${KICK_CHANNEL}?autoplay=true&muted=false`;
}
