import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// ─────────────────────────────────────────────────────────────────────────────
// PROXY PARA O GOOGLE APPS SCRIPT — substitua pela sua URL real antes do deploy
// ─────────────────────────────────────────────────────────────────────────────
const GAS_URL = 'COLE_AQUI_A_URL_DO_GAS';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function handleCatalogoApi(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Responde ao preflight CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── GET: repassa todos os query params para o GAS ──────────────────────────
  if (request.method === 'GET') {
    const gasTarget = `${GAS_URL}${url.search}`; // mantém ?action=... + outros params
    try {
      const gasRes = await fetch(gasTarget, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
      });
      const data = await gasRes.text();
      return new Response(data, {
        status: gasRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
      });
    } catch (err) {
      console.error('[Worker] Erro ao chamar GAS (GET):', err);
      return new Response(JSON.stringify({ error: 'Falha ao contatar o servidor de dados.' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // ── POST: repassa o body JSON para o GAS ───────────────────────────────────
  if (request.method === 'POST') {
    try {
      const body = await request.text();
      const gasRes = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        redirect: 'follow',
      });
      const data = await gasRes.text();
      return new Response(data, {
        status: gasRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
      });
    } catch (err) {
      console.error('[Worker] Erro ao chamar GAS (POST):', err);
      return new Response(JSON.stringify({ error: 'Falha ao salvar os dados.' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Método não suportado.', { status: 405, headers: CORS_HEADERS });
}

// ─────────────────────────────────────────────────────────────────────────────
// SSR handler (TanStack Start)
// ─────────────────────────────────────────────────────────────────────────────
type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import('@tanstack/react-start/server-entry').then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') return false;
  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(['message', 'status', 'unhandled']);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) return false;
  return (
    fields.unhandled === true &&
    fields.message === 'HTTPError' &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return response;
  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) return response;
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    // ── Intercepta /api/catalogo antes do SSR ──────────────────────────────
    if (url.pathname.startsWith('/api/catalogo')) {
      return handleCatalogoApi(request);
    }

    // ── Rota normal: SSR do TanStack Start ────────────────────────────────
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
