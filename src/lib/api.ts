// src/lib/api.ts
// ─── Tipos compartilhados ────────────────────────────────────────────────
export type Artist = {
  nome: string;
  foto?: string;
  status?: string;
  saldo?: number;
  descricao?: string;
  fortuna_real?: number;
  fortuna_bens?: number;
  fortuna_total?: number;
  prestigio?: number;
  fadiga?: number;
  telegram_id?: string;
  genero?: string;
  gravadora?: string;
  tour_info?: any;
  pais?: string;
  fortuna?: number;
};

export type AlbumFaixa = {
  numero: number | string;
  titulo: string;
  artistas: string;
  duracao?: string;
  drive_url?: string;
  letra?: string;
};

export type AlbumPayload = {
  id?: string;
  artista: string;
  titulo: string;
  genero?: string;
  data?: string;
  descricao?: string;
  capa_url?: string;
  contracapa_url?: string;
  telegram_id?: string;
  faixas?: AlbumFaixa[];
};

export type PlaylistTrack = {
  album_id?: string;
  numero?: number | string;
  titulo: string;
  artistas: string;
  drive_url?: string;
  capa_url?: string;
  duracao?: string;
};

export type PlaylistPayload = {
  id?: string;
  titulo: string;
  descricao?: string;
  capa_url?: string;
  owner?: string;
  telegram_id?: string;
  tracks?: PlaylistTrack[];
  data?: string;
};

export type BemItem = {
  id: string;
  categoria: string;
  item: string;
  valor: number;
  data?: string;
};

export type Projeto = {
  tipo: string;
  titulo: string;
  status?: string;
  data?: string;
  detalhe?: string;
};

export type RadarItem = {
  timestamp: string;
  nome: string;
  acao: string;
  foto?: string;
};

export type ChartData = {
  musica: string;
  artista: string;
  foto?: string;
  data?: string;
  url?: string;
};

export type MarketItem = {
  categoria: string;
  item: string;
  preco: number;
  efeito?: string;
};

export type MuralItem = {
  id: string;
  vendedor: string;
  titulo: string;
  teaser?: string;
  preco: number;
};

// ─── Helpers de formatação / Drive ───────────────────────────────────────
export function fmtEC(v: number | string | undefined | null): string {
  const n = Number(v ?? 0);
  if (isNaN(n)) return "EC 0";
  return "EC " + n.toLocaleString("pt-BR");
}

export function fmtMoney(v: number | string | undefined | null): string {
  const n = Number(v ?? 0);
  if (isNaN(n)) return "$0";
  return "$" + n.toLocaleString("pt-BR");
}

export function driveImg(url: string | undefined | null, size?: number): string {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";
  if (s.includes("drive.google.com")) {
    let id = "";
    if (s.includes("id=")) {
      id = s.split("id=")[1].split("&")[0];
    } else {
      const parts = s.split("/");
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === "d" && parts[i + 1]) {
          id = parts[i + 1];
          break;
        }
      }
    }
    if (id) {
      const base = `https://lh3.googleusercontent.com/d/${id}`;
      return size ? `${base}=w${size}` : base;
    }
  }
  return s;
}

export function driveAudioSrc(url: string | undefined | null): string {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";
  if (s.includes("drive.google.com")) {
    let id = "";
    if (s.includes("id=")) {
      id = s.split("id=")[1].split("&")[0];
    } else {
      const parts = s.split("/");
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === "d" && parts[i + 1]) {
          id = parts[i + 1];
          break;
        }
      }
    }
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  return s;
}

// ─── Cache simples em memória (TTL curto) ────────────────────────────────
type CacheEntry = { value: any; expires: number };
const _cache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 30_000; // 30s

export function invalidateCache(): void {
  _cache.clear();
}

function cacheGet(key: string): any | undefined {
  const hit = _cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    _cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key: string, value: any, ttl = DEFAULT_TTL): void {
  _cache.set(key, { value, expires: Date.now() + ttl });
}

// ─── Núcleo da API ───────────────────────────────────────────────────────
async function _call(params: Record<string, any>): Promise<any> {
  const gasUrl = import.meta.env.VITE_GAS_URL || "";
  const url = new URL(gasUrl);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) url.searchParams.append(key, String(val));
  });
  const res = await fetch(url.toString());
  return await res.json();
}

