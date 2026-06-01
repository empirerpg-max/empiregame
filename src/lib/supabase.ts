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
    .order("created_at", { ascending: true })
    .limit(limit);

  if (afterId > 0) {
    query = query.gt("id", afterId);
  }

  const { data, error } = await query;
  if (error) { console.error("[Supabase] fetchMensagens:", error.message); return []; }
  return data ?? [];
}

// ─── Inserir mensagem com timeout de 4s ──────────────────────────────────────
// Timeout reduzido de 6s para 4s: o Telegram WebApp mostra o dialog
// "aguardar ou sair" após ~5s de fetch pendente, travando o app.
// Com 4s garantimos que o Promise.race resolve antes desse limiar.
// A mensagem otimista já está visível; o polling vai buscar a real em seguida.
export async function inserirMensagem(
  payload: Omit<MensagemDB, "id" | "created_at">
): Promise<MensagemDB | null> {
  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), 4000)
  );

  const insertPromise = supabase
    .from("mensagens")
    .insert(payload)
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) { console.error("[Supabase] inserirMensagem:", error.message); return null; }
      return data as MensagemDB;
    });

  return Promise.race([insertPromise, timeoutPromise]);
}

// ─── Ranking de participação (via RPC) ────────────────────────────────────────
export async function getRanking(streamId: string): Promise<RankingItem[]> {
  const { data, error } = await supabase.rpc("participacao_ranking", {
    p_stream_id: streamId,
  });
  if (error) { console.error("[Supabase] getRanking:", error.message); return []; }
  return (data as RankingItem[]) ?? [];
}
