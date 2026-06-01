import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  =
  (import.meta.env.VITE_SUPABASE_URL  as string | undefined) ||
  "https://rcfzzhucvsqeqdlfoxmq.supabase.co";

const SUPABASE_ANON =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZnp6aHVjdnNxZXFkbGZveG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzg2MTQsImV4cCI6MjA5NTkxNDYxNH0.U9SL1CDN2jNpv2H0BSwP-lw2hA045cKtrPbccFWV1BQ";

// CRÍTICO: O Supabase JS v2 abre WebSocket mesmo com eventsPerSecond:0.
// No Telegram Mini App WebView, qualquer WebSocket pendente derruba o app.
// Solução: usar fetch nativo direto, sem o cliente JS do Supabase para mutações.
// O cliente Supabase é mantido APENAS para queries SELECT (sem realtime).
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  realtime: {
    params: { eventsPerSecond: 0 },
  },
  global: {
    // Força o uso do fetch nativo sem keepalive que pode pendurar no WebView
    fetch: (url, options) =>
      fetch(url, { ...options, keepalive: false }),
  },
});

// Desconecta qualquer WebSocket que o cliente possa ter aberto na inicialização
supabase.realtime.disconnect();

// ─── Constantes ───────────────────────────────────────────────────────────────
const REST_BASE = `${SUPABASE_URL}/rest/v1`;
const HEADERS   = {
  "Content-Type": "application/json",
  "apikey":       SUPABASE_ANON,
  "Authorization": `Bearer ${SUPABASE_ANON}`,
  "Prefer":       "return=representation",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface MensagemDB {
  id: number;
  created_at: string;
  stream_id: string;
  telegram_id: number;
  username: string | null;
  nome: string;
  texto: string;
  reply_to_id: number | null;
}

export interface RankingItem {
  telegram_id: number;
  nome: string;
  total_mensagens: number;
  porcentagem: number;
}

// ─── Rate limit client-side ──────────────────────────────────────────────────
const _lastSent: Record<string, number> = {};
export function podeSendMensagem(telegramId: string | number): boolean {
  const key   = String(telegramId);
  const agora = Date.now();
  if (_lastSent[key] && agora - _lastSent[key] < 1100) return false;
  _lastSent[key] = agora;
  return true;
}

// ─── Buscar mensagens via fetch nativo (sem WebSocket) ───────────────────────
export async function fetchMensagens(
  streamId: string,
  limit = 60,
  afterId = 0
): Promise<MensagemDB[]> {
  try {
    let url = `${REST_BASE}/mensagens?select=*&stream_id=eq.${encodeURIComponent(streamId)}&order=id.asc&limit=${limit}`;
    if (afterId > 0) url += `&id=gt.${afterId}`;

    const res = await fetch(url, {
      method: "GET",
      headers: HEADERS,
      keepalive: false,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return (await res.json()) as MensagemDB[];
  } catch {
    return [];
  }
}

// ─── Inserir mensagem via fetch nativo com abort em 3.5s ─────────────────────
// Usa fetch nativo puro — SEM o cliente Supabase JS — para garantir
// que nenhum WebSocket seja aberto ou mantido vivo durante o POST.
// O AbortSignal.timeout(3500) cancela o fetch se o Supabase demorar demais,
// evitando que o Telegram WebView exiba o diálogo "aguardar ou sair".
export async function inserirMensagem(
  payload: Omit<MensagemDB, "id" | "created_at">
): Promise<MensagemDB | null | "rate_limited"> {
  try {
    const res = await fetch(`${REST_BASE}/mensagens`, {
      method:  "POST",
      headers: HEADERS,
      body:    JSON.stringify(payload),
      keepalive: false,
      signal:  AbortSignal.timeout(3500),
    });

    if (res.status === 409 || res.status === 400) {
      // Pode ser rate_limit (trigger retorna 23514 → PostgREST retorna 400/409)
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      const msg  = String(body?.message || body?.details || "");
      if (msg.includes("rate_limit") || res.status === 409) return "rate_limited";
      console.error("[Supabase] inserirMensagem:", body);
      return null;
    }

    if (!res.ok) {
      console.error("[Supabase] inserirMensagem HTTP", res.status);
      return null;
    }

    const data = await res.json() as MensagemDB | MensagemDB[];
    return Array.isArray(data) ? (data[0] ?? null) : data;
  } catch {
    // AbortError (timeout 3.5s) ou erro de rede — retorna null silenciosamente
    return null;
  }
}

// ─── Ranking de participação (via RPC) ────────────────────────────────────────
export async function getRanking(streamId: string): Promise<RankingItem[]> {
  try {
    const res = await fetch(`${REST_BASE}/rpc/participacao_ranking`, {
      method:  "POST",
      headers: HEADERS,
      body:    JSON.stringify({ p_stream_id: streamId }),
      keepalive: false,
      signal:  AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return (await res.json()) as RankingItem[];
  } catch {
    return [];
  }
}
