import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Radio, Users, Play, ArrowLeft, Calendar } from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";
import { useTelegramUser } from "@/lib/telegram";
import { api, type ProgramaTV } from "@/lib/api";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "Empire TV" },
      { name: "description", content: "Empire TV — transmissões ao vivo do Empire." },
    ],
  }),
  component: TvPage,
});

const CHAT_STORAGE_KEY = "empire_tv_chat_v1";

type Programa = ProgramaTV;

const FALLBACK: Programa[] = [
  {
    id: "empire-live",
    titulo: "Empire ao Vivo",
    subtitulo: "Programação 24h do Empire — shows, prêmios e bastidores",
    categoria: "Variedades",
    ao_vivo: true,
    espectadores: 1284,
    cover:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&q=80&auto=format&fit=crop",
    stream_url: "https://player.kick.com/empire?autoplay=true&muted=false",
  },
];

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  ts: number;
  color: string;
}

const NAME_COLORS = [
  "text-rose-400", "text-amber-400", "text-emerald-400", "text-sky-400",
  "text-violet-400", "text-pink-400", "text-orange-400", "text-teal-400",
];

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

function TvPage() {
  const [watching, setWatching] = useState<Programa | null>(null);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.listarProgramasTV()
      .then((list) => alive && setProgramas(list.length > 0 ? list : FALLBACK))
      .catch(() => alive && setProgramas(FALLBACK))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return (
    <div
      className={`fixed inset-0 bg-background text-foreground overflow-hidden transition-all ${
        watching ? "z-[70]" : "top-[calc(4rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))]"
      }`}
    >
      {watching ? (
        <WatchView programa={watching} onBack={() => setWatching(null)} />
      ) : (
        <BrowseView programas={programas} loading={loading} onPlay={setWatching} />
      )}
    </div>
  );
}

// ---------- Netflix-style browse ----------
function BrowseView({ onPlay }: { onPlay: (p: Programa) => void }) {
  const featured = PROGRAMAS[0];
  return (
    <div className="h-full overflow-y-auto">
      {/* Hero */}
      <div className="relative w-full h-[55vh] min-h-[320px] overflow-hidden">
        <img
          src={featured.cover}
          alt={featured.titulo}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />

        <div className="relative h-full flex flex-col justify-end p-6 max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <img src={logoIcon} alt="Empire" className="size-7 rounded-md object-contain" />
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
              Empire TV
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">{featured.titulo}</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-xl">
            {featured.subtitulo}
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs">
            {featured.ao_vivo && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 font-bold">
                <Radio className="size-3 animate-pulse" /> AO VIVO
              </span>
            )}
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="size-3" /> {featured.espectadores.toLocaleString("pt-BR")}
            </span>
            <span className="text-muted-foreground">• {featured.categoria}</span>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => onPlay(featured)}
              className="h-11 px-6 rounded-md bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2 hover:bg-primary/90 transition"
            >
              <Play className="size-4 fill-current" /> Assistir agora
            </button>
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="px-4 py-6 space-y-8">
        <ProgramRow title="No ar agora" programas={PROGRAMAS} onPlay={onPlay} />
        <ProgramRow title="Em breve no Empire" programas={[]} onPlay={onPlay} />
      </div>
    </div>
  );
}

function ProgramRow({
  title, programas, onPlay,
}: {
  title: string; programas: Programa[]; onPlay: (p: Programa) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h2>
      {programas.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">Em breve.</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {programas.map((p) => (
            <button
              key={p.id}
              onClick={() => onPlay(p)}
              className="snap-start shrink-0 w-64 group text-left"
            >
              <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
                <img src={p.cover} alt={p.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                {p.ao_vivo && (
                  <span className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold">
                    <Radio className="size-2.5" /> LIVE
                  </span>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Play className="size-10 opacity-0 group-hover:opacity-100 transition-opacity text-white fill-white" />
                </div>
              </div>
              <div className="mt-2 text-sm font-semibold truncate">{p.titulo}</div>
              <div className="text-xs text-muted-foreground truncate">{p.categoria}</div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Twitch-style watch view ----------
function WatchView({ programa, onBack }: { programa: Programa; onBack: () => void }) {
  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Video + meta column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean top bar: back + title + viewers */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border/60 bg-background/90 backdrop-blur shrink-0">
          <button
            onClick={onBack}
            className="size-8 rounded-md hover:bg-muted flex items-center justify-center"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">
            {programa.titulo}
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Users className="size-3" />
            {programa.espectadores.toLocaleString("pt-BR")}
          </span>
        </div>

        {/* Video (16:9) */}
        <div className="w-full bg-black" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={programa.stream_url}
            title={programa.titulo}
            className="w-full h-full border-0 block"
            allow="autoplay; camera; microphone; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>

        {/* Mobile-only meta below video */}
        <div className="lg:hidden px-4 py-3 border-b border-border/60">
          <div className="text-sm font-semibold">{programa.titulo}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-3" />
            {programa.espectadores.toLocaleString("pt-BR")} assistindo
          </div>
        </div>
      </div>

      {/* Chat (sidebar on desktop, stacked on mobile) */}
      <div className="flex-1 lg:flex-none lg:w-[340px] border-t lg:border-t-0 lg:border-l border-border flex flex-col min-h-0 bg-card/30">
        <ChatPanel programaId={programa.id} />
      </div>
    </div>
  );
}

function ChatPanel({ programaId }: { programaId: string }) {
  const { user } = useTelegramUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const displayName = user?.name || "Anônimo";
  const storageKey = `${CHAT_STORAGE_KEY}_${programaId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setMessages(JSON.parse(raw));
      else setMessages([]);
    } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-200))); } catch { /* ignore */ }
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, storageKey]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      user: displayName,
      text: t.slice(0, 300),
      ts: Date.now(),
      color: colorFor(displayName),
    };
    setMessages((m) => [...m, msg]);
    setText("");
  };

  return (
    <>
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Chat do programa
        </span>
        <span className="text-[10px] text-muted-foreground">{displayName}</span>
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 text-sm">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-xs text-center px-6">
            Seja o primeiro a comentar.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="leading-snug break-words">
              <span className={`font-bold ${m.color}`}>{m.user}</span>
              <span className="text-muted-foreground">: </span>
              <span className="text-foreground">{m.text}</span>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-center gap-2 px-3 py-2 border-t border-border bg-background"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mandar mensagem"
          maxLength={300}
          className="flex-1 h-9 px-3 rounded-md bg-muted text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1 disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
    </>
  );
}
