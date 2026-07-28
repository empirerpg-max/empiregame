// src/lib/playHelpers.ts
// Helpers com aliases corrigidos para as chaves snake_case do backend

import type { PlayItem, ForumComentario } from "@/types/play";
import {
  isTelegramFileId,
  telegramStreamUrl,
  extractDriveId as ctxExtractDriveId,
} from "@/lib/playContext";

// ─── norm / getField ────────────────────────────────────────────────────────
export function norm(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Busca um campo em um objeto com múltiplos aliases (case-insensitive, sem acento).
 * Inclui os nomes snake_case retornados pelo backend GAS.
 */
export function getField(item: Record<string, string>, ...aliases: string[]): string {
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

// ─── Resolvers de mídia ─────────────────────────────────────────────────────
export function extractDriveId(str: string): string | null {
  return ctxExtractDriveId(str);
}

export function resolveThumb(capa: string, size = 300): string {
  if (!capa) return "";
  if (isTelegramFileId(capa)) return telegramStreamUrl(capa);
  const id = extractDriveId(capa);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${size}`;
  return capa;
}

export function resolveMediaUrl(src: string): string {
  if (!src) return "";
  if (src.startsWith("http")) return src;
  if (isTelegramFileId(src)) return telegramStreamUrl(src);
  return src;
}

export function isTelegramSource(src: string): boolean {
  if (!src) return false;
  return src.includes("t.me/") || src.includes("telegram.me/") || src.includes("tg://");
}

// ─── Date helpers ───────────────────────────────────────────────────────────
export function parseDataLancamento(item: Record<string, string>): number {
  const raw = getField(
    item,
    "data_de_lancamento", "datadelancamento", "data_lancamento", "datalancamento",
    "Data de lançamento", "Data de lancamento",
    "data_upload", "dataupload", "data", "release_date", "releasedate",
  );
  if (!raw || raw.trim() === "") return 0;
  const s = raw.trim();
  const brDate = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brDate) {
    const iso = `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}`;
    const t = new Date(iso).getTime();
    return isNaN(t) ? 0 : t;
  }
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n < 1e12 ? n * 1000 : n;
  }
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

export function formatDate(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function formatRelativo(isoStr: string): string {
  if (!isoStr) return "";
  const ts = new Date(isoStr).getTime();
  if (isNaN(ts)) return isoStr;
  const diff = Date.now() - ts;
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `há ${Math.floor(diff / 86_400_000)}d`;
  return formatDate(ts);
}

// ─── Mappers com chaves snake_case do backend ───────────────────────────────

/**
 * Converte linha bruta de Músicas → PlayItem.
 * CORRIGIDO: aliases incluem nome_do_criador (chave real do backend).
 */
export function toPlayItemMusica(m: Record<string, string>): PlayItem {
  const idTopico = getField(m,
    "id_do_topico", "idtopico", "id_topico", "id",
    "ID do tópico", "ID do topico",
  );
  const titulo = getField(m,
    "nome_da_musica", "nomedamusica", "nome_musica", "nomemusica", "nome", "titulo", "title",
    "Nome da música", "Nome da musica", "Nome da Música", "track", "song",
  );
  // CORREÇÃO PRINCIPAL: nome_do_criador é a chave real do backend
  const artista = getField(m,
    "nome_do_criador",
    "nomedocriador",
    "act_principal", "actprincipal",
    "id_do_criador", "iddocriador",
    "artista", "artist", "autor",
    "ACT Principal", "ID do Criador", "Nome do Criador",
  );
  const capa = getField(m,
    "capa_da_musica", "capadamusica", "capa", "cover", "thumb", "thumbnail",
    "Capa da música", "Capa da musica", "Capa da Música",
  );
  const audioSrc = getField(m,
    "id_do_arquivo", "idarquivo", "id_arquivo", "arquivo",
    "link_do_audio", "linkdoaudio",
    "link", "url", "audio",
    "ID do arquivo", "ID do Arquivo", "Link do áudio", "Link do audio",
  );
  const letra = getField(m, "letra", "Letra", "LETRA", "lyrics", "Lyrics");
  return {
    id: idTopico || audioSrc || `musica-${titulo}`,
    titulo,
    artista,
    capa,
    audioSrc,
    letra,
    categoria: "musica",
  };
}

/**
 * Converte linha bruta de MusicVideos / Videos → PlayItem.
 * CORRIGIDO: nome_do_criador como chave prioritária para artista.
 */
export function toPlayItem(m: Record<string, string>, cat: PlayItem["categoria"]): PlayItem {
  const idTopico = getField(m,
    "id_do_topico", "idtopico", "id_topico", "id",
    "telegram_topic_id", "telegramtopicid",
    "ID do tópico", "ID do topico",
  );
  const titulo =
    cat === "musica"
      ? getField(m,
          "nome_da_musica", "nomedamusica", "nome_musica", "nome", "titulo", "title",
          "Nome da Música", "Nome da musica", "track", "song",
        )
      : getField(m,
          "titulo", "Titulo", "título", "Título", "title",
          "nome", "Nome",
          "tipo_de_clipe", "tipodeclipe", "tipo",
          "nome_do_clipe", "nomedoclipe",
          "Nome do Clipe", "Nome do Vídeo", "nomedovideo", "clipe", "video",
        );
  // CORREÇÃO PRINCIPAL: nome_do_criador é a chave real do backend
  const artista = getField(m,
    "nome_do_criador",
    "nomedocriador",
    "artista", "Artista", "artist",
    "act_principal", "actprincipal",
    "ACT Principal", "Act Principal", "Artista Principal",
    "id_do_criador", "iddocriador",
    "ID do criador", "Nome do criador", "Nome do Criador",
    "autor", "author",
  );
  const capa = getField(m,
    "thumbnail_url", "thumbnailurl", "thumbnail", "Thumb", "thumb",
    "capa_da_musica", "capadamusica", "capa", "cover",
    "Capa da Música", "Capa da musica",
  );
  const audioSrc = getField(m,
    "telegram_file_id", "telegramfileid",
    "id_do_arquivo", "idarquivo", "id_arquivo", "arquivo",
    "ID do Arquivo", "ID do arquivo",
    "drive_url", "driveurl",
    "youtube_url", "youtubeurl",
    "Link do áudio", "Link do audio", "linkdoaudio",
    "ID do vídeo", "ID do video", "idvideo", "id_video",
    "link_do_video", "linkdovideo", "Link do vídeo", "Link do video",
    "youtube_id", "youtubeid", "yt_id", "ytid",
    "Link", "link", "url", "URL",
    "audio", "Audio", "video", "Video", "src", "file",
  );
  const letra = getField(m, "letra", "Letra", "LETRA", "lyrics", "Lyrics");
  return {
    id: idTopico || audioSrc || `item-${titulo}`,
    titulo,
    artista,
    capa,
    audioSrc,
    letra,
    categoria: cat,
  };
}

/**
 * Normaliza comentário raw do fórum.
 * CORRIGIDO: usa as chaves id_do_topico, nome_do_jogador, comentario.
 */
export function normalizeComentario(c: Record<string, string>): ForumComentario {
  return {
    idTopico: getField(c, "id_do_topico", "idtopico", "id_topico", "idTopico", "id"),
    nome: getField(c,
      "nome_do_jogador",
      "nomedojogador",
      "autor", "author", "nome", "name",
    ) || "Anônimo",
    texto: getField(c,
      "comentario",
      "comentário",
      "texto", "text", "mensagem", "message",
    ),
    reacao: getField(c, "reacao", "reação", "emoji", "reaction") || undefined,
    timestamp: getField(c, "timestamp", "data", "criado_em", "created_at", "hora") || undefined,
  };
}
