import {
  googleSheetsService,
  normalizeComparison,
  normalizeText,
} from "../services/googleSheetsService";

export interface TelegramVideoResult {
  file_id: string;
  file_unique_id?: string;
  duration: number;
  file_size: number;
  width?: number;
  height?: number;
}

export interface TelegramSendVideoResponse {
  ok: boolean;
  result?: {
    message_id: number;
    video?: TelegramVideoResult;
  };
  description?: string;
}

export interface TelegramGetFileResponse {
  ok: boolean;
  result?: {
    file_id: string;
    file_unique_id: string;
    file_size: number;
    file_path: string;
  };
  description?: string;
}

function readEnv(name: string): string {
  const processValue =
    typeof process !== "undefined" && process.env ? process.env[name] : undefined;
  if (typeof processValue === "string" && processValue.trim()) {
    return processValue;
  }

  const globalValue = (globalThis as Record<string, unknown>)[`__${name}__`];
  return typeof globalValue === "string" ? globalValue : "";
}

function getBotEnv() {
  const botApiBaseUrl = (readEnv("BOT_API_BASE_URL") || "http://localhost:8081").replace(
    /\/+$/,
    "",
  );
  const botToken = readEnv("BOT_TOKEN") || readEnv("VITE_TELEGRAM_BOT_TOKEN");
  const chatId = readEnv("TELEGRAM_CHAT_ID") || readEnv("VITE_TELEGRAM_CHAT_ID");

  return { botApiBaseUrl, botToken, chatId };
}

/**
 * Deriva a URL do legacy-telegram-proxy a partir de BOT_API_BASE_URL quando
 * LEGACY_TELEGRAM_PROXY_URL não está configurado: os dois serviços rodam na
 * mesma VPS, só em portas diferentes (bot-api local: 8082, proxy MTProto:
 * 8083) — evita depender de mais uma variável de ambiente manual.
 */
function deriveLegacyProxyUrlFromBotApi(botApiBaseUrl: string): string {
  try {
    const parsed = new URL(botApiBaseUrl);
    parsed.port = "8083";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function getLegacyTelegramEnv() {
  const { botApiBaseUrl } = getBotEnv();
  const proxyUrl = (
    readEnv("LEGACY_TELEGRAM_PROXY_URL") || deriveLegacyProxyUrlFromBotApi(botApiBaseUrl)
  ).replace(/\/+$/, "");
  // "emprevideos" é o @username público criado para o canal original
  // (-1002092995685), onde os ref_telegram_id/telegram_topic_id da planilha
  // realmente correspondem — os vídeos foram encaminhados depois para
  // @empireuploads só para gerar file_id, o que gera IDs de mensagem novos
  // e não bate com os números salvos na planilha.
  const channelId = readEnv("LEGACY_TELEGRAM_CHANNEL_ID") || "emprevideos";
  const botToken = readEnv("BOT_TOKEN") || readEnv("VITE_TELEGRAM_BOT_TOKEN");

  return { proxyUrl, channelId, botToken };
}

/**
 * Vídeos cadastrados antes da migração para a Bot API usam ID de mensagem
 * numérico puro (ex: "28"), formato do protocolo MTProto — incompatível com
 * o file_id opaco da Bot API. Esses vídeos são servidos por um serviço Node
 * standalone (legacy-telegram-proxy) que roda MTProto/GramJS de verdade,
 * fora do Cloudflare Workers (que não suporta socket TCP persistente).
 */
async function proxyLegacyTelegramVideo(
  messageId: string,
  request: Request,
): Promise<Response | null> {
  const { proxyUrl, channelId, botToken } = getLegacyTelegramEnv();

  if (!proxyUrl || !channelId || !botToken) {
    return null;
  }

  const postPath = `${channelId}/${messageId}`;
  const target = `${proxyUrl}/api/stream-telegram?postPath=${encodeURIComponent(postPath)}&botToken=${encodeURIComponent(botToken)}`;

  const proxyHeaders: Record<string, string> = {};
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    proxyHeaders["Range"] = rangeHeader;
  }

  const legacyRes = await fetch(target, { headers: proxyHeaders });

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", legacyRes.headers.get("content-type") || "video/mp4");
  responseHeaders.set("Accept-Ranges", "bytes");
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  if (legacyRes.headers.has("content-length")) {
    responseHeaders.set("Content-Length", legacyRes.headers.get("content-length")!);
  }
  if (legacyRes.headers.has("content-range")) {
    responseHeaders.set("Content-Range", legacyRes.headers.get("content-range")!);
  }

  return new Response(legacyRes.body, { status: legacyRes.status, headers: responseHeaders });
}

function getTodayBrDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

async function updatePontosForSong(songName: string): Promise<boolean> {
  if (!songName || !songName.trim()) return false;

  try {
    const rows = await googleSheetsService.registrosCharts.readValues("PONTOS", "A:Z");
    if (rows.length < 2) return false;

    const normalizedTarget = normalizeComparison(songName);

    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index] ?? [];
      const songTitleInSheet = normalizeComparison(row[3]); // Coluna D: Título / Nome da música

      if (songTitleInSheet && songTitleInSheet === normalizedTarget) {
        const rowNumber = index + 1;
        const todayStr = getTodayBrDate();

        // Coluna N (índice 13) = Marcação da caixinha; Coluna O (índice 14) = Data
        await googleSheetsService.registrosCharts.updateValues(
          "PONTOS",
          `N${rowNumber}:O${rowNumber}`,
          [["TRUE", todayStr]],
        );

        return true;
      }
    }
  } catch (error) {
    console.error("[mediaController] Erro ao atualizar aba PONTOS:", error);
  }

  return false;
}

