// Acesso ao Supabase via REST puro (sem o cliente JS).
// O cliente JS abre WebSocket no boot — mesmo com realtime desligado —
// e isso trava o WebView do Telegram. Por isso usamos apenas fetch nativo.

const SUPABASE_URL  =
  (import.meta.env.VITE_SUPABASE_URL  as string | undefined) ||
  "https://rcfzzhucvsqeqdlfoxmq.supabase.co";

const SUPABASE_ANON =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZnp6aHVjdnNxZXFkbGZveG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzg2MTQsImV4cCI6MjA5NTkxNDYxNH0.U9SL1CDN2jNpv2H0BSwP-lw2hA045cKtrPbccFWV1BQ";

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

// ─── Helper de timeout via AbortController (compatível com Telegram WebView) ─
// AbortSignal.timeout(...) trava o WebView do Telegram em alguns aparelhos.
// Usamos AbortController + setTimeout manual, que é universalmente suportado.
function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(timer) };
}

// ─── Buscar mensagens via fetch nativo (sem WebSocket) ───────────────────────
export async function fetchMensagens(
  streamId: string,
  limit = 60,
  afterId = 0
): Promise<MensagemDB[]> {
  const t = withTimeout(5000);
  try {
    let url = `${REST_BASE}/mensagens?select=*&stream_id=eq.${encodeURIComponent(streamId)}&order=id.asc&limit=${limit}`;
    if (afterId > 0) url += `&id=gt.${afterId}`;

    const res = await fetch(url, {
      method: "GET",
      headers: HEADERS,
      keepalive: false,
      signal: t.signal,
    });
    if (!res.ok) return [];
    return (await res.json()) as MensagemDB[];
  } catch {
    return [];
  } finally {
    t.cancel();
  }
}

// ─── Inserir mensagem via fetch nativo com abort em 3.5s ─────────────────────
export async function inserirMensagem(
  payload: Omit<MensagemDB, "id" | "created_at">
): Promise<MensagemDB | null | "rate_limited"> {
  const t = withTimeout(3500);
  try {
    const res = await fetch(`${REST_BASE}/mensagens`, {
      method:  "POST",
      headers: HEADERS,
      body:    JSON.stringify(payload),
      keepalive: false,
      signal:  t.signal,
    });

    if (res.status === 409 || res.status === 400) {
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
    return null;
  } finally {
    t.cancel();
  }
}

// ─── Ranking de participação (via RPC) ────────────────────────────────────────
export async function getRanking(streamId: string): Promise<RankingItem[]> {
  const t = withTimeout(5000);
  try {
    const res = await fetch(`${REST_BASE}/rpc/participacao_ranking`, {
      method:  "POST",
      headers: HEADERS,
      body:    JSON.stringify({ p_stream_id: streamId }),
      keepalive: false,
      signal:  t.signal,
    });
    if (!res.ok) return [];
    return (await res.json()) as RankingItem[];
  } catch {
    return [];
  } finally {
    t.cancel();
  }
}
