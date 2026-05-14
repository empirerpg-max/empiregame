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
  artistas: string; // ex: "YAN feat. Matthew"
  duracao?: string; // "3:24"
  drive_url: string; // link público do Drive (mp3)
  letra?: string;
}

export interface AlbumPayload {
  id?: string;
  artista: string;
  titulo: string;
  genero: string;
  data: string; // YYYY-MM-DD
  capa_url: string; // link Drive da capa
  contracapa_url?: string;
  encarte: string[]; // links Drive (N imagens)
  faixas: AlbumFaixa[];
  descricao?: string;
  telegram_id?: string;
}

export interface MarketItem {
  categoria: string; // MARKET, IMOVEIS, CARREIRA, ...
  item: string; // "Mansao", "Convite Met Gala"...
  preco: number; // EC
  efeito: string; // descrição livre
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
  valor: number; // valor de compra ($)
  data: string; // ISO
  status?: string; // Ativo / Vendido
}

function qs(params: Record<string, string | number | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    u.set(k, String(v));
  }
  u.set("_t", String(Date.now()));
  return u.toString();
}

// --- Cache em memória com SWR (stale-while-revalidate) ---
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 30_000; // 30s
const inflight = new Map<string, Promise<unknown>>();

async function rawCall<T = unknown>(params: Record<string, unknown>): Promise<T> {
  const isPost = params.payload || JSON.stringify(params).length > 1000;
  
  const options: RequestInit = {
    method: isPost ? "POST" : "GET",
  };

  if (isPost) {
    options.body = JSON.stringify(params);
    // Nota: Nao definimos Content-Type como application/json porque Apps Script 
    // lida melhor com text/plain no doPost se nao houver complexidade de pre-flight.
    // Mas o JSON.parse(e.postData.contents) no backend espera esse formato.
  }

  const url = isPost ? SCRIPT_URL : `${SCRIPT_URL}?${qs(params)}`;
  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

async function call<T = unknown>(
  params: Record<string, unknown>,
  opts: { cache?: boolean } = {},
): Promise<T> {
  if (!opts.cache) return rawCall<T>(params);
  const key = JSON.stringify(params);
  const hit = cache.get(key);
  const fresh = hit && Date.now() - hit.ts < CACHE_TTL;
  if (fresh) return hit.data as T;
  if (inflight.has(key)) return inflight.get(key)! as Promise<T>;
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

  // Ações
  async comprarTour(p: {
    nome: string;
    tipo: string;
    titulo: string;
    dataInicio: string;
    qtd: number;
    continente: string;
  }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({
      acao: "compra_unificada_tour",
      nome: p.nome,
      tipo: p.tipo,
      titulo: p.titulo,
      dataInicio: p.dataInicio,
      qtd: p.qtd,
      continente: p.continente,
    });
  },
  async comprarCinema(p: {
    nome: string;
    titulo: string;
    tipo: string;
    genero: string;
    dataInicio: string;
  }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "compra_cinema", ...p });
  },
  async viral(nome: string, musica: string): Promise<CommonResponse> {
    return call<CommonResponse>({ acao: "viral", artista: nome, musica });
  },
  async filantropia(nome: string, causa: string, valor: string): Promise<CommonResponse> {
    return call<CommonResponse>({ acao: "filantropia", artista: nome, causa, valor });
  },

  // ---- Mais ações ----
  async publicarLeilao(p: {
    nome: string;
    descricao: string;
    lanceMini: number;
  }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "publicar_leilao", ...p });
  },
  async darLance(p: {
    nome: string;
    itemId: string | number;
    valor: number;
  }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "lance_leilao", ...p });
  },
  async listarLeiloes(): Promise<unknown[]> {
    const r = await call<unknown[]>({ acao: "leilao" }, { cache: true });
    return Array.isArray(r) ? r : [];
  },
  async payola(p: { nome: string; musica: string; valor: number }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "payola", ...p });
  },
  async rescisao(p: { nome: string; destino: string }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "rescisao", ...p });
  },
  async venderComposicao(p: {
    nome: string;
    titulo: string;
    preco: number;
  }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "vender_composicao", ...p });
  },
  async comprarImovel(p: { nome: string; tipo: string; cidade: string }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "comprar_imovel", ...p });
  },

  // ---- Empire Market ----
  async listarMarket(): Promise<MarketItem[]> {
    const r = await call<Record<string, unknown>[]>({ acao: "listar_market" }, { cache: true });
    return Array.isArray(r)
      ? r.map((x) => ({
          categoria: String(x.categoria || ""),
          item: String(x.item || ""),
          preco: Number(x.preco || 0),
          efeito: String(x.efeito || ""),
        }))
      : [];
  },
  async listarMural(): Promise<MuralItem[]> {
    const r = await call<MuralItem[]>({ acao: "mural" }, { cache: true });
    return Array.isArray(r) ? r : [];
  },
  async comprarMarket(p: {
    nome: string;
    categoria: string;
    item: string;
  }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({
      acao: "comprar_market",
      nome: p.nome,
      categoria: p.categoria,
      item: p.item,
    });
  },
  async comprarMural(p: { nome: string; id: string }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "comprar_item", nome: p.nome, id: p.id });
  },
  async meusBens(nome: string): Promise<BemItem[]> {
    const r = await call<BemItem[]>({ acao: "meus_bens", nome }, { cache: true });
    return Array.isArray(r) ? r : [];
  },
  async venderBem(p: { nome: string; id: string }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "vender_bem", nome: p.nome, id: p.id });
  },

  // ---- Álbuns (novos endpoints — código pra colar no Apps Script) ----
  async lancarAlbum(payload: AlbumPayload): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "lancar_album", payload: JSON.stringify(payload) });
  },
  async getAlbum(id: string): Promise<AlbumPayload | null> {
    const r = await call<AlbumPayload & { error?: string }>(
      { acao: "get_album", id },
      { cache: true },
    );
    if (!r || r.error) return null;
    return r;
  },
  async listarAlbuns(nome?: string): Promise<AlbumPayload[]> {
    const r = await call<AlbumPayload[]>(
      { acao: "listar_albuns", nome: nome || "" },
      { cache: true },
    );
    return Array.isArray(r) ? r : [];
  },
  async editarAlbum(payload: AlbumPayload): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "editar_album", payload: JSON.stringify(payload) });
  },
  async editarFaixaAlbum(payload: { album_id: string; numero: number; [key: string]: any }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "editar_faixa_album", payload: JSON.stringify(payload) });
  },
  async excluirAlbum(id: string, telegramId?: string): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "excluir_album", id, telegram_id: telegramId || "" });
  },

  // ---- Playlists ----
  async listarPlaylists(telegramId?: string): Promise<PlaylistPayload[]> {
    const r = await call<PlaylistPayload[]>(
      { acao: "listar_playlists", telegram_id: telegramId || "" },
      { cache: true },
    );
    return Array.isArray(r) ? r : [];
  },
  async getPlaylist(id: string): Promise<PlaylistPayload | null> {
    const r = await call<PlaylistPayload & { error?: string }>(
      { acao: "get_playlist", id },
      { cache: true },
    );
    if (!r || r.error) return null;
    return r;
  },
  async salvarPlaylist(payload: PlaylistPayload, telegramId?: string): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ 
      acao: "salvar_playlist", 
      payload: JSON.stringify(payload),
      telegram_id: telegramId || payload.telegram_id || "" 
    });
  },
  async listarFaixasCatalogo(): Promise<any[]> {
    const r = await call<any[]>({ acao: "listar_faixas_catalogo" }, { cache: true });
    return Array.isArray(r) ? r : [];
  },
  async excluirPlaylist(id: string, telegramId?: string): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "excluir_playlist", id, telegram_id: telegramId || "" });
  },

  // ---- Duelo & Bet (Simulação — requer endpoints backend) ----
  async getMusicasBet(): Promise<{ semana: string; musicas: unknown[] } | null> {
    const acoes = ["musicas_bet", "get_musicas_bet", "musicas_charts", "get_musicas_charts"];
    for (const acao of acoes) {
      const r = await call<{ semana: string; musicas: unknown[]; erro?: string }>(
        { acao },
        { cache: true },
      );
      if (r && !r.erro && Array.isArray(r.musicas) && r.musicas.length > 0) {
        return r;
      }
    }
    return null;
  },
  async bet(p: {
    nome: string;
    valor: number;
    semana: string;
    previsoes: string;
  }): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "bet", ...p });
  },
  async listTours(): Promise<any[]> {
    const acoes = ["listar_todas_tours", "tours", "controle_tours", "listar_tours"];
    for (const acao of acoes) {
      const r = await call<any[]>({ acao }, { cache: true });
      if (Array.isArray(r) && r.length > 0) return r;
    }
    return [];
  },
  async ranking(): Promise<Artist[]> {
    const data = await call<Record<string, unknown>[]>({ acao: "ranking" }, { cache: true });
    return Array.isArray(data) ? data.map((a) => normalizeArtist(a)) : [];
  },
  async charts(): Promise<Artist[]> {
    const data = await call<Record<string, unknown>[]>({ acao: "charts" }, { cache: true });
    return Array.isArray(data) ? data.map((a) => normalizeArtist(a)) : [];
  },
  async getAgendaTour(nome: string): Promise<any> {
    return call<any>({ acao: "agenda_tour", nome }, { cache: true });
  },
  async vincularImagemTour(nome: string, url: string): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "vincular_imagem_tour", nome, url });
  },
  async searchSongs(query: string): Promise<any[]> {
    const r = await call<any[]>({ acao: "buscar_musicas", q: query }, { cache: true });
    return Array.isArray(r) ? r : [];
  },
  async getArtistasSemId(): Promise<Artist[]> {
    const data = await call<Record<string, unknown>[]>({ acao: "artistas_sem_id" }, { cache: true });
    return Array.isArray(data) ? data.map((a) => normalizeArtist(a)) : [];
  },
  async vincularArtista(nome: string, telegramId: string): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "vincular_artista", nome, telegram_id: telegramId });
  },
  async topCharts(): Promise<Record<string, ChartData>> {
    const data = await call<Record<string, ChartData>>({ acao: "top_charts" }, { cache: true });
    return data || {};
  },
  
  // ---- Social ----
  async listarPostsSocial(): Promise<any[]> {
    const r = await call<any[]>({ acao: "listarPostsSocial" }, { cache: false });
    return Array.isArray(r) ? r : [];
  },
  async salvarPostSocial(payload: any, tgId: string): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "salvarPostSocial", payload: JSON.stringify(payload), tgId });
  },
  async listarPerfisSocial(tgId?: string): Promise<any[]> {
    const r = await call<any[]>({ acao: "listarPerfisSocial", tgId }, { cache: false });
    return Array.isArray(r) ? r : [];
  },
  async salvarPerfilSocial(payload: any, tgId: string): Promise<CommonResponse> {
    invalidateCache();
    return call<CommonResponse>({ acao: "salvarPerfilSocial", payload: JSON.stringify(payload), tgId });
  },
  async curtirPostSocial(postId: string, tgId: string): Promise<any> {
    return call<any>({ acao: "curtirPostSocial", postId, tgId });
  },
  async comentarPostSocial(payload: any, tgId: string): Promise<any> {
    return call<any>({ acao: "comentarPostSocial", payload: JSON.stringify(payload), tgId });
  },
  async listarComentariosSocial(postId: string): Promise<any[]> {
    const r = await call<any[]>({ acao: "listarComentariosSocial", postId }, { cache: false });
    return Array.isArray(r) ? r : [];
  },
  async salvarNewsSocial(payload: any, tgId: string): Promise<any> {
    return call<any>({ acao: "salvarNewsSocial", payload: JSON.stringify(payload), tgId });
  },
  async listarNewsSocial(): Promise<any[]> {
    const r = await call<any[]>({ acao: "listarNewsSocial" }, { cache: false });
    return Array.isArray(r) ? r : [];
  },

  // ---- Games & Economy ----
  async syncGameCoins(tgId: string, wager: number, won: number, gameContext?: string, artistName?: string): Promise<CommonResponse & { novoSaldo?: number }> {
    invalidateCache();
    return call<CommonResponse & { novoSaldo?: number }>({ 
      acao: "sync_game_coins", 
      telegram_id: tgId, 
      wager, 
      won,
      gameContext,
      artistName
    });
  },
  async savePetState(tgId: string, payload: string): Promise<CommonResponse> {
    return call<CommonResponse>({ 
      acao: "save_pet_state", 
      telegram_id: tgId, 
      payload 
    });
  },
  async getPetState(tgId: string): Promise<CommonResponse & { payload?: string; lastUpdate?: number }> {
    return call<CommonResponse & { payload?: string; lastUpdate?: number }>({ 
      acao: "get_pet_state", 
      telegram_id: tgId 
    });
  },

  // ---- Queridômetro ----
  async getQueridometroStatus(tgId: string): Promise<CommonResponse & { 
    meuPerfil?: any, 
    artistas?: any[], 
    votosRestantes?: number,
    reacoesRecebidas?: any[],
    configEmojis?: any[],
    semana?: string
  }> {
    return call({ acao: "queridometro_status", tgId });
  },
  async postQueridometroVoto(tgId: string, de: string, para: string, emoji: string): Promise<CommonResponse & { msg?: string }> {
    return call({ acao: "queridometro_votar", tgId, de, para, emoji });
  },
};