function treatExternalUrl(url: string): { type: "youtube" | "drive" | "direct"; url: string } {
  const trimmed = url.trim();

  // YouTube check
  if (/youtube\.com|youtu\.be/i.test(trimmed)) {
    let videoId = "";
    if (trimmed.includes("youtu.be/")) {
      videoId = trimmed.split("youtu.be/")[1]?.split("?")[0] || "";
    } else if (trimmed.includes("v=")) {
      videoId = trimmed.split("v=")[1]?.split("&")[0] || "";
    } else if (trimmed.includes("embed/")) {
      videoId = trimmed.split("embed/")[1]?.split("?")[0] || "";
    }
    const embedUrl = videoId
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
      : trimmed;
    return { type: "youtube", url: embedUrl };
  }

  // Google Drive check
  if (/drive\.google\.com/i.test(trimmed)) {
    let fileId = "";
    const fileIdMatch =
      trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      fileId = fileIdMatch[1];
    }
    const directUrl = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : trimmed;
    return { type: "drive", url: directUrl };
  }

  return { type: "direct", url: trimmed };
}

export async function streamAudioController(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = normalizeText(
    url.searchParams.get("id") || url.searchParams.get("file_id") || url.pathname.split("/").pop(),
  );

  if (!id) {
    return new Response(JSON.stringify({ success: false, message: "ID de áudio não informado." }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const match = id.match(/[-\w]{25,}/);
  const fileId = match ? match[0] : id;
  const driveDownloadUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;

  try {
    const rangeHeader = request.headers.get("range");
    const proxyHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    if (rangeHeader) {
      proxyHeaders["Range"] = rangeHeader;
    }

    const driveRes = await fetch(driveDownloadUrl, { headers: proxyHeaders, redirect: "follow" });

    const contentType = driveRes.headers.get("content-type") || "";
    // Se a resposta for um stream de áudio ou binário válido
    if (driveRes.ok && !contentType.includes("text/html")) {
      const resHeaders = new Headers();
      resHeaders.set("Content-Type", contentType.includes("audio") ? contentType : "audio/mpeg");
      resHeaders.set("Access-Control-Allow-Origin", "*");
      resHeaders.set("Accept-Ranges", "bytes");

      if (driveRes.headers.has("content-length")) {
        resHeaders.set("Content-Length", driveRes.headers.get("content-length")!);
      }
      if (driveRes.headers.has("content-range")) {
        resHeaders.set("Content-Range", driveRes.headers.get("content-range")!);
      }

      return new Response(driveRes.body, {
        status: driveRes.status,
        headers: resHeaders,
      });
    }

    // Fallback para URL pública do Googleusercontent CDN
    const lh3Url = `https://lh3.googleusercontent.com/d/${fileId}`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: lh3Url,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[streamAudioController] Erro ao transmitir áudio:", err);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://lh3.googleusercontent.com/d/${fileId}`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

/**
 * POST /api/upload-video
 * Processa o upload de vídeo e envia em segundo plano para a Bot API local do Telegram
 * e atualiza a planilha do Google Sheets.
 */
export async function uploadVideoController(request: Request): Promise<Response> {
  const { botApiBaseUrl, botToken, chatId } = getBotEnv();

  if (!botToken || !chatId) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "O serviço de upload não está configurado no momento.",
      }),
      { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const titulo = normalizeText(formData.get("titulo"));
    const artista = normalizeText(formData.get("artista"));
    const tipoVideo = normalizeText(formData.get("tipo_video")) || "Music Video";
    const descricao = normalizeText(formData.get("descricao"));
    const idUsuario = normalizeText(formData.get("id_usuario"));
    const referenteMusica = normalizeText(formData.get("referente_musica"));

    if (!file || !(file instanceof Blob) || !titulo || !artista) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Preencha os campos obrigatórios (vídeo, título e artista).",
        }),
        { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } },
      );
    }

    // Prepara envio multipart/form-data para o Telegram Bot API local
    const tgFormData = new FormData();
    tgFormData.append("chat_id", chatId);
    tgFormData.append("video", file, (file as File).name || "video.mp4");

    const caption = `${titulo} - ${artista}${descricao ? `\n\n${descricao}` : ""}`;
    tgFormData.append("caption", caption);

    const tgEndpoint = `${botApiBaseUrl}/bot${botToken}/sendVideo`;

    const tgResponse = await fetch(tgEndpoint, {
      method: "POST",
      body: tgFormData,
    });

    const tgJson = (await tgResponse.json()) as TelegramSendVideoResponse;

    if (!tgResponse.ok || !tgJson.ok || !tgJson.result?.video) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Não foi possível enviar o vídeo no momento. Tente novamente.",
        }),
        { status: 502, headers: { "Content-Type": "application/json; charset=utf-8" } },
      );
    }

    const { video, message_id } = tgJson.result;
    const fileId = video.file_id;
    const duration = video.duration || 0;
    const fileSize = video.file_size || 0;

    // Determina qual aba registrar ("Music Videos" ou "Videos")
    const isMusicVideo =
      /music|clipe|clipe_musical|oficial/i.test(tipoVideo) ||
      tipoVideo === "Music Video" ||
      !!referenteMusica;
    const targetSheet = isMusicVideo ? "Music Videos" : "Videos";

    // Registra nova linha na planilha
    const newRow = [
      titulo,
      artista,
      tipoVideo,
      descricao,
      idUsuario,
      referenteMusica,
      fileId,
      duration,
      fileSize,
      "telegram",
      message_id,
      new Date().toISOString(),
    ];

    await googleSheetsService.principal.appendRow(targetSheet, newRow);

    if (referenteMusica) {
      await updatePontosForSong(referenteMusica);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Vídeo publicado com sucesso!",
      }),
      { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
  } catch (error) {
    console.error("[uploadVideo] Exceção durante upload de vídeo:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Ocorreu um erro ao publicar o vídeo.",
      }),
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
  }
}

