import { useQueryClient } from "@tanstack/react-query";

const GAS_URL =
  import.meta.env.VITE_GAS_URL ||
  import.meta.env.VITE_APJ_URL ||
  "";

let _cache: Record<string, { ts: number; data: any }> = {};
const TTL = 60_000; // 1min

function invalidateCache() {
  _cache = {};
}

async function call(params: Record<string, any>): Promise<any> {
  const key = JSON.stringify(params);
  const now = Date.now();
  if (_cache[key] && now - _cache[key].ts < TTL) {
    return _cache[key].data;
  }
  const url = new URL(GAS_URL);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      url.searchParams.append(key, String(val));
    }
  });
  const res = await fetch(url.toString());
  const data = await res.json();
  _cache[key] = { ts: now, data };
  return data;
}

export type CommonResponse = {
  ok?: boolean;
  erro?: string;
};

export const api = {
  call,

  // === ARTISTAS ===
  async listarTodos() {
    return call({ acao: "listar_todos" });
  },

  async listarActs() {
    return call({ acao: "listar_acts" });
  },

  async artistasSemId() {
    return call({ acao: "artistas_sem_id" });
  },

  async meusArtistas(tgId: string) {
    return call({ acao: "meus_artistas", tgId });
  },

  async vincularArtista(nome: string, tgId: string) {
    invalidateCache();
    return call({ acao: "vincular_artista", nome, tgId });
  },

  async criarArtista(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "criar_artista", ...payload });
  },

  async ranking() {
    return call({ acao: "ranking" });
  },

  async charts() {
    return call({ acao: "charts" });
  },

  // === RADAR ===
  async radar() {
    return call({ acao: "radar" });
  },

  // === SOCIAL (posts, perfis, comentários, news) ===
  async listarPostsSocial() {
    return call({ acao: "listarPostsSocial" });
  },

  async listarPerfisSocial(tgId: string) {
    return call({ acao: "listarPerfisSocial", tgId });
  },

  async salvarPostSocial(payload: Record<string, any>, tgId: string) {
    invalidateCache();
    return call({ acao: "salvarPostSocial", payload: JSON.stringify(payload), tgId });
  },

  async salvarPerfilSocial(payload: Record<string, any>, tgId: string) {
    invalidateCache();
    return call({ acao: "salvarPerfilSocial", payload: JSON.stringify(payload), tgId });
  },

  async curtirPostSocial(postId: string, tgId: string) {
    invalidateCache();
    return call({ acao: "curtirPostSocial", postId, tgId });
  },

  async comentarPostSocial(payload: Record<string, any>, tgId: string) {
    invalidateCache();
    return call({ acao: "comentarPostSocial", payload: JSON.stringify(payload), tgId });
  },

  async listarComentariosSocial(postId: string) {
    return call({ acao: "listarComentariosSocial", postId });
  },

  async salvarNewsSocial(payload: Record<string, any>, tgId: string) {
    invalidateCache();
    return call({ acao: "salvarNewsSocial", payload: JSON.stringify(payload), tgId });
  },

  async listarNewsSocial() {
    return call({ acao: "listarNewsSocial" });
  },

  // === TOURS ===
  async listarTours() {
    return call({ acao: "listar_tours" });
  },

  async getAgendaTour(nome: string) {
    return call({ acao: "agenda_tour", nome });
  },

  async compraTour(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "compra_unificada_tour", ...payload });
  },

  async vincularImagemTour(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "vincular_imagem_tour", ...payload });
  },

  // === ALBUNS ===
  async lancarAlbum(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "lancar_album", payload: JSON.stringify(payload) });
  },

  async listarAlbuns(nome: string) {
    return call({ acao: "listar_albuns", nome });
  },

  async getAlbum(id: string) {
    return call({ acao: "get_album", id });
  },

  async editarAlbum(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "editar_album", payload: JSON.stringify(payload) });
  },

  async excluirAlbum(id: string, tgId: string) {
    invalidateCache();
    return call({ acao: "excluir_album", id, tgId });
  },

  // === PLAYLISTS ===
  async listarPlaylists(tgId: string) {
    return call({ acao: "listar_playlists", tgId });
  },

  async getPlaylist(id: string) {
    return call({ acao: "get_playlist", id });
  },

  async salvarPlaylist(payload: Record<string, any>, tgId: string) {
    invalidateCache();
    return call({ acao: "salvar_playlist", payload: JSON.stringify(payload), tgId });
  },

  async excluirPlaylist(id: string, tgId: string) {
    invalidateCache();
    return call({ acao: "excluir_playlist", id, tgId });
  },

  async listarFaixasCatalogo() {
    return call({ acao: "listar_faixas_catalogo" });
  },

  async buscarMusicas(q: string) {
    return call({ acao: "buscar_musicas", q });
  },

  // === MARKET ===
  async listarMarket() {
    return call({ acao: "listar_market" });
  },

  async listarCategoriasMarket() {
    return call({ acao: "listar_categorias_market" });
  },

  async comprarMarket(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "comprar_market", ...payload });
  },

  async venderBem(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "vender_bem", ...payload });
  },

  async meusBens(nome: string) {
    return call({ acao: "meus_bens", nome });
  },

  async comprarImovel(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "comprar_imovel", ...payload });
  },

  // === GAMES ===
  async syncGameCoins(tgId: string, wager: number, won: boolean, gameContext: string, artistName?: string) {
    invalidateCache();
    return call({ acao: "sync_game_coins", tgId, weger: String(wager), won: String(won), gameContext, artistName });
  },

  // === PETS ===
  async savePetState(tgId: string, payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "save_pet_state", tgId, payload: JSON.stringify(payload) });
  },

  async getPetState(tgId: string) {
    return call({ acao: "get_pet_state", tgId });
  },

  // === QUERIDÔMETRO ===
  async queridometroStatus(tgId: string) {
    return call({ acao: "queridometro_status", tgId });
  },

  async queridometroVotar(tgId: string, de: string, para: string, emoji: string) {
    invalidateCache();
    return call({ acao: "queridometro_votar", tgId, de, para, emoji });
  },

  // === PONTO ===
  async pontoGetJogador(tgId: string) {
    return call({ acao: "ponto_get_jogador", tgId });
  },

  async pontoListarPontos(tgId: string) {
    return call({ acao: "ponto_listar_pontos", tgId });
  },

  async pontoSalvarCelula(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "ponto_salvar_celula", ...payload });
  },

  async pontoDistribuirAleatorio(tgId: string) {
    invalidateCache();
    return call({ acao: "ponto_distribuir_aleatorio", tgId });
  },

  async pontoListarPlaylists(tgId: string) {
    return call({ acao: "ponto_listar_playlists", tgId });
  },

  async pontoSalvarPlaylistCelula(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "ponto_salvar_playlist_celula", ...payload });
  },

  async pontoDistribuirPlaylistsAuto(tgId: string) {
    invalidateCache();
    return call({ acao: "ponto_distribuir_playlists_auto", tgId });
  },

  // === PONTO ECOIN ===
  async listarMusicasEdicao(tgId: string): Promise<{
    musicas?: Array<{ linha: number; musica: string; artista: string }>;
    erro?: string;
  }> {
    return call({ acao: "ponto_listar_musicas_edicao", tgId });
  },

  // saldoEcoin lê direto da aba DADOS fixa (AC=artista, AI=saldo em tempo real)
  async saldoEcoin(tgId: string): Promise<{
    saldos?: Record<string, any>;
    erro?: string;
  }> {
    return call({ acao: "ponto_saldo_ecoin_dados", tgId });
  },

  async salvarPlaylistEcoin(p: {
    tgId: string;
    musica: string;
    artista: string;
    plataforma: string;
    playlist: string;
  }): Promise<CommonResponse & { saldo?: any; linha?: number }> {
    invalidateCache();
    return call({
      acao: "ponto_salvar_playlist_ecoin",
      tgId: p.tgId,
      musica: p.musica,
      artista: p.artista,
      plataforma: p.plataforma,
      playlist: p.playlist,
    });
  },

  // === APOSTAS (BET) ===
  async betApurar() {
    return call({ acao: "bet_apurar" });
  },

  // === OUTROS ===
  async compraCinema(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "compra_cinema", ...payload });
  },

  async viral(artista: string, musica: string) {
    invalidateCache();
    return call({ acao: "viral", artista, musica });
  },

  async payola(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "payola", ...payload });
  },

  async filantropia(artista: string, causa: string, valor: number) {
    invalidateCache();
    return call({ acao: "filantropia", artista, causa, valor: String(valor) });
  },

  async rescisao(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "rescisao", ...payload });
  },

  async publicarLeilao(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "publicar_leilao", ...payload });
  },

  async lanceLeilao(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "lance_leilao", ...payload });
  },

  async venderComposicao(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "vender_composicao", ...payload });
  },

  async comprarItemMural(payload: Record<string, any>) {
    invalidateCache();
    return call({ acao: "comprar_item", ...payload });
  },

  async listarMural() {
    return call({ acao: "mural" });
  },
};

// export queryClient para uso externo
export function useApiQueryClient() {
  return useQueryClient();
}
