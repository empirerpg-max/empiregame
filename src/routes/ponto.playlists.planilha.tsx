import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ChevronLeft, Loader2, CheckCircle2, Music2 } from "lucide-react";
import { api } from "@/lib/api";
import { useTelegramUser } from "@/lib/telegram";
import { notify } from "@/lib/notify";

type Plat = "SPOTIFY" | "APPLE MUSIC" | "YOUTUBE";

const PLAYLISTS: Record<Plat, string[]> = {
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

const PLAT_STYLE: Record<Plat, { color: string; bg: string }> = {
  SPOTIFY: { color: "text-green-400", bg: "bg-green-500/15" },
  "APPLE MUSIC": { color: "text-pink-400", bg: "bg-pink-500/15" },
  YOUTUBE: { color: "text-red-400", bg: "bg-red-500/15" },
};

const COL_PLAT: Record<Plat, string> = {
  SPOTIFY: "SPOTIFY",
  "APPLE MUSIC": "APPLE MUSIC",
  YOUTUBE: "YOUTUBE",
};

type LinhaItem = {
  linha: number;
  artista: string;
  musica: string;
  valores: Record<string, unknown>;
};

function PontoPlaylistsManual() {
  const { user } = useTelegramUser();
  const tgId = user?.id ? String(user.id) : "";

  const [linhas, setLinhas] = useState<LinhaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<LinhaItem | null>(null);
  const [selecoes, setSelecoes] = useState<Partial<Record<Plat, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!tgId) return;
    setLoading(true);
    api.listarPlaylistsJogador(tgId).then((r) => {
      const cols = r?.colunas ?? [];
      const linhasRaw = r?.linhas ?? [];
      const colMusica =
        cols.find(
          (c) =>
            c.toUpperCase().includes("MÚSICA") ||
            c.toUpperCase().includes("MUSICA") ||
            c.toUpperCase().includes("NOME DA"),
        ) ?? "";
      setLinhas(
        linhasRaw.map((l) => ({
          linha: l.linha,
          artista: l.artista,
          musica: colMusica ? String(l.valores?.[colMusica] ?? "") : l.artista,
          valores: l.valores ?? {},
        })),
      );
      setLoading(false);
    });
  }, [tgId]);

  async function salvar() {
    if (!sel || !tgId) return;
    const entradas = (Object.entries(selecoes) as [Plat, string][]).filter(([, v]) => !!v);
    if (!entradas.length) {
      notify({ erro: "Selecione ao menos uma playlist." });
      return;
    }
    setSaving(true);
    let ok = true;
    for (const [plat, playlist] of entradas) {
      const r = await api.salvarCelulaPlaylist({
        tgId,
        linha: sel.linha,
        coluna: COL_PLAT[plat],
        valor: playlist,
      });
      if (r?.erro) {
        notify(r);
        ok = false;
      }
    }
    setSaving(false);
    if (ok) {
      setSaved(true);
      setSelecoes({});
      setLinhas((prev) =>
        prev.map((l) => {
          if (l.linha !== sel.linha) return l;
          const nov = { ...l.valores };
          (Object.entries(selecoes) as [Plat, string][])
            .filter(([, v]) => !!v)
            .forEach(([p, playlist]) => {
              nov[COL_PLAT[p]] = playlist;
            });
          return { ...l, valores: nov };
        }),
      );
      setTimeout(() => setSaved(false), 2500);
    }
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );

  if (!tgId)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Abra pelo Telegram.
      </div>
    );

  return (
    <div className="min-h-screen bg-background px-4 pt-6 pb-28 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link to="/ponto/playlists" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Playlists · Manual</h1>
          <p className="text-xs text-muted-foreground">Escolha uma música e distribua.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Música</p>
        {linhas.length === 0 && <p className="text-sm text-muted-foreground px-1">Nenhuma música encontrada.</p>}
        <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
          {linhas.map((l) => (
            <button
              key={l.linha}
              onClick={() => {
                setSel(l);
                setSelecoes({});
                setSaved(false);
              }}
              className={
                "w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 " +
                (sel?.linha === l.linha
                  ? "border-primary bg-primary/10 text-white"
                  : "border-white/8 bg-card hover:border-white/20")
              }
            >
              <Music2 size={15} className={sel?.linha === l.linha ? "text-primary" : "text-muted-foreground"} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{l.musica || l.artista}</p>
                <p className="text-xs text-muted-foreground truncate">{l.artista}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {sel && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Plataformas</p>
          {(Object.keys(PLAYLISTS) as Plat[]).map((plat) => {
            const style = PLAT_STYLE[plat];
            const opcoes = PLAYLISTS[plat];
            const atual = selecoes[plat] ?? "";
            const jaPreenchido = sel.valores[COL_PLAT[plat]];
            return (
              <div key={plat} className="rounded-2xl border border-white/8 bg-card overflow-hidden">
                <div className={"flex items-center justify-between px-4 py-2.5 " + style.bg}>
                  <span className={"text-xs font-bold uppercase tracking-wider " + style.color}>{plat}</span>
                  {jaPreenchido && (
                    <span className="text-xs text-muted-foreground truncate max-w-[140px]">{String(jaPreenchido)}</span>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <select
                    value={atual}
                    onChange={(e) => setSelecoes((prev) => ({ ...prev, [plat]: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none bg-zinc-800 text-white border border-white/10 focus:border-primary transition-colors"
                  >
                    <option value="">— selecionar —</option>
                    {opcoes.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sel && (
        <button
          onClick={salvar}
          disabled={saving || saved || !Object.values(selecoes).some(Boolean)}
          className={
            "w-full py-4 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 " +
            (saved
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-primary text-black hover:bg-primary/90 disabled:opacity-40")
          }
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : saved ? (
            <>
              <CheckCircle2 size={18} /> Salvo!
            </>
          ) : (
            "Salvar playlists"
          )}
        </button>
      )}
    </div>
  );
}

export const Route = createFileRoute("/ponto/playlists/planilha")({
  component: PontoPlaylistsManual,
});