/**
 * Tenta resolver e transmitir o vídeo assumindo que `id` já é um identificador direto
 * e válido (ID numérico de mensagem MTProto, telegram_file_id da Bot API, ou URL externa).
 * Retorna `null` quando o caminho direto não se aplica ou falha, para o chamador cair no
 * fallback de busca na planilha.
 */
async function tryDirectStream(id: string, request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const { botApiBaseUrl, botToken } = getBotEnv();

  // URL externa (Drive/YouTube/direta) já resolvida
  if (/^https?:\/\//i.test(id)) {
    const treated = treatExternalUrl(id);
    const acceptHeader = request.headers.get("accept") || "";
    if (acceptHeader.includes("application/json") || url.searchParams.has("json")) {
      return new Response(
        JSON.stringify({ success: true, type: treated.type, url: treated.url }),
        { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } },
      );
    }
    return new Response(null, {
      status: 302,
      headers: { Location: treated.url, "Access-Control-Allow-Origin": "*" },
    });
  }

  // ID numérico puro = mensagem do Telegram (via MTProto, canal legado)
  if (/^\d+$/.test(id)) {
    return proxyLegacyTelegramVideo(id, request);
  }

  // Caso contrário, tenta como telegram_file_id direto da Bot API
  if (!botToken) return null;

  try {
    const getFileUrl = `${botApiBaseUrl}/bot${botToken}/getFile?file_id=${encodeURIComponent(id)}`;
    const getFileRes = await fetch(getFileUrl);
    const getFileJson = (await getFileRes.json()) as TelegramGetFileResponse;

    if (!getFileRes.ok || !getFileJson.ok || !getFileJson.result?.file_path) {
      return null;
    }

    const rawFilePath = getFileJson.result.file_path;
    const rangeHeader = request.headers.get("range");
    const remoteFileUrl = rawFilePath.startsWith("http")
      ? rawFilePath
      : `${botApiBaseUrl}/file/bot${botToken}/${rawFilePath}`;

    const proxyHeaders: Record<string, string> = {};
    if (rangeHeader) {
      proxyHeaders["Range"] = rangeHeader;
    }

    const remoteRes = await fetch(remoteFileUrl, { headers: proxyHeaders });

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", remoteRes.headers.get("content-type") || "video/mp4");
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    if (remoteRes.headers.has("content-length")) {
      responseHeaders.set("Content-Length", remoteRes.headers.get("content-length")!);
    }
    if (remoteRes.headers.has("content-range")) {
      responseHeaders.set("Content-Range", remoteRes.headers.get("content-range")!);
    }

    return new Response(remoteRes.body, { status: remoteRes.status, headers: responseHeaders });
  } catch {
    return null;
  }
}

