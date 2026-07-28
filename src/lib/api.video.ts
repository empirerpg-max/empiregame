/**
 * api.video.ts
 * Camada de API para vídeos e fórum de tópicos.
 * O React NUNCA chama a API do Telegram diretamente.
 * Toda lógica de Telegram (upload, getFile, URL .mp4) é feita pelo Apps Script.
 */

import { SCRIPT_URL } from "./api";
import { normalizeVideo, VideoItem, VideoUploadPayload, TopicoForum, MensagemForum } from "./types.video";

// ─────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────

async function gasCall<T = unknown>(params: Record<string, unknown>): Promise<T> {
  const isLarge = JSON.stringify(params).length > 1200;
  const res = await fetch(
    isLarge ? SCRIPT_URL : `${SCRIPT_URL}?${new URLSearchParams(params as Record<string, string>)}&_t=${Date.now()}`,
    isLarge ? { method: "POST", body: JSON.stringify(params) } : { method: "GET" },
  );
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// ─────────────────────────────────────────────
// 1. LISTAGEM DE VÍDEOS
// ─────────────────────────────────────────────

/**
 * Busca as duas abas (Music Videos + Videos) e retorna lista unificada.
 * O Apps Script deve responder com { music_videos: [...], videos: [...] }
 * OU um array plano. Ambos são tratados aqui.
 */
export async function listarVideos(params: {
  tipo?: string;
  artista?: string;
  topico_id?: string;
} = {}): Promise<VideoItem[]> {
  const raw = await gasCall<unknown>({
    acao: "listar_videos",
    ...params,
  });

  // Resposta pode ser array plano ou objeto com chaves separadas
  if (Array.isArray(raw)) {
    return raw.map((r) => normalizeVideo(r as Record<string, unknown>));
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const mvs = Array.isArray(obj.music_videos)
      ? (obj.music_videos as Record<string, unknown>[]).map(normalizeVideo)
      : [];
    const vids = Array.isArray(obj.videos)
      ? (obj.videos as Record<string, unknown>[]).map(normalizeVideo)
      : [];
    return [...mvs, ...vids];
  }

  return [];
}

/**
 * Busca um vídeo específico pelo ID do tópico.
 */
export async function getVideo(topicoId: string): Promise<VideoItem | null> {
  const raw = await gasCall<unknown>({ acao: "get_video", topico_id: topicoId });
  if (!raw || (raw as Record<string, unknown>).erro) return null;
  return normalizeVideo(raw as Record<string, unknown>);
}

// ─────────────────────────────────────────────
// 2. UPLOAD DE VÍDEO → Apps Script → Telegram
// ─────────────────────────────────────────────

export interface UploadVideoOptions {
  /** ID do tópico Telegram onde o arquivo será enviado */
  topicoId: string;
  nome: string;
  nomeDoCriador: string;
  idDoCriador: string;
  tipo: string;
  thumbUrl?: string;
  data?: string;
  /** Arquivo selecionado pelo usuário no input file */
  arquivo?: File;
  /** URL externa já existente (Drive, link .mp4) */
  arquivoUrlExterna?: string;
}

export interface UploadVideoResult {
  ok: boolean;
  arquivo_url?: string;   // URL .mp4 gravada na planilha pelo Apps Script
  erro?: string;
  message?: string;
}

/**
 * Envia metadados + arquivo (como base64) para o Apps Script.
 * O Apps Script é responsável por:
 *   1. Reenviar o arquivo para o Bot do Telegram
 *   2. Chamar getFile para obter o file_path
 *   3. Montar https://api.telegram.org/file/bot<TOKEN>/<file_path>
 *   4. Salvar essa URL na planilha
 *   5. Retornar { ok: true, arquivo_url: "https://..." }
 */
export async function uploadVideo(opts: UploadVideoOptions): Promise<UploadVideoResult> {
  let arquivo_base64: string | undefined;
  let arquivo_nome: string | undefined;

  if (opts.arquivo) {
    arquivo_nome = opts.arquivo.name;
    arquivo_base64 = await fileToBase64(opts.arquivo);
  }

  const payload: VideoUploadPayload = {
    acao: "upload_video",
    topico_id: opts.topicoId,
    nome: opts.nome,
    nome_do_criador: opts.nomeDoCriador,
    id_do_criador: opts.idDoCriador,
    tipo: opts.tipo,
    thumb_url: opts.thumbUrl,
    arquivo_base64,
    arquivo_url_externa: opts.arquivoUrlExterna,
    arquivo_nome,
    data: opts.data || new Date().toISOString().split("T")[0],
  };

  try {
    const result = await gasCall<UploadVideoResult>(payload as unknown as Record<string, unknown>);
    return result;
  } catch (e: unknown) {
    return { ok: false, erro: String(e) };
  }
}

// ─────────────────────────────────────────────
// 3. FÓRUM / CHAT POR TÓPICO
// ─────────────────────────────────────────────

/**
 * Lista todos os tópicos do fórum (cada vídeo pode ter um tópico de chat).
 */
export async function listarTopicosForum(): Promise<TopicoForum[]> {
  const raw = await gasCall<unknown[]>({ acao: "listar_topicos_forum" });
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => {
    const x = t as Record<string, unknown>;
    return {
      id: String(x.id || x.topico_id || x.telegram_topic_id || ""),
      titulo: String(x.titulo || x.nome || ""),
      criador: String(x.criador || x.nome_do_criador || ""),
      data: String(x.data || ""),
      mensagens: [],
    } satisfies TopicoForum;
  });
}

/**
 * Carrega as mensagens de um tópico.
 */
export async function listarMensagensForum(topicoId: string): Promise<MensagemForum[]> {
  const raw = await gasCall<unknown[]>({
    acao: "listar_mensagens_forum",
    topico_id: topicoId,
  });
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const x = m as Record<string, unknown>;
    return {
      id: String(x.id || x.msg_id || Math.random().toString(36).slice(2)),
      user: String(x.user || x.nome || "Anônimo"),
      user_id: String(x.user_id || x.telegram_id || ""),
      text: String(x.text || x.mensagem || ""),
      ts: Number(x.ts || x.timestamp || Date.now()),
      reply_to: x.reply_to
        ? {
            id: String((x.reply_to as Record<string, unknown>).id || ""),
            user: String((x.reply_to as Record<string, unknown>).user || ""),
            text: String((x.reply_to as Record<string, unknown>).text || ""),
          }
        : undefined,
    } satisfies MensagemForum;
  });
}

export interface EnviarMensagemPayload {
  topicoId: string;
  user: string;
  userId: string;
  text: string;
  replyTo?: { id: string; user: string; text: string };
}

/**
 * Envia uma mensagem para o fórum de um tópico.
 * O Apps Script grava na planilha e opcionalmente encaminha ao grupo Telegram.
 */
export async function enviarMensagemForum(
  payload: EnviarMensagemPayload,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const result = await gasCall<{ ok: boolean; erro?: string }>({
      acao: "enviar_mensagem_forum",
      topico_id: payload.topicoId,
      user: payload.user,
      user_id: payload.userId,
      text: payload.text,
      reply_to: payload.replyTo ? JSON.stringify(payload.replyTo) : "",
      ts: Date.now(),
    });
    return result;
  } catch (e: unknown) {
    return { ok: false, erro: String(e) };
  }
}

// ─────────────────────────────────────────────
// utils
// ─────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove o prefixo "data:video/mp4;base64," → retorna só o base64 puro
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
