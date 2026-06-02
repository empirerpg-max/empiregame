// Empire Hub — Apps Script API client
// Mantém Apps Script + Google Sheets como backend.

export const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwxbkUndhZPtFvtK1uIFTkPNN-m6WeiFVMU3IDzuahsC0oQp8Ba2GLQFOAPkWv8eiA3/exec";

export interface Artist {
  nome: string;
  foto: string;
  status: string;
  saldo: number;
  gravadora: string;
  fortuna_real: number;
  fortuna_bens: number;
  fortuna_total: number;
  prestigio: number;
  fadiga: number;
  seguidores: number;
  vendas_total: number;
  telegram_id?: string;
  tour_info?: unknown;
  descricao?: string;
  genero?: string;
  pais?: string;
}

export interface RadarItem {
  timestamp: string;
  nome: string;
  acao: string;
  foto: string;
}

export interface Projeto {
  tipo: string;
  titulo: string;
  status: string;
  data?: string;
  detalhe?: string;
  [k: string]: unknown;
}

export interface AlbumFaixa {
  numero: number;
  titulo: string;
  artistas: string;
  duracao?: string;
  drive_url: string;
  letra?: string;
}

export interface AlbumPayload {
  id?: string;
  artista: string;
  titulo: string;
  genero: string;
  data: string;
  capa_url: string;
  contracapa_url?: string;
  encarte: string[];
  faixas: AlbumFaixa[];
  descricao?: string;
  telegram_id?: string;
}

export interface MarketItem {
  categoria: string;
  item: string;
  preco: number;
  efeito: string;
}

export interface MuralItem {
  id: string;
  vendedor: string;
  titulo: string;
  teaser: string;
  preco: number;
}

export interface BemItem {
  id?: string;
  artista: string;
  categoria: string;
  item: string;
  valor: number;
  data: string;
  status?: string;
}

// --- Interfaces Social ---
export interface PostSocial {
  id: string;
  autor: string;
  foto_autor: string;
  conteudo: string;
  imagem?: string;
  timestamp: string;
  likes: number;
  comentarios: number;
  tipo: string;
}

export interface PerfilSocial {
  tg_id: string;
  nome: string;
  foto: string;
  bio?: string;
  seguidores: number;
  seguindo: number;
}

export interface NewsSocial {
  id: string;
  titulo: string;
  conteudo: string;
  autor: string;
  timestamp: string;
  imagem?: string;
}

export interface ComentarioSocial {
  id: string;
  post_id: string;
  autor: string;
  foto_autor: string;
  conteudo: string;
  timestamp: string;
}
// --- fim interfaces Social ---

function qs(params: Record<string, string | number | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    u.set(k, String(v));
  }
  u.set("_t", String(Date.now()));
  return u.toString();
}

// --- Cache em memória SWR (stale-while-revalidate) ---
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_FRESH = 60_000;
const CACHE_STALE = 5 * 60_000;
const inflight = new Map<string, Promise<unknown>>();

// Timeout global para chamadas ao Google Apps Script
const GAS_TIMEOUT_MS = 15_000;