/**
 * GET /api/stream/:id
 * Realiza o streaming HTTP Range (206) direto para Telegram/Drive/YouTube a partir de um
 * identificador já resolvido, ou redireciona/retorna URL tratada para Drive/YouTube.
 */
export async function streamVideoController(
  request: Request,
  videoIdParam?: string,
): Promise<Response> {
  const url = new URL(request.url);
  const id = normalizeText(
    videoIdParam ||
      url.searchParams.get("id") ||
      url.searchParams.get("file_id") ||
      url.pathname.split("/").pop(),
  );

  if (!id) {
    return new Response(JSON.stringify({ success: false, message: "Vídeo não encontrado." }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const { botApiBaseUrl, botToken } = getBotEnv();

  try {
    // O `id` recebido aqui já vem resolvido pelo catálogo do Empire Play (a lista de
    // Music Videos/Videos já mapeia o telegram_topic_id numérico, o telegram_file_id
    // da Bot API, ou o link externo no momento do carregamento — ver toPlayableVideo em
    // EmpirePlayMenu.tsx). Por isso tentamos o caminho direto primeiro, sem reconsultar
    // a planilha em todo play: isso é o que fazia o vídeo demorar pra iniciar e travar.
    // A busca na planilha abaixo fica só como fallback pra casos legados (ex: título
    // salvo sem os campos resolvidos).
    const directResponse = await tryDirectStream(id, request);
    if (directResponse) {
      return directResponse;
    }

    let telegramFileId = id;
    let source = "telegram";
    let externalLink = "";

    // Fallback: consulta planilhas "Music Videos" e "Videos" para encontrar o registro
    const [musicVideos, videos] = await Promise.all([
      googleSheetsService.principal.readSheetObjects("Music Videos").catch(() => []),
      googleSheetsService.principal.readSheetObjects("Videos").catch(() => []),
    ]);

    const allVideos = [...musicVideos, ...videos];
    const found = allVideos.find((rec) => {
      const recId =
        rec.id || rec.telegram_topic_id || rec.id_do_topico || rec.titulo || rec.nome_do_video;
      const fileId =
        rec.telegram_file_id || rec.file_id || rec.link || rec.link_do_video || rec.video_url;
      return (
        normalizeComparison(recId) === normalizeComparison(id) ||
        normalizeComparison(fileId) === normalizeComparison(id) ||
        normalizeComparison(rec.titulo) === normalizeComparison(id)
      );
    });

    if (found) {
      source = normalizeComparison(found.arquivo_fonte || found.fonte || "");
      externalLink =
        found.link || found.link_do_video || found.video_url || found.youtube_url || "";

      if (found.telegram_file_id || found.file_id) {
        telegramFileId = found.telegram_file_id || found.file_id;
      } else if (externalLink) {
        if (/youtube\.com|youtu\.be/i.test(externalLink)) {
          source = "youtube";
        } else if (/drive\.google\.com/i.test(externalLink)) {
          source = "drive";
        }
      }
    }

    // Se for Drive / YouTube / URL externa
    if (
      source === "youtube" ||
      source === "drive" ||
      (externalLink && /^https?:\/\//i.test(externalLink) && !telegramFileId)
    ) {
      const treated = treatExternalUrl(externalLink || id);

      // Se o cliente solicita JSON (ex: chamada de API)
      const acceptHeader = request.headers.get("accept") || "";
      if (acceptHeader.includes("application/json") || url.searchParams.has("json")) {
        return new Response(
          JSON.stringify({
            success: true,
            type: treated.type,
            url: treated.url,
          }),
          { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } },
        );
      }

      // Redireciona HTTP 302 para a URL tratada (diretamente acessível pelo player de vídeo)
      return new Response(null, {
        status: 302,
        headers: {
          Location: treated.url,
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // ID numérico puro = mensagem do Telegram (via MTProto), não file_id da Bot API
    if (/^\d+$/.test(telegramFileId)) {
      const legacyResponse = await proxyLegacyTelegramVideo(telegramFileId, request);
      if (legacyResponse) {
        return legacyResponse;
      }
      return new Response(
        JSON.stringify({
          success: false,
          message: "Proxy de streaming MTProto não configurado (verifique BOT_TOKEN/BOT_API_BASE_URL).",
        }),
        { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } },
      );
    }

    // Caso contrário, tenta obter o arquivo via Telegram Bot API
    if (!botToken) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Serviço de streaming temporariamente indisponível.",
        }),
        { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } },
      );
    }

    const getFileUrl = `${botApiBaseUrl}/bot${botToken}/getFile?file_id=${encodeURIComponent(
      telegramFileId,
    )}`;
    const getFileRes = await fetch(getFileUrl);
    const getFileJson = (await getFileRes.json()) as TelegramGetFileResponse;

    if (!getFileRes.ok || !getFileJson.ok || !getFileJson.result?.file_path) {
      return new Response(
        JSON.stringify({ success: false, message: "Vídeo não encontrado no servidor de mídia." }),
        { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } },
      );
    }

    const rawFilePath = getFileJson.result.file_path;
    const rangeHeader = request.headers.get("range");

    // Stream remoto via Bot API (único caminho viável no runtime Cloudflare Workers,
    // que não possui sistema de arquivos persistente para servir os vídeos)
    const remoteFileUrl = rawFilePath.startsWith("http")
      ? rawFilePath
      : `${botApiBaseUrl}/file/bot${botToken}/${rawFilePath}`;

    const proxyHeaders: Record<string, string> = {};
    if (rangeHeader) {
      proxyHeaders["Range"] = rangeHeader;
    }

    const remoteRes = await fetch(remoteFileUrl, {
      headers: proxyHeaders,
    });

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", remoteRes.headers.get("content-type") || "video/mp4");
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    if (remoteRes.headers.has("content-length")) {
      responseHeaders.set("Content-Length", remoteRes.headers.get("content-length")!);
    }
    if (remoteRes.headers.has("content-range")) {
      responseHeaders.set("Content-Range", remoteRes.headers.get("content-range")!);
    }

    return new Response(remoteRes.body, {
      status: remoteRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[streamVideo] Exceção durante transmissão de vídeo:", error);
    const details = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, message: "Ocorreu um erro ao reproduzir o vídeo.", details }),
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
  }
}
