// Empire TV — cliente do Apps Script dedicado à TV.
// Mantém o mesmo padrão de src/lib/api.ts (GET com query string).

export const EMPIRETV_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby7OeFYuai1QoTEXD427-Kn_2KBvh3nakD4iKSuOji9-i3x7sK8DD59BHRBRc5Ow1YB/exec";

export interface TvProgram {
  programa?: string;
  titulo?: string;
  inicio?: string; // ISO ou string da planilha
  fim?: string;
  duracao?: number;
  driveId?: string;
  driveUrl?: string;
  streamUrl?: string;
  capa?: string;
  descricao?: string;
  [k: string]: unknown;
}

export interface TvStatus {
  status?: string;
  message?: string;
  timestamp?: string;
  current?: TvProgram | null;
  fullSchedule?: TvProgram[];
}

export interface TvChatMessage {
  id?: string;
  tgId?: string;
  nome?: string;
  texto: string;
  data?: string;
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

async function call<T = unknown>(params: Record<string, unknown>, method: "GET" | "POST" = "GET"): Promise<T> {
  const isPost = method === "POST";
  const url = isPost ? EMPIRETV_SCRIPT_URL : `${EMPIRETV_SCRIPT_URL}?${qs(params as any)}`;
  const res = await fetch(url, {
    method,
    body: isPost ? JSON.stringify(params) : undefined,
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export const tvApi = {
  // doGet sem params devolve current + fullSchedule
  status(): Promise<TvStatus> {
    return call<TvStatus>({});
  },
  // Os endpoints de chat abaixo dependem do Apps Script ter as acoes
  // "tv_chat_list" e "tv_chat_send". Se não tiver, o front mostra o chat vazio
  // e o envio falha silenciosamente — adicione ao seu Script da TV.
  async chatList(): Promise<TvChatMessage[]> {
    const r = await call<TvChatMessage[] | { mensagens?: TvChatMessage[] }>({ acao: "tv_chat_list" });
    if (Array.isArray(r)) return r;
    return Array.isArray((r as any)?.mensagens) ? (r as any).mensagens : [];
  },
  async chatSend(p: { tgId: string; nome: string; texto: string }) {
    return call<{ ok?: boolean; erro?: string }>(
      { acao: "tv_chat_send", tgId: p.tgId, nome: p.nome, texto: p.texto },
      "POST",
    );
  },
};

// Tenta extrair um ID do Drive de um campo livre (URL completa ou só ID)
export function extractDriveId(v?: string | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/[-\w]{25,}/);
  return m ? m[0] : null;
}

// URL embarcável: usa streamUrl da planilha quando vier; senão, Drive preview.
export function buildPlayerSrc(p?: TvProgram | null): string | null {
  if (!p) return null;
  if (p.streamUrl) return p.streamUrl;
  const id = p.driveId || extractDriveId(p.driveUrl);
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  return null;
}