async function rawCall<T = unknown>(params: Record<string, unknown>): Promise<T> {
  const isPost = params.payload || JSON.stringify(params).length > 1000;
  const options: RequestInit = {
    method: isPost ? "POST" : "GET",
    signal: AbortSignal.timeout(GAS_TIMEOUT_MS),
  };
  if (isPost) options.body = JSON.stringify(params);
  const url = isPost ? SCRIPT_URL : `${SCRIPT_URL}?${qs(params as Record<string, string | number | undefined>)}`;
  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

function fetchAndStore<T>(key: string, params: Record<string, unknown>): Promise<T> {
  const p = rawCall<T>(params)
    .then((data) => {
      cache.set(key, { data, ts: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((e) => {
      inflight.delete(key);
      throw e;
    });
  inflight.set(key, p);
  return p;
}

async function call<T = unknown>(params: Record<string, unknown>, opts: { cache?: boolean } = {}): Promise<T> {
  if (!opts.cache) return rawCall<T>(params);
  const key = JSON.stringify(params);
  const hit = cache.get(key);
  const age = hit ? Date.now() - hit.ts : Infinity;
  if (hit && age < CACHE_FRESH) return hit.data as T;
  if (hit && age < CACHE_STALE) {
    if (!inflight.has(key)) fetchAndStore<T>(key, params).catch(() => {});
    return hit.data as T;
  }
  if (inflight.has(key)) return inflight.get(key)! as Promise<T>;
  return fetchAndStore<T>(key, params);
}

export function invalidateCache() {
  cache.clear();
}

function normalizeArtist(a: Record<string, unknown>): Artist {
  return {
    nome: String(a.nome || "").trim(),
    foto: String(a.foto || ""),
    status: String(a.status || "Livre"),
    saldo: Number(a.saldo || 0),
    gravadora: String(a.gravadora || "Independent").replace(/\s*#\d+$/, ""),
    fortuna_real: Number(a.fortuna_real || 0),
    fortuna_bens: Number(a.fortuna_bens || 0),
    fortuna_total: Number(a.fortuna_total || 0),
    prestigio: Number(a.prestigio || 0),
    fadiga: Number(a.fadiga || 0),
    seguidores: Number(a.seguidores || 0),
    vendas_total: Number(a.vendas_total || 0),
    telegram_id: a.telegram_id ? String(a.telegram_id) : undefined,
    tour_info: a.tour_info,
    descricao: (a.descricao || "")?.toString().trim(),
    genero: (a.genero || "")?.toString().trim(),
    pais: (a.pais || "")?.toString().trim(),
  };
}

export interface CommonResponse {
  ok?: boolean;
  erro?: string;
  message?: string;
  id?: string;
}

export const api = {
  call: <T = unknown>(params: Record<string, unknown>, opts: { cache?: boolean } = {}) =>
    call<T>(params, opts),

  async meusArtistas(telegramId: string): Promise<Artist[]> {
    const data = await call<Record<string, unknown>[]>(
      { acao: "meus_artistas", telegram_id: telegramId },
      { cache: true },
    );
    return Array.isArray(data) ? data.map((a) => normalizeArtist(a)) : [];
  },
  async listarTodos(): Promise<Artist[]> {
    const data = await call<Record<string, unknown>[]>({ acao: "listar_todos" }, { cache: true });
    return Array.isArray(data) ? data.map((a) => normalizeArtist(a)) : [];
  },
  async radar(): Promise<RadarItem[]> {
    const data = await call<RadarItem[]>({ acao: "radar" }, { cache: true });
    return Array.isArray(data) ? data : [];
  },
  async projetos(nome: string): Promise<Projeto[]> {
    const data = await call<Projeto[]>({ acao: "projetos", nome }, { cache: true });
    return Array.isArray(data) ? data : [];
  },
  async getArtist(nome: string): Promise<Artist | null> {
    const data = await call<Record<string, unknown>>({ acao: "get_artist", nome }, { cache: true });
    return data && typeof data === "object" && !Array.isArray(data) ? normalizeArtist(data) : null;
  },
  async listarMarket(): Promise<MarketItem[]> {
    const data = await call<MarketItem[]>({ acao: "listar_market" }, { cache: true });
    return Array.isArray(data) ? data : [];
  },
  async listarMural(): Promise<MuralItem[]> {
    const data = await call<MuralItem[]>({ acao: "listar_mural" }, { cache: true });
    return Array.isArray(data) ? data : [];
  },
  async listarCategoriasMarket(): Promise<string[]> {
    const data = await call<string[]>({ acao: "listar_categorias_market" }, { cache: true });
    return Array.isArray(data) ? data : [];
  },
  async comprarMarket(p: { nome: string; categoria: string; item: string }): Promise<CommonResponse> {
    return call<CommonResponse>({ acao: "comprar_market", ...p });
  },
  async comprarMural(p: { nome: string; id: string }): Promise<CommonResponse> {
    return call<CommonResponse>({ acao: "comprar_mural", ...p });
  },
  async venderComposicao(p: { nome: string; titulo: string; preco: number }): Promise<CommonResponse> {
    return call<CommonResponse>({ acao: "vender_composicao", ...p });
  },
  async getMusicasBet(): Promise<{ semana: string; musicas: any[] } | null> {
    const data = await call<{ semana: string; musicas: any[] } | null>({ acao: "get_musicas_bet" }, { cache: true });
    return data || null;
  },
  async searchSongs(query: string): Promise<any[]> {
    const data = await call<any[]>({ acao: "search_songs", query });
    return Array.isArray(data) ? data : [];
  },
  async bet(p: { nome: string; valor: number; semana: string; previsoes: string }): Promise<CommonResponse> {
    return call<CommonResponse>({ acao: "bet", ...p });
  },
  async listarBems(nome: string): Promise<BemItem[]> {
    const data = await call<BemItem[]>({ acao: "listar_bems", nome }, { cache: true });
    return Array.isArray(data) ? data : [];
  },
  async venderBem(p: { id: string; nome: string }): Promise<CommonResponse> {
    return call<CommonResponse>({ acao: "vender_bem", ...p });
  },
  async registrarBem(p: Omit<BemItem, "id">): Promise<CommonResponse> {
    return call<CommonResponse>({ acao: "registrar_bem", ...p });
  },

  // Ranking por fortuna total (usado em /ranking)
  async ranking(): Promise<Artist[]> {
    const data = await call<Record<string, unknown>[]>({ acao: "listar_todos" }, { cache: true });
    if (!Array.isArray(data)) return [];
    return data
      .map((a) => normalizeArtist(a))
      .sort((a, b) => b.fortuna_total - a.fortuna_total);
  },

  // Ranking por prestígio (usado em /ranking → aba Prestígio)
  async charts(): Promise<Artist[]> {
    const data = await call<Record<string, unknown>[]>({ acao: "listar_todos" }, { cache: true });
    if (!Array.isArray(data)) return [];
    return data
      .map((a) => normalizeArtist(a))
      .sort((a, b) => b.prestigio - a.prestigio);
  },

  // --- Social ---
  async listarPostsSocial(): Promise<PostSocial[]> {
    const data = await call<PostSocial[]>({ acao: "listarPostsSocial" }, { cache: true });
    return Array.isArray(data) ? data : [];
  },
  async listarPerfisSocial(): Promise<PerfilSocial[]> {
    const data = await call<PerfilSocial[]>({ acao: "listarPerfisSocial" }, { cache: true });
    return Array.isArray(data) ? data : [];
  },
  async listarNewsSocial(): Promise<NewsSocial[]> {
    const data = await call<NewsSocial[]>({ acao: "listarNewsSocial" }, { cache: true });
    return Array.isArray(data) ? data : [];
  },
  async salvarPostSocial(payload: Record<string, unknown>, tgId: string): Promise<CommonResponse> {
    return call<CommonResponse>({
      acao: "salvarPostSocial",
      payload: JSON.stringify(payload),
      tgId,
    });
  },
  async salvarPerfilSocial(payload: Record<string, unknown>, tgId: string): Promise<CommonResponse> {
    return call<CommonResponse>({
      acao: "salvarPerfilSocial",
      payload: JSON.stringify(payload),
      tgId,
    });
  },
  async salvarNewsSocial(payload: Record<string, unknown>, tgId: string): Promise<CommonResponse> {
    return call<CommonResponse>({
      acao: "salvarNewsSocial",
      payload: JSON.stringify(payload),
      tgId,
    });
  },
  async curtirPostSocial(postId: string, tgId: string): Promise<{ ok: boolean; likes?: number }> {
    return call<{ ok: boolean; likes?: number }>({
      acao: "curtirPostSocial",
      postId,
      tgId,
    });
  },
  async comentarPostSocial(payload: Record<string, unknown>, tgId: string): Promise<CommonResponse> {
    return call<CommonResponse>({
      acao: "comentarPostSocial",
      payload: JSON.stringify(payload),
      tgId,
    });
  },
  async listarComentariosSocial(postId: string): Promise<ComentarioSocial[]> {
    const data = await call<ComentarioSocial[]>({ acao: "listarComentariosSocial", postId });
    return Array.isArray(data) ? data : [];
  },
  // --- fim Social ---
};

// Utilitários de formatação
export function fmtEC(v: number): string {
  if (v >= 1_000_000) return `EC ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `EC ${(v / 1_000).toFixed(0)}K`;
  return `EC ${v}`;
}

/** Alias de fmtEC — mantém compatibilidade com imports de fmtMoney */
export const fmtMoney = fmtEC;

export function driveImg(url: string, size = 200): string {
  if (!url) return "";
  const m = url.match(/\/d\/([^/]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}=s${size}`;
  return url;
}

export function driveAudioSrc(url: string): string {
  if (!url) return "";
  const m = url.match(/\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return url;
}
