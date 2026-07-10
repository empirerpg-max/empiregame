import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Radio,
  Play,
  TrendingUp,
  Music,
  Tv,
  ListMusic,
  MessageSquare,
  Send,
  ChevronRight,
  Star,
} from "lucide-react";
import { usePlay, type PlayItem } from "@/lib/playContext";

export const Route = createFileRoute("/play/")({{
  component: PlayHomePage,
  head: () => ({
    meta: [
      { title: "Empire Play • Empire Hub" },
      { property: "og:title", content: "Empire Play • Empire Hub" },
      { property: "og:description", content: "Ouça as músicas, clipes e vídeos do Empire RPG." },
    ],
  }),
});

const API_URL =
  "https://script.google.com/macros/s/AKfycby1S1mIBXdj4hLqc9RYv1ZJjL7d5ct6to18FNPmpJn1KOnZrYCKJKPNe2LP0dPW-G8HOg/exec";

function norm(s: string) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getField(item: Record<string, string>, ...aliases: string[]): string {
  if (!item) return "";
  const keys = Object.keys(item);
  const normKeys = keys.map((k) => ({ orig: k, norm: norm(k) }));
  for (const alias of aliases) {
    const target = norm(alias);
    const found = normKeys.find((k) => k.norm === target);
    if (found && item[found.orig] != null && item[found.orig] !== "")
      return item[found.orig];
  }
  return "";
}

function extractDriveId(str: string): string | null {
  if (!str) return null;
  const m =
    String(str).match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    String(str).match(/id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (!/^https?:\/\//.test(str) && !str.includes("/")) return str.trim();
  return null;
}

function driveThumb(capa: string, size = 300): string {
  if (!capa) return "";
  const id = extractDriveId(capa) || (capa.match(/^[a-zA-Z0-9_-]{20,}$/) ? capa : null);
  if (id) return `https://lh3.googleusercontent.com/d/${id}=w${size}`;
  return capa;
}

type SheetItem = Record<string, string>;

function parseDataLancamento(item: SheetItem): number {
  const d = getField(item, "data_de_lancamento", "datadelancamento", "data");
  if (!d) return 0;
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
}

function toPlayItem(m: SheetItem, cat: PlayItem["categoria"]): PlayItem {
  const idTopico = getField(m, "id_do_topico", "idtopico", "id_topico");
  const audioSrc = getField(m, "id_do_arquivo", "idarquivo", "id_arquivo", "arquivo", "link", "url");
  const titulo =
    cat === "musica"
      ? getField(m, "nome_da_musica", "nomedamusica", "nome", "titulo")
      : getField(m, "tipo_de_clipe", "tipodeclipe", "tipo", "titulo");
  return {
    id: idTopico,
    titulo,
    artista: getField(m, "act_principal", "actprincipal"),
    capa: getField(m, "capa_da_musica", "capadamusica", "capa", "cover"),
    audioSrc,
    letra: getField(m, "letra", "lyrics"),
    categoria: cat,
  };
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  to?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {to && (
        <Link
          to={to}
          className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors"
        >
          Ver mais <ChevronRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

function SongCard({
  item,
  queue,
  idx,
}: {
  item: PlayItem;
  queue: PlayItem[];
  idx: number;
}) {
  const { play, state } = usePlay();
  const isActive =
    state.currentIdx !== null &&
    state.queue[state.currentIdx]?.id === item.id;

  return (
    <button
      onClick={() => play(item, queue)}
      className={`flex flex-col gap-2 text-left group ${
        isActive ? "opacity-100" : "opacity-90 hover:opacity-100"
      } transition-opacity`}
    >
      <div
        className={`relative aspect-square w-full rounded-2xl overflow-hidden bg-primary/10 ${
          isActive ? "ring-2 ring-primary" : ""
        }`}
      >
        {item.capa ? (
          <img
            src={driveThumb(item.capa, 300)}
            alt={item.titulo}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Music className="size-8 text-primary/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors grid place-items-center">
          <div className="size-10 rounded-full bg-primary/0 group-hover:bg-primary/90 grid place-items-center transition-all">
            <Play className="size-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="white" />
          </div>
        </div>
        {isActive && (
          <div className="absolute bottom-2 left-2 flex gap-0.5 items-end">
            {[3, 5, 4].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full animate-bounce"
                style={{ height: `${h * 3}px`, animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${
          isActive ? "text-primary" : ""
        }`}>
          {item.titulo || "—"}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
      </div>
    </button>
  );
}

function VideoCard({ item, queue }: { item: PlayItem; queue: PlayItem[] }) {
  const { play, state } = usePlay();
  const isActive =
    state.currentIdx !== null &&
    state.queue[state.currentIdx]?.id === item.id;
  return (
    <button
      onClick={() => play(item, queue)}
      className="flex flex-col gap-2 text-left group opacity-90 hover:opacity-100 transition-opacity"
    >
      <div
        className={`relative w-full rounded-2xl overflow-hidden bg-primary/10 aspect-video ${
          isActive ? "ring-2 ring-primary" : ""
        }`}
      >
        {item.capa ? (
          <img
            src={driveThumb(item.capa, 400)}
            alt={item.titulo}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Tv className="size-8 text-primary/40" />
          </div>
        )}
        <div className="absolute inset-0 grid place-items-center">
          <div className="size-10 rounded-full bg-black/40 group-hover:bg-primary/90 grid place-items-center transition-all">
            <Play className="size-5 text-white" fill="white" />
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-black truncate uppercase tracking-tight ${
          isActive ? "text-primary" : ""
        }`}>
          {item.titulo || "—"}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
      </div>
    </button>
  );
}

// ─── Forum Inline ─────────────────────────────────────────────────────────────

type Comentario = { nome: string; texto: string };

function ForumTopicoInline({ item, categoria }: { item: PlayItem; categoria: string }) {
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null);
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { play } = usePlay();

  useEffect(() => {
    fetch(`${API_URL}?action=comentarios&categoria=${categoria}&idTopico=${item.id}`)
      .then((r) => r.json())
      .then((j) => {
        setComentarios(
          (j.data || []).map((c: Record<string, string>) => ({
            nome: getField(c, "nome_do_jogador", "nome") || "Anônimo",
            texto: getField(c, "comentario", "texto"),
          }))
        );
      })
      .catch(() => setComentarios([]));
  }, [item.id, categoria]);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "novoComentario",
        categoria,
        idTopico: item.id,
        nomeJogador: nome.trim() || "Anônimo",
        comentario: texto.trim(),
      }),
    });
    setTexto("");
    setEnviando(false);
    // Recarrega
    fetch(`${API_URL}?action=comentarios&categoria=${categoria}&idTopico=${item.id}`)
      .then((r) => r.json())
      .then((j) =>
        setComentarios(
          (j.data || []).map((c: Record<string, string>) => ({
            nome: getField(c, "nome_do_jogador", "nome") || "Anônimo",
            texto: getField(c, "comentario", "texto"),
          }))
        )
      );
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="size-12 rounded-2xl overflow-hidden bg-primary/10 flex-shrink-0">
          {item.capa ? (
            <img src={driveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="w-full h-full grid place-items-center"><Music className="size-5 text-primary/40" /></div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm truncate uppercase tracking-tight">{item.titulo}</p>
          <p className="text-[10px] text-muted-foreground">{item.artista}</p>
          <button
            onClick={() => play(item)}
            className="mt-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1 hover:scale-105 transition-transform"
          >
            <Play className="size-3" fill="currentColor" /> Tocar
          </button>
        </div>
      </div>

      {item.letra && (
        <details className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
          <summary className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-primary">Ver Letra</summary>
          <pre className="mt-3 whitespace-pre-wrap text-xs font-sans text-foreground/80">{item.letra}</pre>
        </details>
      )}

      <div className="space-y-2">
        {comentarios === null ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-12 rounded-2xl bg-white/[0.03] animate-pulse" />)}
          </div>
        ) : comentarios.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center py-4 opacity-50">Nenhum comentário ainda.</p>
        ) : (
          comentarios.map((c, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-1">{c.nome}</p>
              <p className="text-xs text-foreground/80">{c.texto}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome"
          className="h-10 flex-[0.4] bg-white/5 border border-white/10 rounded-2xl px-3 text-xs font-bold uppercase tracking-tight outline-none focus:border-primary/40"
        />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Comentar..."
          className="h-10 flex-1 bg-white/5 border border-white/10 rounded-2xl px-3 text-xs font-bold outline-none focus:border-primary/40"
          onKeyDown={(e) => e.key === "Enter" && enviar()}
        />
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center hover:scale-105 transition-transform disabled:opacity-30"
          aria-label="Enviar"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlayHomePage() {
  const [musicasDB, setMusicasDB] = useState<SheetItem[]>([]);
  const [musicVideosDB, setMusicVideosDB] = useState<SheetItem[]>([]);
  const [videosDB, setVideosDB] = useState<SheetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"musicas" | "musicvideos" | "videos">("musicas");
  const [forumItem, setForumItem] = useState<{ item: PlayItem; cat: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}?action=conteudo&categoria=musicas`).then((r) => r.json()),
      fetch(`${API_URL}?action=conteudo&categoria=musicvideos`).then((r) => r.json()),
      fetch(`${API_URL}?action=conteudo&categoria=videos`).then((r) => r.json()),
    ])
      .then(([rm, rmv, rv]) => {
        setMusicasDB(rm.data || []);
        setMusicVideosDB(rmv.data || []);
        setVideosDB(rv.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const destaques = useMemo<PlayItem[]>(
    () =>
      [...musicasDB]
        .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
        .slice(0, 5)
        .map((m) => toPlayItem(m, "musica")),
    [musicasDB]
  );

  const lancamentos = useMemo<PlayItem[]>(() => {
    if (tab === "musicas")
      return [...musicasDB]
        .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
        .slice(0, 8)
        .map((m) => toPlayItem(m, "musica"));
    if (tab === "musicvideos")
      return [...musicVideosDB]
        .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
        .slice(0, 8)
        .map((m) => toPlayItem(m, "musicvideo"));
    return [...videosDB]
      .sort((a, b) => parseDataLancamento(b) - parseDataLancamento(a))
      .slice(0, 8)
      .map((m) => toPlayItem(m, "video"));
  }, [tab, musicasDB, musicVideosDB, videosDB]);

  const topPlaylists = useMemo<PlayItem[]>(
    () =>
      [...musicasDB]
        .sort(
          (a, b) =>
            (parseInt(getField(b, "weeks")) || 0) -
            (parseInt(getField(a, "weeks")) || 0)
        )
        .slice(0, 12)
        .map((m) => toPlayItem(m, "musica")),
    [musicasDB]
  );

  const topMV = useMemo<PlayItem[]>(
    () =>
      [...musicVideosDB]
        .sort(
          (a, b) =>
            (parseInt(getField(b, "weeks_video", "weeksvideo")) || 0) -
            (parseInt(getField(a, "weeks_video", "weeksvideo")) || 0)
        )
        .slice(0, 6)
        .map((m) => toPlayItem(m, "musicvideo")),
    [musicVideosDB]
  );

  // Albuns agrupados
  const albunsMap = useMemo(() => {
    const map: Record<string, { title: string; artist: string; item: PlayItem }> = {};
    musicasDB.forEach((m) => {
      const album = getField(m, "album");
      if (album && !map[album]) {
        map[album] = {
          title: album,
          artist: getField(m, "act_principal", "actprincipal"),
          item: toPlayItem(m, "musica"),
        };
      }
    });
    return Object.values(map);
  }, [musicasDB]);

  if (loading) {
    return (
      <main className="flex-1 px-4 pt-6 space-y-6 pb-32">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-4 w-32 rounded-full bg-white/[0.06] animate-pulse mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="aspect-square rounded-2xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </main>
    );
  }

  return (
    <main className="flex-1 pb-36">
      {/* Hero header */}
      <div
        className="px-4 pt-6 pb-8"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.25 0.12 280 / 0.6), oklch(0.12 0 0) 85%)",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Radio className="size-4 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Empire Play
          </p>
        </div>
        <h1 className="text-2xl font-black tracking-tighter">Ouça agora</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Músicas, clipes e vídeos do universo Empire
        </p>
      </div>

      <div className="px-4 space-y-8">
        {/* ── Destaques ────────────────────────────────── */}
        {destaques.length > 0 && (
          <section>
            <SectionHeader icon={<Star className="size-4 text-primary" />} title="Destaques" />
            <div className="grid grid-cols-3 gap-3">
              {destaques.map((item, i) => (
                <SongCard key={item.id} item={item} queue={destaques} idx={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Tabs + Lançamentos ───────────────────────── */}
        <section>
          <SectionHeader icon={<TrendingUp className="size-4 text-primary" />} title="Lançamentos" />
          <div className="grid grid-cols-3 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl mb-4">
            {(["musicas", "musicvideos", "videos"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  tab === t
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "musicas" ? "Músicas" : t === "musicvideos" ? "Clipes" : "Vídeos"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {lancamentos.map((item, i) =>
              tab === "musicas" ? (
                <SongCard key={item.id} item={item} queue={lancamentos} idx={i} />
              ) : (
                <VideoCard key={item.id} item={item} queue={lancamentos} />
              )
            )}
          </div>
        </section>

        {/* ── Álbuns ───────────────────────────────────── */}
        {albunsMap.length > 0 && (
          <section>
            <SectionHeader
              icon={<Music className="size-4 text-primary" />}
              title="Álbuns"
            />
            <div className="grid grid-cols-2 gap-3">
              {albunsMap.slice(0, 6).map((a) => (
                <button
                  key={a.title}
                  onClick={() => usePlayRef.current?.play(a.item)}
                  className="flex items-center gap-3 p-3 bg-card border border-white/5 rounded-[1.5rem] text-left hover:border-primary/30 transition-colors group"
                >
                  <div className="size-12 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
                    {a.item.capa ? (
                      <img
                        src={driveThumb(a.item.capa, 120)}
                        alt={a.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center">
                        <Music className="size-5 text-primary/40" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-xs truncate uppercase tracking-tight group-hover:text-primary transition-colors">
                      {a.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{a.artist}</p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Top Playlists ─────────────────────────────── */}
        {topPlaylists.length > 0 && (
          <section>
            <SectionHeader
              icon={<ListMusic className="size-4 text-primary" />}
              title="Top Playlists"
            />
            <div className="grid grid-cols-3 gap-3">
              {topPlaylists.map((item, i) => (
                <SongCard key={item.id} item={item} queue={topPlaylists} idx={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Music Videos ─────────────────────────────── */}
        {topMV.length > 0 && (
          <section>
            <SectionHeader
              icon={<Tv className="size-4 text-primary" />}
              title="Music Videos"
            />
            <div className="grid grid-cols-2 gap-3">
              {topMV.map((item) => (
                <VideoCard key={item.id} item={item} queue={topMV} />
              ))}
            </div>
          </section>
        )}

        {/* ── Fórum ─────────────────────────────────────── */}
        <section className="pb-4">
          <SectionHeader
            icon={<MessageSquare className="size-4 text-primary" />}
            title="Fórum"
          />
          <div className="grid grid-cols-3 gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-2xl mb-4">
            {(["musicas", "musicvideos", "videos"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setForumItem(null); }}
                className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  tab === t
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "musicas" ? "Músicas" : t === "musicvideos" ? "Clipes" : "Vídeos"}
              </button>
            ))}
          </div>

          {forumItem ? (
            <div>
              <button
                onClick={() => setForumItem(null)}
                className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1 hover:text-primary transition-colors"
              >
                <ChevronRight className="size-3 rotate-180" /> Tópicos
              </button>
              <ForumTopicoInline item={forumItem.item} categoria={forumItem.cat} />
            </div>
          ) : (
            <div className="space-y-2">
              {(tab === "musicas"
                ? musicasDB.map((m) => toPlayItem(m, "musica"))
                : tab === "musicvideos"
                ? musicVideosDB.map((m) => toPlayItem(m, "musicvideo"))
                : videosDB.map((m) => toPlayItem(m, "video"))
              ).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setForumItem({ item, cat: tab })}
                  className="w-full flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-[1.5rem] hover:border-primary/30 transition-colors text-left"
                >
                  <div className="size-10 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0">
                    {item.capa ? (
                      <img src={driveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-full h-full grid place-items-center"><Music className="size-4 text-primary/40" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-xs truncate uppercase tracking-tight">{item.titulo || "—"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.artista}</p>
                  </div>
                  <MessageSquare className="size-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// Ref helper para usar play() dentro de renderização estática de álbuns
const usePlayRef = { current: null as ReturnType<typeof usePlay> | null };
