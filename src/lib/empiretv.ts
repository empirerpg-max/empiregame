export const EMPIRETV_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby7OeFYuai1QoTEXD427-Kn_2KBvh3nakD4iKSuOji9-i3x7sK8DD59BHRBRc5Ow1YB/exec";

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
  videoUrl?:       string;
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

export interface ParticipacaoItem {
  programa:    string;
  tipo:        string;
  nome:        string;
  tgId:        string;
  data:        string;
  mensagens:   number;
  porcentagem: string;
}

export interface GifResult {
  id:      string;
  url:     string;
  preview: string;
  title:   string;
}

export interface ProgramEntry {
  programa:  string;
  data:      string;
  horario:   string;
  capaUrl:   string;
  topicoUrl: string;
  topicoId:  string;
  rowNums:   number[];
  hasLive:   boolean;
  liveItem?: TvProgram;
}

/**
 * Agrupa itens da grade em entradas por programa+data.
 * Aceita TvProgram[], TvStatus (extrai fullSchedule automaticamente) ou null/undefined.
 * O currentRowNum marca qual entrada está ao vivo.
 */
export function buildProgramEntries(
  input: TvProgram[] | TvStatus | null | undefined,
  currentRowNum?: number
): ProgramEntry[] {
  // normaliza o input para sempre trabalhar com TvProgram[]
  let schedule: TvProgram[];
  if (!input) {
    schedule = [];
  } else if (Array.isArray(input)) {
    schedule = input;
  } else {
    // recebeu TvStatus — extrai fullSchedule
    schedule = Array.isArray((input as TvStatus).fullSchedule)
      ? (input as TvStatus).fullSchedule!
      : [];
  }

  const map = new Map<string, ProgramEntry>();
  for (const p of schedule) {
    const nome = String(p.programa || p.titulo || "Sem nome");
    const data = String(p.data || "");
    const key  = `${nome}||${data}`;
    if (!map.has(key)) {
      map.set(key, {
        programa:  nome,
        data,
        horario:   String(p.horario || (p as any).horarioStr || ""),
        capaUrl:   String(p.capaUrl  || ""),
        topicoUrl: String(p.topicoUrl || ""),
        topicoId:  String(p.topicoId  || ""),
        rowNums:   [],
        hasLive:   false,
      });
    }
    const entry = map.get(key)!;
    if (p.rowNum !== undefined) entry.rowNums.push(p.rowNum);
    if (!entry.capaUrl   && p.capaUrl)   entry.capaUrl   = String(p.capaUrl);
    if (!entry.topicoUrl && p.topicoUrl) entry.topicoUrl = String(p.topicoUrl);
    if (!entry.topicoId  && p.topicoId)  entry.topicoId  = String(p.topicoId);
    if (currentRowNum !== undefined && p.rowNum === currentRowNum) {
      entry.hasLive  = true;
      entry.liveItem = p;
    }
  }
  return Array.from(map.values());
}

// Pool de callbacks JSONP ativos — permite cancelar requests pendentes
const activeJsonp = new Map<string, { script: HTMLScriptElement; timeout: ReturnType<typeof setTimeout> }>();

function jsonp<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const cbName = "_gjp_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("JSONP timeout"));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      activeJsonp.delete(cbName);
      try { delete (window as any)[cbName]; } catch {}
      try { if (script.parentNode) script.parentNode.removeChild(script); } catch {}
    }

    (window as any)[cbName] = (data: T) => {
      cleanup();
      resolve(data);
    };

    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${cbName}&_t=${Date.now()}`;
    script.onerror = () => { cleanup(); reject(new Error("JSONP error")); };

    activeJsonp.set(cbName, { script, timeout });
    document.head.appendChild(script);
  });
}

async function postScript<T>(params: Record<string, unknown>): Promise<T> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v ?? ""))}`)
    .join("&");
  return jsonp<T>(`${EMPIRETV_SCRIPT_URL}?${qs}`);
}

const CHAT_BACKEND_URL = "https://empiretv-chat-backend.onrender.com";

export const tvApi = {
  status(): Promise<TvStatus> {
    return jsonp<TvStatus>(EMPIRETV_SCRIPT_URL);
  },
  participacao(programa: string): Promise<ParticipacaoItem[]> {
    const url = `${EMPIRETV_SCRIPT_URL}?acao=tv_participacao_lista&programa=${encodeURIComponent(programa)}`;
    return jsonp<ParticipacaoItem[]>(url);
  },
  chatList(topicoId?: string): Promise<ChatMsg[]> {
    const qs = topicoId ? `&topicoId=${encodeURIComponent(topicoId)}` : "";
    return jsonp<ChatMsg[]>(`${EMPIRETV_SCRIPT_URL}?acao=tv_chat_list${qs}`);
  },
  chatSend(p: {
    tgId: string; nome: string; texto: string;
    topicoId?: string; tipo?: string; gifUrl?: string;
  }) {
    return postScript<{ ok?: boolean; id?: string; erro?: string }>({
      acao: "tv_chat_send",
      tgId: p.tgId, nome: p.nome, texto: p.texto,
      topicoId: p.topicoId || "", tipo: p.tipo || "texto", gifUrl: p.gifUrl || "",
    });
  },
  registrarParticipacao(p: {
    tgId: string; nome: string; programa: string;
    tipo?: string; topicoId?: string; topicoUrl?: string;
  }) {
    return postScript<{ ok?: boolean }>({
      acao: "tv_participacao",
      tgId: p.tgId, nome: p.nome, programa: p.programa,
      tipo: p.tipo || "", topicoId: p.topicoId || "", topicoUrl: p.topicoUrl || "",
    });
  },
};

export interface ChatMsg {
  id:     string;
  tgId:   string;
  nome:   string;
  texto:  string;
  tipo:   string;
  gifUrl: string;
  data:   string;
}

export async function searchGifs(query: string): Promise<GifResult[]> {
  try {
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyAyimkuYQYF_FXVALexPmHA0hUeP4pIHEA&limit=12&media_filter=gif`;
    const res  = await fetch(url);
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      id: r.id,
      url: r.media_formats?.gif?.url || "",
      preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || "",
      title: r.content_description || "",
    }));
  } catch { return []; }
}

export function buildPlayerSrc(p?: TvProgram | null): string {
  if (!p) return `https://player.kick.com/${KICK_CHANNEL}?autoplay=true&muted=false`;
  const driveId = String(p.driveId || "").trim();
  if (driveId && p.videoUrl && String(p.videoUrl).startsWith("http")) {
    return String(p.videoUrl);
  }
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

export function driveImgUrl(url: string): string {
  if (!url) return "";
  const s = url.trim();
  if (s.includes("drive.google.com")) {
    let id = "";
    if (s.includes("id=")) {
      id = s.split("id=")[1].split("&")[0];
    } else {
      const parts = s.split("/");
      const dIdx = parts.indexOf("d");
      if (dIdx !== -1) id = parts[dIdx + 1];
    }
    if (id) return `https://lh3.googleusercontent.com/d/${id}`;
  }
  return s;
}
