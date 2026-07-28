/**
 * types.video.ts
 * Interfaces unificadas para as duas abas de vídeo:
 *   - "Music Videos" (cabeçalhos originais em português/snake_case legado)
 *   - "Videos"       (cabeçalhos normalizados)
 *
 * Sempre use os campos do VideoItem normalizado no componente.
 * O helper `normalizeVideo()` faz o mapeamento e aplica os fallbacks.
 */

// ─────────────────────────────────────────────
// 1. RAW – exatamente como o backend pode enviar
// ─────────────────────────────────────────────

/** Aba "Music Videos" — chaves do Google Sheets sem tratamento */
export interface RawMusicVideo {
  "Data de lançamento"?: string;
  "ID do tópico"?: string;          // chave primária
  "ID do arquivo"?: string;         // telegram_file_id ou URL direta .mp4
  "Thumb (capa)"?: string;
  "ID do Criador"?: string;
  "Nome"?: string;                   // nome da obra
  "Nome do criador"?: string;        // artista
  "Tipo"?: string;
  // chaves alternativas que o Apps Script pode normalizar
  id_do_topico?: string;
  id_do_arquivo?: string;
  thumb?: string;
  id_do_criador?: string;
  nome?: string;
  nome_do_criador?: string;
  tipo?: string;
  data?: string;
}

/** Aba "Videos" — chaves já normalizadas pelo Apps Script */
export interface RawVideo {
  id?: string;
  telegram_topic_id?: string;        // chave primária (equivale a "ID do tópico")
  titulo?: string;                   // nome da obra
  artista?: string;                  // nome do criador
  tipo_video?: string;
  arquivo_fonte?: string;
  telegram_file_id?: string;         // URL .mp4 direta após migração
  drive_url?: string;
  youtube_url?: string;
  thumbnail_url?: string;            // capa/thumb
  enviado_por?: string;
  id_usuario?: string;               // id do criador
  // chaves alternativas do MV
  nome?: string;
  nome_do_criador?: string;
  capa?: string;
  id_do_criador?: string;
}

// ─────────────────────────────────────────────
// 2. NORMALIZADO – usado em todo o Frontend
// ─────────────────────────────────────────────

export interface VideoItem {
  /** Chave primária / tópico Telegram */
  id: string;
  /** Nome da obra (Music Video ou Vídeo) */
  nome: string;
  /** Artista / criador */
  nome_do_criador: string;
  /** URL da thumbnail/capa */
  capa: string;
  /** thumb alias (igual a capa, mantido por compatibilidade) */
  thumb: string;
  /** ID do usuário / criador */
  id_do_criador: string;
  /** Tipo: "Music Video", "Lyric", "Live", etc. */
  tipo: string;
  /** URL direta do arquivo .mp4 (Telegram CDN ou Drive) */
  arquivo_url: string;
  /** Data de lançamento (string livre) */
  data: string;
  /** Link do YouTube, se houver */
  youtube_url?: string;
  /** Origem do registro para debug */
  _source?: "music_videos" | "videos";
}

// ─────────────────────────────────────────────
// 3. NORMALIZER
// ─────────────────────────────────────────────

/**
 * Converte qualquer raw (Music Videos OU Videos) → VideoItem normalizado.
 * Aplica fallbacks duplos em todas as chaves ambíguas.
 */
export function normalizeVideo(raw: Record<string, unknown>): VideoItem {
  const r = raw as RawMusicVideo & RawVideo;

  // nome da obra
  const nome =
    String(r.nome || r.titulo || r["Nome"] || "").trim();

  // artista / criador
  const nome_do_criador =
    String(r.nome_do_criador || r.artista || r["Nome do criador"] || "").trim();

  // capa / thumbnail
  const capa =
    String(
      r.capa ||
      r.thumb ||
      r.thumbnail_url ||
      r["Thumb (capa)"] ||
      ""
    ).trim();

  // chave primária (tópico)
  const id =
    String(
      r.id ||
      r.telegram_topic_id ||
      r.id_do_topico ||
      r["ID do tópico"] ||
      Math.random().toString(36).slice(2)
    ).trim();

  // id do criador
  const id_do_criador =
    String(
      r.id_do_criador ||
      r.id_usuario ||
      r["ID do Criador"] ||
      ""
    ).trim();

  // tipo
  const tipo =
    String(r.tipo || r.tipo_video || r["Tipo"] || "").trim();

  // URL do arquivo
  const arquivo_url =
    String(
      r.telegram_file_id ||
      r.id_do_arquivo ||
      r.arquivo_fonte ||
      r.drive_url ||
      r["ID do arquivo"] ||
      ""
    ).trim();

  // data de lançamento
  const data =
    String(r.data || r["Data de lançamento"] || "").trim();

  const youtube_url = r.youtube_url ? String(r.youtube_url).trim() : undefined;

  // detecta origem
  const _source: VideoItem["_source"] =
    r.telegram_topic_id || r.titulo || r.artista ? "videos" : "music_videos";

  return {
    id,
    nome,
    nome_do_criador,
    capa,
    thumb: capa,
    id_do_criador,
    tipo,
    arquivo_url,
    data,
    youtube_url,
    _source,
  };
}

// ─────────────────────────────────────────────
// 4. PAYLOAD para Upload (POST → Apps Script)
// ─────────────────────────────────────────────

export interface VideoUploadPayload {
  acao: "upload_video";
  /** Telegram topic_id (string) */
  topico_id: string;
  /** Nome da obra */
  nome: string;
  /** Artista */
  nome_do_criador: string;
  /** ID Telegram do criador */
  id_do_criador: string;
  /** Tipo: "Music Video" | "Lyric" | "Live" | "Short" */
  tipo: string;
  /** URL pública da thumbnail */
  thumb_url?: string;
  /** Base64 do arquivo OU URL pública já existente */
  arquivo_base64?: string;
  arquivo_url_externa?: string;
  /** Nome original do arquivo (para extensão) */
  arquivo_nome?: string;
  /** Data ISO ou livre */
  data?: string;
}

export interface TopicoForum {
  id: string;           // telegram_topic_id
  titulo: string;
  criador: string;
  data: string;
  mensagens: MensagemForum[];
}

export interface MensagemForum {
  id: string;
  user: string;
  user_id: string;
  text: string;
  ts: number;
  reply_to?: { id: string; user: string; text: string };
}
