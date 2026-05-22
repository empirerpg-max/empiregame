import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  Coins,
  Music2,
  RefreshCw,
  Send,
} from "lucide-react";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";

export const Route = createFileRoute("/ponto/playlists/planilha")({
  component: PontoPlaylistsPlanilha,
});

const PLAYLISTS: Record<string, string[]> = {
  SPOTIFY: [
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
  YOUTUBE: [
    "Ad 5 segundos (Comercial/Vídeo)",
    "Ad 30 segundos (Comercial/Vídeo)",
    "Ad (Vídeo Completo)",
  ],
};

type Artista = { nome: string; saldo: number };
type Musica = { linha: number; artista: string; musica: string };
type Selecoes = Record<string, string>;

const SHEET_ID = "1wNbtP78MrtrOc2Jb1ejXcHVjqndR2Vm4-3EIVqa8aOg";

function PontoPlaylistsPlanilha() {
  const { user } = useTelegramUser();
  const tgId = user?.id ? String(user.id) : localStorage.getItem("empire_tg_id") || "";

  const [artistas, setArtistas] = useState<Artista[]>([]);
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [artistaSel, setArtistaSel] = useState<string>("");
  const [musicaAberta, setMusicaAberta] = useState<number | null>(null);
  const [plataformaAberta, setPlataformaAberta] = useState<string | null>(null);
  const [pendente, setPendente] = useState<Record<string, Selecoes>>({});
  const [confirmado, setConfirmado] = useState<Record<string, Selecoes>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ key: string; text: string; ok: boolean } | null>(null);

  const saldoAtual = artistas.find((a) => a.nome === artistaSel)?.saldo ?? 0;

  const carregarSaldos = useCallback(
    async (mostrarLoader = false) => {
      if (!tgId) return;
      if (mostrarLoader) setLoading(true);
      else setRefreshing(true);
      try {
        const sal: any = await (api as any).call({
          acao: "ponto_saldo_ecoin_dados",
          tgId,
          sheetId: SHEET_ID,
        });
        if (sal?.saldos) {
          setArtistas(
            Object.entries(sal.saldos as Record<string, number>).map(
              ([nome, saldo]) => ({ nome, saldo: Number(saldo) || 0 })
            )
          );
        } else {
          const sal2: any = await api.saldoEcoin(tgId);
          if (sal2?.saldos) {
            setArtistas(
              Object.entries(sal2.saldos as Record<string, number>).map(
                ([nome, saldo]) => ({ nome, saldo: Number(saldo) || 0 })
              )
            );
          }
        }
      } finally {
        if (mostrarLoader) setLoading(false);
        else setRefreshing(false);
      }
    },
    [tgId]
  );

  useEffect(() => {
    carregarSaldos(true);
  }, [carregarSaldos]);

  useEffect(() => {
    if (!artistaSel || !tgId) return;
    setMusicas([]);
    setMusicaAberta(null);
    setPlataformaAberta(null);
    setPendente({});
    setConfirmado({});
    setMsg(null);
    api.listarMusicasEdicao(tgId).then((d: any) => {
      const todas: Musica[] = d?.musicas || [];
      setMusicas(
        todas.filter((m) => m.artista?.toLowerCase() === artistaSel.toLowerCase())
      );
    });
  }, [artistaSel, tgId]);

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
        setConfirmado((prev) => ({
          ...prev,
          [mKey]: { ...(prev[mKey] || {}), [plataforma]: playlist },
        }));
      } else {
        erros.push(`${plataforma}: ${d?.erro || "erro"}`);
      }
    }

    setEnviando(null);

    if (erros.length === 0) {
      setPendente((prev) => {
        const { [mKey]: _, ...resto } = prev;
        return resto;
      });
      setMsg({ key: mKey, text: `✅ ${sucessos} playlist(s) enviada(s)!`, ok: true });
      carregarSaldos(false);
    } else {
      setMsg({ key: mKey, text: `❌ ${erros.join(" | ")}`, ok: false });
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-purple-400 w-8 h-8" />
      </div>
    );

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-900 text-white p-4 pb-32">
      <Link
        to="/ponto/playlists"
        className="inline-flex items-center gap-1 text-purple-300 mb-5 text-sm"
      >
        <ChevronLeft className="w-4 h-4" /> Voltar
      </Link>
      <h1 className="text-2xl font-extrabold text-center mb-6 text-purple-300">
        💿 Investimento de Playlist
      </h1>

      {/* Artistas */}
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-semibold">
        Selecione seu artista
      </p>
      {artistas.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum artista vinculado.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {artistas.map((a) => (
            <button
              key={a.nome}
              onClick={() => setArtistaSel(a.nome)}
              className={`rounded-2xl p-4 flex flex-col items-center gap-1 border-2 transition-all active:scale-95 ${
                artistaSel === a.nome
                  ? "border-purple-400 bg-purple-900/60 scale-105"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <span className="text-2xl">🎤</span>
              <span className="font-semibold text-sm text-center leading-tight">{a.nome}</span>
              <span className="flex items-center gap-1 text-yellow-300 text-xs font-bold">
                <Coins className="w-3 h-3" />
                {a.saldo.toLocaleString("pt-BR")}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* $ Bank Account — saldo live (aba DADOS, coluna AI) */}
      {artistaSel && (
        <div className="mb-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-yellow-200/80 font-semibold">
              $ Bank Account · {artistaSel}
            </p>
            <p className="text-xl font-extrabold text-yellow-300">
              {saldoAtual.toLocaleString("pt-BR")}
            </p>
          </div>
          <button
            onClick={() => carregarSaldos(false)}
            disabled={refreshing}
            className="text-yellow-400 hover:text-yellow-200 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}

      {/* Músicas com accordion */}
      {artistaSel && (
        <div className="mb-6">
          <p className="text-xs text-purple-300 uppercase tracking-widest mb-2 font-semibold flex items-center gap-2">
            <Music2 className="w-4 h-4" /> Músicas de {artistaSel}
          </p>
          {musicas.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma música encontrada.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {musicas.map((m) => {
                const mKey = String(m.linha);
                const aberta = musicaAberta === m.linha;
                const pendenteMusica = pendente[mKey] || {};
                const confirmadoMusica = confirmado[mKey] || {};
                const temPendente = Object.keys(pendenteMusica).length > 0;
                const isEnviando = enviando === mKey;

                return (
                  <div
                    key={m.linha}
                    className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
                  >
                    {/* Cabeçalho da música */}
                    <button
                      onClick={() => {
                        setMusicaAberta(aberta ? null : m.linha);
                        setMsg(null);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 text-left text-sm"
                    >
                      <span className="truncate font-medium">🎵 {m.musica}</span>
                      {aberta ? (
                        <ChevronUp className="w-4 h-4 text-purple-300 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                    </button>

                    {/* Plataformas */}
                    {aberta && (
                      <div className="border-t border-white/5 p-3 flex flex-col gap-3 bg-black/20">
                        {(["SPOTIFY", "APPLE MUSIC", "YOUTUBE"] as const).map((plat) => {
                          const platKey = `${mKey}-${plat}`;
                          const platOpen = plataformaAberta === platKey;
                          const selAtual = pendenteMusica[plat];
                          const enviada = confirmadoMusica[plat];

                          return (
                            <div
                              key={plat}
                              className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
                            >
                              {/* Cabeçalho da plataforma */}
                              <button
                                onClick={() =>
                                  setPlataformaAberta(platOpen ? null : platKey)
                                }
                                className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-400 font-semibold">{plat}</p>
                                  {enviada && (
                                    <p className="text-[11px] text-green-400 truncate mt-0.5">
                                      ✓ {enviada}
                                    </p>
                                  )}
                                  {!enviada && selAtual && (
                                    <p className="text-[11px] text-yellow-300 truncate mt-0.5">
                                      ● {selAtual} (pendente)
                                    </p>
                                  )}
                                </div>
                                {platOpen ? (
                                  <ChevronUp className="w-4 h-4 text-purple-300 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                )}
                              </button>

                              {/* Lista de playlists */}
                              {platOpen && (
                                <div className="flex flex-col gap-1.5 p-2 border-t border-white/5">
                                  {PLAYLISTS[plat].map((pl) => {
                                    const selecionada = selAtual === pl;
                                    const jaEnviada = enviada === pl;
                                    return (
                                      <button
                                        key={pl}
                                        disabled={isEnviando}
                                        onClick={() => toggleSelecao(m, plat, pl)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all active:scale-95 ${
                                          jaEnviada
                                            ? "border-green-400 bg-green-900/40 text-green-300 font-semibold"
                                            : selecionada
                                            ? "border-yellow-400 bg-yellow-900/40 text-yellow-200 font-semibold"
                                            : "border-white/10 bg-white/5 hover:bg-purple-800/40 hover:border-purple-400"
                                        }`}
                                      >
                                        {jaEnviada ? "✓ " : selecionada ? "● " : ""}
                                        {pl}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Botão Enviar */}
                        <button
                          disabled={!temPendente || isEnviando}
                          onClick={() => enviarMusica(m)}
                          className={`mt-1 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all active:scale-95 ${
                            temPendente && !isEnviando
                              ? "bg-purple-600 hover:bg-purple-500 text-white"
                              : "bg-white/5 text-gray-500 cursor-not-allowed"
                          }`}
                        >
                          {isEnviando ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Enviar{temPendente ? ` (${Object.keys(pendenteMusica).length} selecionada(s))` : ""}
                            </>
                          )}
                        </button>

                        {msg?.key === mKey && (
                          <p
                            className={`text-center text-xs font-semibold ${
                              msg.ok ? "text-green-400" : "text-red-400"
                            }`}
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
      )}
    </main>
  );
}
