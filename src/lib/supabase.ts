import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  =
  (import.meta.env.VITE_SUPABASE_URL  as string | undefined) ||
  "https://rcfzzhucvsqeqdlfoxmq.supabase.co";

const SUPABASE_ANON =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZnp6aHVjdnNxZXFkbGZveG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzg2MTQsImV4cCI6MjA5NTkxNDYxNH0.U9SL1CDN2jNpv2H0BSwP-lw2hA045cKtrPbccFWV1BQ";

// Cliente único — sem Realtime habilitado para não abrir WebSocket persistente
// que causa crash na WebView do Telegram Mini App.
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

// ─── Buscar mensagens a partir de um ID (polling incremental) ────────────────
export async function fetchMensagens(
  streamId: string,
  limit = 60,
  afterId = 0
): Promise<MensagemDB[]> {
  let query = supabase
    .from("mensagens")
    .select("*")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (afterId > 0) {
    query = query.gt("id", afterId);
  }

  const { data, error } = await query;
  if (error) { console.error("[Supabase] fetchMensagens:", error.message); return []; }
  return data ?? [];
}

// ─── Inserir mensagem ─────────────────────────────────────────────────────────
export async function inserirMensagem(
  payload: Omit<MensagemDB, "id" | "created_at">
): Promise<MensagemDB | null> {
  const { data, error } = await supabase
    .from("mensagens")
    .insert(payload)
    .select()
    .single();

  if (error) { console.error("[Supabase] inserirMensagem:", error.message); return null; }
  return data;
}

// ─── Ranking de participação (via RPC) ────────────────────────────────────────
export async function getRanking(streamId: string): Promise<RankingItem[]> {
  const { data, error } = await supabase.rpc("participacao_ranking", {
    p_stream_id: streamId,
  });
  if (error) { console.error("[Supabase] getRanking:", error.message); return []; }
  return (data as RankingItem[]) ?? [];
}
