import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronDown, ChevronUp, Loader2, Coins, Music2 } from "lucide-react";
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
  YOUTUBE: ["Ad 5 segundos (Comercial/Vídeo)", "Ad 30 segundos (Comercial/Vídeo)", "Ad (Vídeo Completo)"],
};

type Artista = { nome: string; saldo: number };
type Musica = { linha: number; artista: string; musica: string };

function PontoPlaylistsPlanilha() {
  const { user } = useTelegramUser();
  const tgId = user?.id || localStorage.getItem("empire_tg_id") || "";

  const [artistas, setArtistas] = useState<Artista[]>([]);
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [artistaSel, setArtistaSel] = useState<string>("");
  const [musicaSel, setMusicaSel] = useState<Musica | null>(null);
  const [salvo, setSalvo] = useState<Record<string, string>>({});
  const [plataformaAberta, setPlataformaAberta] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ── Carrega artistas do jogador + saldos
  useEffect(() => {
    if (!tgId) return;
    setLoading(true);
    Promise.all([api.getJogador(tgId), api.saldoEcoin(tgId).catch(() => ({ saldos: {} as Record<string, number> }))])
      .then(([jog, sal]) => {
        const nomes: string[] = jog?.artistas || [];
        const saldos = (sal as any)?.saldos || {};
        if (nomes.length === 0 && saldos && Object.keys(saldos).length > 0) {
          setArtistas(
            Object.entries(saldos as Record<string, number>).map(([nome, saldo]) => ({
              nome,
              saldo: Number(saldo) || 0,
            })),
          );
        } else {
          setArtistas(nomes.map((nome) => ({ nome, saldo: Number(saldos[nome] ?? 0) })));
        }
      })
      .finally(() => setLoading(false));
  }, [tgId]);


  // ── Carrega músicas ao selecionar artista
  useEffect(() => {
    if (!artistaSel || !tgId) return;
    setMusicas([]);
    setMusicaSel(null);
    setSalvo({});
    setMsg(null);
    api.listarMusicasEdicao(tgId).then((d: any) => {
      const todas: Musica[] = d?.musicas || [];
      setMusicas(todas.filter((m) => m.artista?.toLowerCase() === artistaSel.toLowerCase()));
    });
  }, [artistaSel, tgId]);

  async function refreshSaldos() {
    const sal: any = await api.saldoEcoin(tgId).catch(() => null);
    if (sal?.saldos) {
      setArtistas((prev) =>
        prev.map((a) => ({ ...a, saldo: Number(sal.saldos[a.nome] ?? a.saldo) || a.saldo })),
      );
    }
  }

  async function salvarPlaylist(plataforma: string, playlist: string) {
    if (!musicaSel) return;
    setSaving(plataforma);
    setMsg(null);
    const d: any = await api.salvarPlaylistEcoin({
      tgId,
      artista: artistaSel,
      musica: musicaSel.musica,
      plataforma,
      playlist,
    });
    setSaving(null);
    if (d?.ok) {
      setSalvo((prev) => ({ ...prev, [`${musicaSel.linha}-${plataforma}`]: playlist }));
      setMsg({ text: `✅ ${plataforma} salva!`, ok: true });
      refreshSaldos();
    } else {
      setMsg({ text: `❌ ${d?.erro || "Erro desconhecido"}`, ok: false });
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
      {/* Header */}
      <Link to="/ponto/playlists" className="inline-flex items-center gap-1 text-purple-300 mb-5 text-sm">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </Link>
      <h1 className="text-2xl font-extrabold text-center mb-6 text-purple-300">💿 Investimento de Playlist</h1>

      {/* ── Saldos / Seleção de artista ── */}
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-semibold">Selecione seu artista</p>
      {artistas.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum artista vinculado.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6">
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

      {/* ── Saldo do artista selecionado (live) ── */}
      {artistaSel && (
        <div className="mb-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-yellow-200/80 font-semibold">$ Bank Account</p>
            <p className="text-lg font-extrabold text-yellow-300">
              {(artistas.find((a) => a.nome === artistaSel)?.saldo ?? 0).toLocaleString("pt-BR")}
            </p>
          </div>
          <Coins className="w-6 h-6 text-yellow-300" />
        </div>
      )}

      {/* ── Músicas do artista (cada música é collapsible) ── */}
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
                const aberto = musicaSel?.linha === m.linha;
                return (
                  <div key={m.linha} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                    <button
                      onClick={() => {
                        setMusicaSel(aberto ? null : m);
                        setMsg(null);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 text-left text-sm"
                    >
                      <span className="truncate">🎵 {m.musica}</span>
                      {aberto ? (
                        <ChevronUp className="w-4 h-4 text-purple-300 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                    </button>

                    {aberto && (
                      <div className="border-t border-white/5 p-3 flex flex-col gap-3 bg-black/20">
                        {(["SPOTIFY", "APPLE MUSIC", "YOUTUBE"] as const).map((plat) => {
                          const expandKey = `${m.linha}-${plat}`;
                          const aberta = plataformaAberta === expandKey;
                          const salva = salvo[`${m.linha}-${plat}`];
                          return (
                            <div key={plat} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                              <button
                                onClick={() => setPlataformaAberta(aberta ? null : expandKey)}
                                className="w-full flex items-center justify-between px-3 py-2 text-left"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-400 font-semibold">{plat}</p>
                                  {salva && <p className="text-[11px] text-green-400 truncate">✓ {salva}</p>}
                                </div>
                                {aberta ? (
                                  <ChevronUp className="w-4 h-4 text-purple-300 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                )}
                              </button>

                              {aberta && (
                                <div className="flex flex-col gap-1.5 p-2 border-t border-white/5">
                                  {PLAYLISTS[plat].map((pl) => {
                                    const selecionada = salva === pl;
                                    return (
                                      <button
                                        key={pl}
                                        disabled={saving === plat}
                                        onClick={() => salvarPlaylist(plat, pl)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all active:scale-95 ${
                                          selecionada
                                            ? "border-green-400 bg-green-900/40 text-green-300 font-semibold"
                                            : "border-white/10 bg-white/5 hover:bg-purple-800/40 hover:border-purple-400"
                                        }`}
                                      >
                                        {selecionada ? "✓ " : ""}
                                        {pl}
                                      </button>
                                    );
                                  })}
                                  {saving === plat && (
                                    <div className="flex items-center gap-2 mt-1 text-[11px] text-purple-300">
                                      <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {msg && (
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
        </div>
      )}
    </main>
  );
}