async function _post(params: Record<string, any>): Promise<any> {
  const gasUrl = import.meta.env.VITE_GAS_URL || "";
  const res = await fetch(gasUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(params),
  });
  return await res.json();
}

// ─── Objeto api público ──────────────────────────────────────────────────
export const api = {
  // Chamada genérica (mantida para compatibilidade)
  call: _call,

  // Listagens / leituras
  listarTodos: async (): Promise<Artist[]> => {
    const k = "listar_todos";
    const hit = cacheGet(k);
    if (hit) return hit;
    const r = await _call({ acao: "listar_todos" });
    if (Array.isArray(r)) cacheSet(k, r);
    return Array.isArray(r) ? r : [];
  },
  meusArtistas: async (tgId: string | number | undefined): Promise<Artist[]> => {
    if (!tgId) return [];
    const r = await _call({ acao: "meus_artistas", telegram_id: String(tgId) });
    return Array.isArray(r) ? r : [];
  },
  getArtistasSemId: async (): Promise<Artist[]> => {
    const r = await _call({ acao: "artistas_sem_id" });
    return Array.isArray(r) ? r : [];
  },
  ranking: async (): Promise<Artist[]> => {
    const r = await _call({ acao: "ranking" });
    return Array.isArray(r) ? r : [];
  },
  charts: async (): Promise<Artist[]> => {
    const r = await _call({ acao: "charts" });
    return Array.isArray(r) ? r : [];
  },
  topCharts: async (): Promise<Record<string, ChartData>> => {
    return await _call({ acao: "top_charts" });
  },
  radar: async (): Promise<RadarItem[]> => {
    const r = await _call({ acao: "radar" });
    return Array.isArray(r) ? r : [];
  },

  // Vinculação / criação de artistas
  vincularArtista: async (nome: string, tgId: string | number) => {
    invalidateCache();
    return await _call({ acao: "vincular_artista", nome, telegram_id: String(tgId) });
  },
  criarArtista: async (payload: Record<string, any>) => {
    invalidateCache();
    return await _post({ acao: "criar_artista", ...payload });
  },

  // Álbuns
  lancarAlbum: async (payload: AlbumPayload) => {
    invalidateCache();
    return await _post({ acao: "lancar_album", payload: JSON.stringify(payload) });
  },
  listarAlbuns: async (nome?: string): Promise<AlbumPayload[]> => {
    const r = await _call({ acao: "listar_albuns", nome: nome || "" });
    return Array.isArray(r) ? r : [];
  },
  getAlbum: async (id: string): Promise<AlbumPayload | null> => {
    return await _call({ acao: "get_album", id });
  },
  editarAlbum: async (payload: AlbumPayload) => {
    invalidateCache();
    return await _post({ acao: "editar_album", payload: JSON.stringify(payload) });
  },
  excluirAlbum: async (id: string, tgId?: string | number) => {
    invalidateCache();
    return await _call({ acao: "excluir_album", id, telegram_id: tgId ? String(tgId) : "" });
  },

  // Playlists
  listarPlaylists: async (tgId?: string | number): Promise<PlaylistPayload[]> => {
    const r = await _call({ acao: "listar_playlists", telegram_id: tgId ? String(tgId) : "" });
    return Array.isArray(r) ? r : [];
  },
  getPlaylist: async (id: string): Promise<PlaylistPayload | null> => {
    return await _call({ acao: "get_playlist", id });
  },
  salvarPlaylist: async (payload: PlaylistPayload, tgId?: string | number) => {
    invalidateCache();
    return await _post({ acao: "salvar_playlist", payload: JSON.stringify(payload), telegram_id: tgId ? String(tgId) : "" });
  },
  excluirPlaylist: async (id: string, tgId?: string | number) => {
    invalidateCache();
    return await _call({ acao: "excluir_playlist", id, telegram_id: tgId ? String(tgId) : "" });
  },

  // Catálogo de músicas
  listarFaixasCatalogo: async (): Promise<any[]> => {
    const r = await _call({ acao: "listar_faixas_catalogo" });
    return Array.isArray(r) ? r : [];
  },
  searchSongs: async (q: string): Promise<any[]> => {
    const r = await _call({ acao: "buscar_musicas", q });
    return Array.isArray(r) ? r : [];
  },

  // Market
  listarMarket: async (): Promise<MarketItem[]> => {
    const r = await _call({ acao: "listar_market" });
    return Array.isArray(r) ? r : [];
  },
  listarCategoriasMarket: async (): Promise<string[]> => {
    const r = await _call({ acao: "listar_categorias_market" });
    return Array.isArray(r) ? r : [];
  },
  comprarMarket: async (payload: Record<string, any>) => {
    invalidateCache();
    return await _post({ acao: "comprar_market", ...payload });
  },
  comprarImovel: async (payload: Record<string, any>) => {
    invalidateCache();
    return await _post({ acao: "comprar_imovel", ...payload });
  },
  comprarCinema: async (payload: Record<string, any>) => {
    invalidateCache();
    return await _post({ acao: "compra_cinema", ...payload });
  },
  meusBens: async (nome: string): Promise<BemItem[]> => {
    const r = await _call({ acao: "meus_bens", nome });
    return Array.isArray(r) ? r : [];
  },
  venderBem: async (payload: { nome: string; id: string }) => {
    invalidateCache();
    return await _post({ acao: "vender_bem", ...payload });
  },

  // Tours
  comprarTour: async (payload: Record<string, any>) => {
    invalidateCache();
    return await _post({ acao: "compra_unificada_tour", ...payload });
  },
  listTours: async (): Promise<any[]> => {
    const r = await _call({ acao: "listar_tours" });
    return Array.isArray(r) ? r : [];
  },
  getAgendaTour: async (nome: string): Promise<any> => {
    return await _call({ acao: "agenda_tour", nome });
  },
  vincularImagemTour: async (nome: string, url: string) => {
    invalidateCache();
    return await _call({ acao: "vincular_imagem_tour", nome, url });
  },

  // Projetos
  projetos: async (nome: string): Promise<Projeto[]> => {
    const r = await _call({ acao: "projetos", nome });
    return Array.isArray(r) ? r : [];
  },

  // Mural
  listarMural: async (): Promise<MuralItem[]> => {
    const r = await _call({ acao: "mural" });
    return Array.isArray(r) ? r : [];
  },
  comprarMural: async (payload: { nome: string; id: string }) => {
    invalidateCache();
    return await _post({ acao: "comprar_item", ...payload });
  },
  venderComposicao: async (payload: Record<string, any>) => {
    invalidateCache();
    return await _post({ acao: "vender_composicao", ...payload });
  },

  // Leilões
  listarLeiloes: async (): Promise<any[]> => {
    const r = await _call({ acao: "listar_leiloes" });
    return Array.isArray(r) ? r : [];
  },
  publicarLeilao: async (payload: Record<string, any>) => {
    invalidateCache();
    return await _post({ acao: "publicar_leilao", ...payload });
  },
  darLance: async (payload: Record<string, any>) => {
    return await _post({ acao: "lance_leilao", ...payload });
  },

  // Bet
  getMusicasBet: async (): Promise<any[]> => {
    const r = await _call({ acao: "musicas_bet" });
    return Array.isArray(r) ? r : [];
  },
  bet: async (payload: Record<string, any>) => {
    return await _post({ acao: "bet", ...payload });
  },

  // Ações diversas
  viral: async (artista: string, musica: string) => {
    return await _call({ acao: "viral", artista, musica });
  },
  filantropia: async (artista: string, causa: string, valor: number | string) => {
    return await _call({ acao: "filantropia", artista, causa, valor });
  },
  payola: async (payload: Record<string, any>) => {
    return await _post({ acao: "payola", ...payload });
  },
  rescisao: async (payload: Record<string, any>) => {
    return await _post({ acao: "rescisao", ...payload });
  },

  // Queridômetro
  getQueridometroStatus: async (tgId: string | number) => {
    return await _call({ acao: "queridometro_status", telegram_id: String(tgId) });
  },
  postQueridometroVoto: async (
    tgId: string | number,
    de: string,
    para: string,
    emoji: string
  ) => {
    return await _call({ acao: "queridometro_votar", telegram_id: String(tgId), de, para, emoji });
  },

  // Módulo PONTO
  getJogador: async (tgId: string) => {
    return await _call({ acao: "ponto_get_jogador", tgId });
  },
  distribuirPontosAleatorio: async (tgId: string) => {
    return await _call({ acao: "ponto_distribuir_aleatorio", tgId });
  },
};
