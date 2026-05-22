import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronDown, ChevronUp, Loader2, Coins, RefreshCw, Send, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";

export const Route = createFileRoute("/ponto/playlists/planilha")({
  component: PontoPlaylistsPlanilha,
});

const PLAYLISTS: Record<string, string[]> = {
  SPOTIFY: [
    "TOPO TODAY'S TOP HITS",
    "TODAY'S TOP HITS",
    "POP UP",
    "ROCK SOLID",
    "RAP CAVIAR",
    "MINT",
    "ARE & BE",
    "VIVA LATINO",
    "ALTERNATIVE PARTY",
    "JUST HITS",
    "NEW SONGS",
    "WORKOUT TIME",
    "RANDOM SONGS",
    "THIS IS... (ARTIST)",
  ],
  "APPLE MUSIC": [
    "TOPO TODAY'S HITS",
    "TODAY'S HITS",
    "A-LIST POP",
    "hyped<D>",
    "RAPLIFE",
    "danceXL",
    "R&B NOW",
    "!DalePlay!",
    "ALT CTRL",
    "JUST HITS",
    "JUST NEW",
    "GYM SONGS",
    "RANDOM SONGS",
    "JUST... (ARTIST)",
  ],
  YOUTUBE: ["Ad 5 segundos (Comercial/Vídeo)", "Ad 30 segundos (Comercial/Vídeo)", "Ad (Vídeo Completo)"],
};

type Musica = { linha: number; artista: string; musica: string };
type Selecoes = Record<string, string>;