export interface ChartData {
  musica: string;
  artista: string;
  foto: string;
  data: string;
  url: string;
  erro?: string;
}

export interface PlaylistTrack {
  album_id: string;
  faixa_numero: number;
  titulo: string;
  artistas: string;
  drive_url: string;
  capa_url?: string;
  duracao?: string;
}
export interface PlaylistPayload {
  id?: string;
  titulo: string;
  descricao?: string;
  capa_url?: string;
  owner: string; // nome do criador (artista ou user)
  telegram_id?: string;
  tracks: PlaylistTrack[];
  data?: string;
}

export function fmtEC(n: number) {
  return `E$C ${(n || 0).toLocaleString("pt-BR")}`;
}
export function fmtMoney(n: number) {
  return `$${(n || 0).toLocaleString("pt-BR")}`;
}

// Converte link do Drive em URL de imagem visualizável.
// O endpoint `uc?export=view` não funciona mais (bloqueio CORS desde 2024).
// Usamos o thumbnail endpoint, que serve direto e aceita parâmetro de tamanho.
export function driveImg(url: string | undefined | null, size: number = 400): string | undefined {
  if (!url) return undefined;
  
  // Se for link do lh3 e não tiver parâmetro de redimensionamento, adiciona
  if (url.includes("lh3.googleusercontent.com")) {
    if (!url.includes("=")) {
      return `${url}=w${size}-h${size}-p`;
    }
    return url;
  }

  const m = String(url).match(/[-\w]{25,}/);
  if (!m) return url;
  return `https://lh3.googleusercontent.com/d/${m[0]}=w${size}-h${size}-p`;
}

// Para áudio: extrai ID e retorna URL do player do Drive (iframe-able).
export function driveAudioSrc(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  const m = String(url).match(/[-\w]{25,}/);
  if (!m) return undefined;
  return `https://drive.google.com/file/d/${m[0]}/preview`;
}

// Tenta gerar URL direto do mp3 (pode não funcionar para todos os arquivos).
export function driveDirectAudio(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  const m = String(url).match(/[-\w]{25,}/);
  if (!m) return undefined;
  return `https://drive.google.com/uc?export=download&id=${m[0]}`;
}
