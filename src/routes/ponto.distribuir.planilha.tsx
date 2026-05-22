import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronDown, ChevronUp, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";

export const Route = createFileRoute("/ponto/distribuir/planilha")({
  component: PontoPlanilha,
});

const OPCOES_PONTOS: Record<string, string[]> = {
  "BILLBOARD HOT 100": ["1,00%", "2,00%", "3,00%", "4,00%", "5,00%", "6,00%", "7,00%", "8,00%", "9,00%", "10,00%"],
  SPOTIFY: ["30,00%", "40,00%", "50,00%", "60,00%", "70,00%"],
  "APPLE MUSIC": ["30,00%", "40,00%", "50,00%", "60,00%", "70,00%"],
  YOUTUBE: [
    "10,00%",
    "15,00%",
    "20,00%",
    "25,00%",
    "30,00%",
    "35,00%",
    "40,00%",
    "45,00%",
    "50,00%",
    "55,00%",
    "60,00%",
    "65,00%",
    "70,00%",
  ],
  "DIGITAL SALES": [
    "10,00%",
    "15,00%",
    "20,00%",
    "25,00%",
    "30,00%",
    "35,00%",
    "40,00%",
    "45,00%",
    "50,00%",
    "55,00%",
    "60,00%",
    "65,00%",
    "70,00%",
  ],
  "BILLBOARD 200": [
    "10,00%",
    "15,00%",
    "20,00%",
    "25,00%",
    "30,00%",
    "35,00%",
    "40,00%",
    "45,00%",
    "50,00%",
    "55,00%",
    "60,00%",
    "65,00%",
    "70,00%",
  ],
};

type PontoRow = {
  linha: number;
  artista: string;
  musica: string;
  valores: Record<string, string>;
};

function PontoPlanilha() {
  const { user, ready } = useTelegramUser();
  const tgId = user?.id ? String(user.id) : localStorage.getItem("empire_tg_id") || "";

  const [rows, setRows] = useState<PontoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [artistaAberto, setArtistaAberto] = useState<string | null>(null);
  const [musicaAberta, setMusicaAberta] = useState<number | null>(null);
  const [colunaAberta, setColunaAberta] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!tgId) return;
    api
      .listarPontosJogador(tgId)
      .then((d: any) => {
        const lista: PontoRow[] = (d?.rows || d || []).map((r: any) => ({
          linha: r.linha || r.row,
          artista: r.artista || r.ARTISTA || "",
          musica: r.musica || r.MUSICA || "",
          valores: r.valores || {},
        }));
        setRows(lista);
      })
      .finally(() => setLoading(false));
  }, [tgId]);

  // Agrupa por artista
  const porArtista = rows.reduce<Record<string, PontoRow[]>>((acc, r) => {
    (acc[r.artista] = acc[r.artista] || []).push(r);
    return acc;
  }, {});

  async function salvarPonto(row: PontoRow, coluna: string, valor: string) {
    const key = `${row.linha}-${coluna}`;
    setSaving(key);
    setMsg(null);
    const d: any = await api.salvarCelulaPontos({ tgId, linha: row.linha, coluna, valor });
    setSaving(null);
    if (d?.ok || d?.message) {
      setSalvo((prev) => ({ ...prev, [key]: valor }));
      setMsg({ text: `✅ ${coluna} salvo!`, ok: true });
    } else {
      setMsg({ text: `❌ ${d?.erro || "Erro"}`, ok: false });
    }
  }

  if (!ready || loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );

  if (!user?.id)
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Abra o app pelo Telegram para acessar esta tela.
      </div>
    );

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <Link to="/ponto/distribuir" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </Link>

      <div>
        <h2 className="text-xl font-black italic tracking-tighter">Pontos · Manual</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Toque em um artista → música → categoria para distribuir pontos.
        </p>
      </div>

      {Object.keys(porArtista).length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma música encontrada.</p>
      )}

      {/* ── Accordion por Artista ── */}
      {Object.entries(porArtista).map(([artista, musicasArtista]) => {
        const artistaOpen = artistaAberto === artista;
        return (
          <div key={artista} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            {/* Cabeçalho do artista */}
            <button
              onClick={() => {
                setArtistaAberto(artistaOpen ? null : artista);
                setMusicaAberta(null);
                setMsg(null);
              }}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="font-bold text-sm">🎤 {artista}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{musicasArtista.length} música(s)</span>
                {artistaOpen ? (
                  <ChevronUp className="w-4 h-4 text-purple-300" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Músicas do artista */}
            {artistaOpen && (
              <div className="border-t border-white/5 flex flex-col gap-1 p-2 bg-black/10">
                {musicasArtista.map((row) => {
                  const musicaOpen = musicaAberta === row.linha;
                  return (
                    <div key={row.linha} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                      {/* Cabeçalho da música */}
                      <button
                        onClick={() => {
                          setMusicaAberta(musicaOpen ? null : row.linha);
                          setColunaAberta(null);
                          setMsg(null);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                      >
                        <span className="text-sm truncate">🎵 {row.musica}</span>
                        {musicaOpen ? (
                          <ChevronUp className="w-4 h-4 text-purple-300 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </button>

                      {/* Colunas de pontos */}
                      {musicaOpen && (
                        <div className="border-t border-white/5 p-2 flex flex-col gap-1.5 bg-black/20">
                          {Object.entries(OPCOES_PONTOS).map(([coluna, opcoes]) => {
                            const colKey = `${row.linha}-${coluna}`;
                            const colOpen = colunaAberta === colKey;
                            const salvoVal = salvo[colKey] || row.valores?.[coluna] || "";
                            const isSaving = saving === colKey;

                            return (
                              <div
                                key={coluna}
                                className="rounded-lg border border-white/10 bg-white/5 overflow-hidden"
                              >
                                {/* Cabeçalho da coluna */}
                                <button
                                  onClick={() => setColunaAberta(colOpen ? null : colKey)}
                                  className="w-full flex items-center justify-between px-3 py-2 text-left"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-gray-300">{coluna}</p>
                                    {salvoVal && (
                                      <p className="text-[11px] text-green-400 flex items-center gap-1 mt-0.5">
                                        <CheckCircle2 className="w-3 h-3" /> {salvoVal}
                                      </p>
                                    )}
                                  </div>
                                  {colOpen ? (
                                    <ChevronUp className="w-3 h-3 text-purple-300 shrink-0" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                                  )}
                                </button>

                                {/* Opções de ponto */}
                                {colOpen && (
                                  <div className="flex flex-wrap gap-1.5 p-2 border-t border-white/5">
                                    {opcoes.map((op) => {
                                      const sel = salvoVal === op;
                                      return (
                                        <button
                                          key={op}
                                          disabled={isSaving}
                                          onClick={() => salvarPonto(row, coluna, op)}
                                          className={`px-3 py-1.5 rounded-full text-xs border transition-all active:scale-95 ${
                                            sel
                                              ? "border-green-400 bg-green-900/40 text-green-300 font-semibold"
                                              : "border-white/10 bg-white/5 hover:bg-purple-800/40 hover:border-purple-400"
                                          }`}
                                        >
                                          {sel ? "✓ " : ""}
                                          {op}
                                        </button>
                                      );
                                    })}
                                    {isSaving && (
                                      <Loader2 className="w-3 h-3 animate-spin text-purple-400 self-center" />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {msg && musicaOpen && (
                            <p
                              className={`text-xs text-center font-semibold mt-1 ${msg.ok ? "text-green-400" : "text-red-400"}`}
                            >
                              {msg.text}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
