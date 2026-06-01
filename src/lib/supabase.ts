import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn("[Supabase] Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

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

// ─── Buscar histórico inicial ─────────────────────────────────────────────────
export async function fetchMensagens(streamId: string, limit = 60): Promise<MensagemDB[]> {
  const { data, error } = await supabase
    .from("mensagens")
    .select("*")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: true })
    .limit(limit);

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
