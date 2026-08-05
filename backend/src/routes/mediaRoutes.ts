import {
  streamAudioController,
  streamVideoController,
  uploadVideoController,
} from "../controllers/mediaController";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Range, x-telegram-id",
};

export async function handleMediaRoutes(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  const isUploadRoute = pathname === "/api/upload-video";
  const isStreamRoute = pathname === "/api/stream" || pathname.startsWith("/api/stream/");
  const isAudioRoute = pathname === "/api/media/audio" || pathname.startsWith("/api/media/audio");

  if (!isUploadRoute && !isStreamRoute && !isAudioRoute) {
    return null;
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  let response: Response;

  if (isAudioRoute) {
    response = await streamAudioController(request);
  } else if (isUploadRoute) {
    if (request.method !== "POST") {
      response = new Response(
        JSON.stringify({
          success: false,
          error: "Método HTTP não suportado. Use POST para upload.",
        }),
        { status: 405, headers: { "Content-Type": "application/json" } },
      );
    } else {
      response = await uploadVideoController(request);
    }
  } else if (isStreamRoute) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response = new Response(
        JSON.stringify({
          success: false,
          error: "Método HTTP não suportado. Use GET para streaming.",
        }),
        { status: 405, headers: { "Content-Type": "application/json" } },
      );
    } else {
      const pathParts = pathname.split("/").filter(Boolean);
      // ex: ["api", "stream", "123"] -> "123"
      const videoIdParam = pathParts.length >= 3 ? pathParts[2] : undefined;
      response = await streamVideoController(request, videoIdParam);
    }
  } else {
    return null;
  }

  // Anexa cabeçalhos CORS
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, val]) => {
    headers.set(key, val);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
