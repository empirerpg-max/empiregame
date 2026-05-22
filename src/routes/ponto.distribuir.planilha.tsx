import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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
  pontosDisponiveis: string;
  pontosUtilizados: string;
};

function PontoPlanilha() {
  const { user, ready } = useTelegramUser();
  const tgId = user?.id ? String(user.id) : localStorage.getItem("empire_tg_id") || "";

  const [rows, setRows] = useState<PontoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [musicaAberta, setMusicaAberta] = useState<number | null>(null);
  const [colunaAberta, setColunaAberta] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ key: string; text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!tgId) return;
    api
      .pontoListarPontos(tgId)
      .then((d: any) => {
        const linhas = d?.linhas || d?.rows || [];
        const lista: PontoRow[] = linhas.map((r: any) => ({
          linha: r.linha ?? r.row ?? 0,
          artista: r.artista || r.ARTISTA || "",
          musica: r.valores?.["MÚSICA"] || r.valores?.["MUSICA"] || "(Sem título)",
          valores: r.valores || {},
          pontosDisponiveis: r.valores?.["PONTOS DISPONÍVEIS"] || "0%",
          pontosUtilizados: r.valores?.["PONTOS UTILIZADOS"] || "0%",
        }));
        setRows(lista);
      })
      .finally(() => setLoading(false));
  }, [tgId]);

  async function salvarPonto(row: PontoRow, coluna: string, valor: string) {
    const key = `${row.linha}-${coluna}`;
    setSaving(key);
    setMsg(null);
    const d: any = await api.salvarCelulaPontos({ tgId, linha: row.linha, coluna, valor });
    setSaving(null);
    if (d?.ok || d?.message) {
      setSalvo((prev) => ({ ...prev, [key]: valor }));
      setMsg({ key, text: `✅ Salvo com sucesso!`, ok: true });
    } else {
      setMsg({ key, text: `❌ ${d?.erro || "Erro"}`, ok: false });
    }
  }

  if (!ready || loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 w-full max-w-md mx-auto relative z-10">
      <Link to="/ponto/distribuir" className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </Link>

      <div className="mb-2">
        <h2 className="text-2xl font-black italic tracking-tighter">Pontos · Manual</h2>
        <p className="text-sm text-muted-foreground mt-1">Gerencie a distribuição das suas músicas.</p>
      </div>

      {rows.length === 0 && (
        <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10">
          <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">Nenhuma música encontrada na aba PONTOS.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const musicaOpen = musicaAberta === row.linha;
          return (
            <div
              key={row.linha}
              className="rounded-2xl border border-white/10 bg-card overflow-hidden shadow-lg transition-all"
            >
              <button
                onClick={() => {
                  setMusicaAberta(musicaOpen ? null : row.linha);
                  setColunaAberta(null);
                  setMsg(null);
                }}
                className={`w-full px-4 py-4 text-left transition-colors ${musicaOpen ? "bg-primary/5" : "hover:bg-white/5"}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 pr-4">
                    <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">{row.artista}</p>
                    <h3 className="font-bold text-lg leading-tight">{row.musica}</h3>
                  </div>
                  {musicaOpen ? (
                    <ChevronUp className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                </div>

                <div className="flex gap-4 mt-3 pt-3 border-t border-white/5">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Disponível</p>
                    <p className="text-sm font-bold text-green-400">{row.pontosDisponiveis}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Utilizado</p>
                    <p className="text-sm font-bold text-yellow-400">{row.pontosUtilizados}</p>
                  </div>
                </div>
              </button>

              {musicaOpen && (
                <div className="bg-black/20 p-3 flex flex-col gap-2">
                  {Object.entries(OPCOES_PONTOS).map(([coluna, opcoes]) => {
                    const colKey = `${row.linha}-${coluna}`;
                    const colOpen = colunaAberta === colKey;
                    const salvoVal = salvo[colKey] || row.valores?.[coluna] || "";
                    const isSaving = saving === colKey;

                    return (
                      <div key={coluna} className="rounded-xl border border-white/5 bg-white/5 overflow-hidden">
                        <button
                          onClick={() => setColunaAberta(colOpen ? null : colKey)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
                        >
                          <div>
                            <p className="text-xs font-bold text-gray-300">{coluna}</p>
                            {salvoVal && (
                              <p className="text-[11px] text-primary flex items-center gap-1 mt-1">
                                <CheckCircle2 className="w-3 h-3" /> Atual: {salvoVal}
                              </p>
                            )}
                          </div>
                          {colOpen ? (
                            <ChevronUp className="w-4 h-4 text-primary" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>

                        {colOpen && (
                          <div className="p-3 pt-0 border-t border-white/5 mt-2">
                            <div className="flex flex-wrap gap-2 mt-3">
                              {opcoes.map((op) => {
                                const sel = salvoVal === op;
                                return (
                                  <button
                                    key={op}
                                    disabled={isSaving}
                                    onClick={() => salvarPonto(row, coluna, op)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all active:scale-95 ${
                                      sel
                                        ? "border-primary bg-primary/20 text-primary"
                                        : "border-white/10 bg-black/40 hover:border-primary/50 text-gray-300"
                                    }`}
                                  >
                                    {op}
                                  </button>
                                );
                              })}
                            </div>
                            {isSaving && (
                              <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                                <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
                              </div>
                            )}
                            {msg?.key === colKey && (
                              <p className={`mt-3 text-xs font-semibold ${msg.ok ? "text-green-400" : "text-red-400"}`}>
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
    </div>
  );
}