function PontoPlaylistsPlanilha() {
  const { user } = useTelegramUser();
  const tgId = user?.id ? String(user.id) : localStorage.getItem("empire_tg_id") || "";

  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [artistasDisp, setArtistasDisp] = useState<string[]>([]);
  const [artistaSel, setArtistaSel] = useState<string>("");
  const [saldoAtual, setSaldoAtual] = useState<number>(0);

  const [musicaAberta, setMusicaAberta] = useState<number | null>(null);
  const [pendente, setPendente] = useState<Record<string, Selecoes>>({});
  const [confirmado, setConfirmado] = useState<Record<string, Selecoes>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: string; text: string; ok: boolean } | null>(null);

  const carregarDados = useCallback(async () => {
    if (!tgId) return;
    setLoading(true);
    try {
      // 1. Busca músicas da aba PONTOS
      const pts: any = await api.pontoListarPontos(tgId);
      const listaMusicas: Musica[] = (pts?.linhas || []).map((r: any) => ({
        linha: r.linha,
        artista: r.artista,
        musica: r.valores?.["MÚSICA"] || r.valores?.["MUSICA"] || "Desconhecida",
      }));

      const unicos = Array.from(new Set(listaMusicas.map((m) => m.artista)));
      setArtistasDisp(unicos);
      setMusicas(listaMusicas);
    } finally {
      setLoading(false);
    }
  }, [tgId]);

  const carregarSaldo = useCallback(
    async (artistaNome: string) => {
      if (!tgId || !artistaNome) return;
      setRefreshing(true);
      try {
        const sal: any = await api.saldoEcoin(tgId);
        if (sal?.saldos) {
          setSaldoAtual(Number(sal.saldos[artistaNome]) || 0);
        }
      } finally {
        setRefreshing(false);
      }
    },
    [tgId],
  );

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    if (artistaSel) carregarSaldo(artistaSel);
  }, [artistaSel, carregarSaldo]);

  function toggleSelecao(musica: Musica, plataforma: string, playlist: string) {
    const mKey = String(musica.linha);
    setPendente((prev) => {
      const atual = prev[mKey] || {};
      if (atual[plataforma] === playlist) {
        const { [plataforma]: _, ...resto } = atual;
        return { ...prev, [mKey]: resto };
      }
      return { ...prev, [mKey]: { ...atual, [plataforma]: playlist } };
    });
    setMsg(null);
  }

  async function enviarMusica(musica: Musica) {
    const mKey = String(musica.linha);
    const selecoes = pendente[mKey] || {};
    if (Object.keys(selecoes).length === 0) return;

    setEnviando(mKey);
    setMsg(null);

    let erros: string[] = [];
    let sucessos = 0;

    for (const [plataforma, playlist] of Object.entries(selecoes)) {
      const d: any = await api.salvarPlaylistEcoin({
        tgId,
        artista: musica.artista,
        musica: musica.musica,
        plataforma,
        playlist,
      });
      if (d?.ok) {
        sucessos++;
        setConfirmado((prev) => ({ ...prev, [mKey]: { ...(prev[mKey] || {}), [plataforma]: playlist } }));
      } else {
        erros.push(`${plataforma}: ${d?.erro || "Erro"}`);
      }
    }

    setEnviando(null);

    if (erros.length === 0) {
      setPendente((prev) => {
        const { [mKey]: _, ...resto } = prev;
        return resto;
      });
      setMsg({ key: mKey, text: `✅ Sucesso! Playlists aplicadas na aba.`, ok: true });
      carregarSaldo(musica.artista); // Atualiza saldo na hora
    } else {
      setMsg({ key: mKey, text: `❌ ${erros.join(" | ")}`, ok: false });
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );

  const musicasFiltradas = musicas.filter((m) => m.artista === artistaSel);
  const saldoNegativo = saldoAtual < 0;

  return (
    <main className="flex flex-col gap-4 p-4 pb-32 w-full max-w-md mx-auto relative z-10">
      <Link to="/ponto/playlists" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-2">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </Link>

      <div className="mb-2">
        <h2 className="text-2xl font-black italic tracking-tighter">Playlists · Manual</h2>
        <p className="text-sm text-muted-foreground mt-1">Selecione as músicas a partir da sua aba PONTOS.</p>
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
        {artistasDisp.map((a) => (
          <button
            key={a}
            onClick={() => {
              setArtistaSel(a);
              setMusicaAberta(null);
            }}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              artistaSel === a
                ? "bg-primary text-primary-foreground"
                : "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {artistaSel && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between mb-2 shadow-lg transition-colors ${saldoNegativo ? "bg-red-950/40 border-red-500/50" : "bg-card border-white/10"}`}
        >
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 font-bold">$ BANK ACCOUNT</p>
            <div className="flex items-center gap-2">
              <Coins className={`w-5 h-5 ${saldoNegativo ? "text-red-400" : "text-yellow-400"}`} />
              <p className={`text-2xl font-black ${saldoNegativo ? "text-red-400" : "text-yellow-400"}`}>
                {saldoAtual.toLocaleString("pt-BR")}
              </p>
            </div>
            {saldoNegativo && (
              <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Orçamento estourado!
              </p>
            )}
          </div>
          <button
            onClick={() => carregarSaldo(artistaSel)}
            disabled={refreshing}
            className="p-3 bg-white/5 rounded-xl hover:bg-white/10"
          >
            <RefreshCw className={`w-5 h-5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}

      {artistaSel && musicasFiltradas.length > 0 && (
        <div className="flex flex-col gap-3">
          {musicasFiltradas.map((m) => {
            const mKey = String(m.linha);
            const aberta = musicaAberta === m.linha;
            const pendenteMusica = pendente[mKey] || {};
            const confirmadoMusica = confirmado[mKey] || {};
            const isEnviando = enviando === mKey;
            const temPendente = Object.keys(pendenteMusica).length > 0;

            return (
              <div key={m.linha} className="rounded-2xl border border-white/10 bg-card overflow-hidden shadow-lg">
                <button
                  onClick={() => {
                    setMusicaAberta(aberta ? null : m.linha);
                    setMsg(null);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-4 text-left transition-colors ${aberta ? "bg-primary/5" : "hover:bg-white/5"}`}
                >
                  <div className="flex-1 pr-4">
                    <p className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1">{m.artista}</p>
                    <h3 className="font-bold text-base leading-tight">{m.musica}</h3>
                  </div>
                  {aberta ? (
                    <ChevronUp className="w-5 h-5 text-primary" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>

                {aberta && (
                  <div className="bg-black/20 p-3 flex flex-col gap-4 border-t border-white/5">
                    {(["SPOTIFY", "APPLE MUSIC", "YOUTUBE"] as const).map((plat) => {
                      const enviada = confirmadoMusica[plat];
                      const selAtual = pendenteMusica[plat];

                      return (
                        <div key={plat} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                          <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex justify-between items-center">
                            <p className="text-xs font-bold text-gray-300">{plat}</p>
                            {enviada && (
                              <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-1 rounded-full">
                                ✓ Aplicada
                              </span>
                            )}
                          </div>

                          <div className="p-2 flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                            {PLAYLISTS[plat].map((pl) => {
                              const selecionada = selAtual === pl;
                              const jaEnviada = enviada === pl;
                              return (
                                <button
                                  key={pl}
                                  disabled={isEnviando}
                                  onClick={() => toggleSelecao(m, plat, pl)}
                                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                                    jaEnviada
                                      ? "bg-green-900/20 text-green-400 opacity-70"
                                      : selecionada
                                        ? "bg-primary/20 text-primary border border-primary/50"
                                        : "hover:bg-white/5 text-gray-400 border border-transparent"
                                  }`}
                                >
                                  {pl}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    <button
                      disabled={!temPendente || isEnviando}
                      onClick={() => enviarMusica(m)}
                      className={`mt-2 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all ${
                        temPendente && !isEnviando
                          ? "bg-primary text-primary-foreground hover:brightness-110 shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                          : "bg-white/5 text-muted-foreground cursor-not-allowed"
                      }`}
                    >
                      {isEnviando ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Processando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" /> Enviar Playlists Selecionadas
                        </>
                      )}
                    </button>

                    {msg?.key === mKey && (
                      <p className={`text-center text-xs font-semibold ${msg.ok ? "text-green-400" : "text-red-400"}`}>
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
    </main>
  );
}
