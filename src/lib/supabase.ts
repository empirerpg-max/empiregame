import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  =
  (import.meta.env.VITE_SUPABASE_URL  as string | undefined) ||
  "https://rcfzzhucvsqeqdlfoxmq.supabase.co";

const SUPABASE_ANON =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZnp6aHVjdnNxZXFkbGZveG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzg2MTQsImV4cCI6MjA5NTkxNDYxNH0.U9SL1CDN2jNpv2H0BSwP-lw2hA045cKtrPbccFWV1BQ";

// Cliente sem Realtime — WebSocket causa crash no Telegram Mini App WebView.
// O chat usa polling incremental (fetchMensagens com afterId) em vez de subscribe.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  realtime: { params: { eventsPerSecond: 0 } },
});

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
// Impede duplo-clique no botão de envio e protege contra spam.
// Complementa o trigger de rate limit do banco (1 msg/s por telegram_id).
const _lastSent: Record<string, number> = {};
export function podeSendMensagem(telegramId: string | number): boolean {
  const key   = String(telegramId);
  const agora = Date.now();
  if (_lastSent[key] && agora - _lastSent[key] < 1100) return false;
  _lastSent[key] = agora;
  return true;
}

// ─── Buscar mensagens (histórico ou incremental via afterId) ─────────────────
export async function fetchMensagens(
  streamId: string,
  limit = 60,
  afterId = 0
): Promise<MensagemDB[]> {
  let query = supabase
    .from("mensagens")
    .select("*")
    .eq("stream_id", streamId)
    .order("id", { ascending: true })   // ordena por id (usa o índice stream_id+id)
    .limit(limit);

  if (afterId > 0) {
    query = query.gt("id", afterId);
  }

  const { data, error } = await query;
  if (error) { console.error("[Supabase] fetchMensagens:", error.message); return []; }
  return data ?? [];
}

// ─── Inserir mensagem com abort em 3.5s ──────────────────────────────────────
// Usa AbortController para CANCELAR o fetch subjacente após 3.5s,
// impedindo que a promise continue rodando em background e atualize
// estado do React após o componente já ter recebido o "timeout" visual.
//
// Motivos do timeout de 3.5s:
//   - Telegram WebApp mostra "aguardar ou sair" após ~5s de fetch pendente.
//   - 3.5s garante resolução bem antes desse limiar.
//   - A mensagem otimista já está visível; o polling confirma a real em seguida.
//
// Retorna "rate_limited" se o banco rejeitar por spam (trigger trg_rate_limit).
export async function inserirMensagem(
  payload: Omit<MensagemDB, "id" | "created_at">
): Promise<MensagemDB | null | "rate_limited"> {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 3500);

  try {
    const { data, error } = await supabase
      .from("mensagens")
      .insert(payload)
      .select()
      .single()
      .abortSignal(controller.signal);

    clearTimeout(timeoutId);

    if (error) {
      if (error.code === "23514" || error.message?.includes("rate_limit")) {
        return "rate_limited";
      }
      console.error("[Supabase] inserirMensagem:", error.message);
      return null;
    }
    return data as MensagemDB;
  } catch {
    clearTimeout(timeoutId);
    return null; // abortado ou erro de rede
  }
}

// ─── Ranking de participação (via RPC) ────────────────────────────────────────
export async function getRanking(streamId: string): Promise<RankingItem[]> {
  const { data, error } = await supabase.rpc("participacao_ranking", {
    p_stream_id: streamId,
  });
  if (error) { console.error("[Supabase] getRanking:", error.message); return []; }
  return (data as RankingItem[]) ?? [];
}
