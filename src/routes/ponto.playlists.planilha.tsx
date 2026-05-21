import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2, Music, ChevronDown, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";
import { notify } from "@/lib/notify";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/ponto/playlists/planilha")({
  component: PlaylistsPlanilha,
});

const PLAYLISTS_POR_PLATAFORMA: Record<string, string[]> = {
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

const PLATAFORMAS = Object.keys(PLAYLISTS_POR_PLATAFORMA);

type Musica = { linha: number; musica: string; artista: string };
type Selecionadas = Record<string, string>; // plataforma → playlist

function PlaylistsPlanilha() {
  const { user, ready } = useTelegramUser();
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [musicaSelecionada, setMusicaSelecionada] = useState<Musica | null>(null);
  const [selecionadas, setSelecionadas] = useState<Selecionadas>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [saldos, setSaldos] = useState<Record<string, any>>({});
  const [expandirMusicas, setExpandirMusicas] = useState(false);

  const tgId = String(user?.id ?? "");

  useEffect(() => {
    if (!ready || !tgId) return;
    Promise.all([api.listarMusicasEdicao(tgId), api.saldoEcoin(tgId)])
      .then(([mRes, sRes]) => {
        if (mRes?.musicas) setMusicas(mRes.musicas);
        else if (mRes?.erro) setErro(mRes.erro);
        if (sRes?.saldos) setSaldos(sRes.saldos);
      })
      .catch((e) => setErro("Erro: " + e.message))
      .finally(() => setLoading(false));
  }, [ready, tgId]);

  async function salvarPlaylist(plataforma: string, playlist: string) {
    if (!musicaSelecionada || !tgId) return;
    setSalvando(plataforma);
    const r = await api.salvarPlaylistEcoin({
      tgId,
      musica: musicaSelecionada.musica,
      artista: musicaSelecionada.artista,
      plataforma,
      playlist,
    });
    setSalvando(null);
    if (r?.ok) {
      setSelecionadas((prev) => ({ ...prev, [plataforma]: playlist }));
      if (r.saldo !== undefined) {
        setSaldos((prev) => ({ ...prev, [musicaSelecionada.artista]: r.saldo }));
      }
      notify(r);
    } else {
      notify(r);
    }
  }

  if (!ready || loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );

  if (!tgId)
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Abra o app pelo Telegram para acessar esta tela.
      </div>
    );

  if (erro)
    return (
      <div className="p-4 text-center text-red-400 text-sm rounded-2xl bg-red-900/20 border border-red-500/20 m-4">
        {erro}
      </div>
    );

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <Link to="/ponto/playlists" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </Link>
      <div>
        <h2 className="text-xl font-black italic tracking-tighter">Playlists · Manual</h2>
        <p className="text-xs text-muted-foreground mt-1">Escolha uma música e distribua as playlists.</p>
      </div>

      {/* Saldo por artista */}
      {Object.entries(saldos).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(saldos).map(([artista, saldo]) => (
            <div key={artista} className="bg-primary/10 border border-primary/20 rounded-2xl px-3 py-2">
              <p className="text-xs text-muted-foreground">{artista}</p>
              <p className="text-sm font-bold text-primary">{String(saldo)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Seletor de música */}
      <div className="rounded-2xl bg-card border border-white/10 overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4"
          onClick={() => setExpandirMusicas(!expandirMusicas)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 grid place-items-center">
              <Music className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-xs text-muted-foreground">Música selecionada</p>
              <p className="text-sm font-semibold">
                {musicaSelecionada ? musicaSelecionada.musica : "— escolher música —"}
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${expandirMusicas ? "rotate-180" : ""}`}
          />
        </button>

        {expandirMusicas && (
          <div className="border-t border-white/5 max-h-64 overflow-y-auto divide-y divide-white/5">
            {musicas.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma música encontrada.</p>
            )}
            {musicas.map((m) => (
              <button
                key={m.linha}
                className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors ${
                  musicaSelecionada?.linha === m.linha ? "bg-primary/10" : ""
                }`}
                onClick={() => {
                  setMusicaSelecionada(m);
                  setSelecionadas({});
                  setExpandirMusicas(false);
                }}
              >
                <div>
                  <p className="text-sm font-medium">{m.musica}</p>
                  <p className="text-xs text-muted-foreground">{m.artista}</p>
                </div>
                {musicaSelecionada?.linha === m.linha && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Plataformas */}
      {musicaSelecionada && (
        <div className="flex flex-col gap-3">
          {PLATAFORMAS.map((plat) => {
            const opcoes = PLAYLISTS_POR_PLATAFORMA[plat];
            const atual = selecionadas[plat] ?? "";
            const isSaving = salvando === plat;

            return (
              <div key={plat} className="rounded-2xl bg-card border border-white/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{plat}</p>
                  {atual && (
                    <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">✓ salvo</span>
                  )}
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                </div>
                <select
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none
                  bg-zinc-800 text-white border border-white/10
                  focus:border-primary transition-colors
                  [&>option]:bg-zinc-800 [&>option]:text-white"
                  value={atual}
                  disabled={isSaving}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) salvarPlaylist(plat, val);
                  }}
                >
                  <option value="">— selecionar playlist —</option>
                  {opcoes.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
