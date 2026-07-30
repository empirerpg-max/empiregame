import {
  ApiError,
  getCatalog,
  getRecentReleases,
  getTopPlaylists,
  getUserProfile,
} from "./catalog";

const API_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const EMPIRE_PLAY_API_PATHS = new Set([
  "/api/user/me",
  "/api/top-playlists",
  "/api/lancamentos",
  "/api/musicas",
  "/api/music-videos",
  "/api/videos",
  "/api/albuns",
]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...API_CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function resolveTelegramId(url: URL, request: Request): string {
  const fromQuery =
    url.searchParams.get("telegram_id") || url.searchParams.get("tgId");
  const fromHeader = request.headers.get("x-telegram-id");

  return String(fromQuery || fromHeader || "").trim();
}

export async function handleEmpirePlayApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  if (!EMPIRE_PLAY_API_PATHS.has(url.pathname)) {
    return null;
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: API_CORS_HEADERS });
  }

  if (request.method !== "GET") {
    return jsonResponse(
      {
        success: false,
        error: "Método não suportado. Use requisições GET.",
      },
      405,
    );
  }

  try {
    if (url.pathname === "/api/user/me") {
      const telegramId = resolveTelegramId(url, request);
      if (!telegramId) {
        throw new ApiError(
          400,
          "Informe o telegram_id via query string ou header x-telegram-id.",
        );
      }

      const data = await getUserProfile(telegramId);
      return jsonResponse({ success: true, data });
    }

    if (url.pathname === "/api/top-playlists") {
      const data = await getTopPlaylists();
      return jsonResponse({ success: true, data });
    }

    if (url.pathname === "/api/lancamentos") {
      const data = await getRecentReleases(30);
      return jsonResponse({ success: true, data, meta: { limit: 30 } });
    }

    if (url.pathname === "/api/musicas") {
      const data = await getCatalog("musicas", {
        artist: url.searchParams.get("artist") || undefined,
        month: url.searchParams.get("mes") || undefined,
        search: url.searchParams.get("q") || undefined,
      });
      return jsonResponse({ success: true, data, meta: { total: data.length } });
    }

    if (url.pathname === "/api/music-videos") {
      const data = await getCatalog("music-videos", {
        artist: url.searchParams.get("artist") || undefined,
        month: url.searchParams.get("mes") || undefined,
        search: url.searchParams.get("q") || undefined,
      });
      return jsonResponse({ success: true, data, meta: { total: data.length } });
    }

    if (url.pathname === "/api/videos") {
      const data = await getCatalog("videos", {
        artist: url.searchParams.get("artist") || undefined,
        month: url.searchParams.get("mes") || undefined,
        search: url.searchParams.get("q") || undefined,
      });
      return jsonResponse({ success: true, data, meta: { total: data.length } });
    }

    if (url.pathname === "/api/albuns") {
      const data = await getCatalog("albuns", {
        artist: url.searchParams.get("artist") || undefined,
        month: url.searchParams.get("mes") || undefined,
        search: url.searchParams.get("q") || undefined,
      });
      return jsonResponse({ success: true, data, meta: { total: data.length } });
    }

    return jsonResponse({ success: false, error: "Rota não encontrada." }, 404);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonResponse({ success: false, error: error.message }, error.status);
    }

    const message =
      error instanceof Error ? error.message : "Erro interno do servidor.";
    const status = /credenciais|token google/i.test(message) ? 503 : 500;
    return jsonResponse({ success: false, error: message }, status);
  }
}
