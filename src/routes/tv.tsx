import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Radio, Users, Play, ArrowLeft, Calendar, MessageSquare, Info, Archive, ListVideo, Clock, X, Reply } from "lucide-react";
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

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  ts: number;
  color: string;
  reply_to?: { id: string; user: string; text: string };
}

type HomeTab = "home" | "arquivo" | "grade";
type WatchTab = "chat" | "participantes" | "sobre";

const NAME_COLORS = [
  "text-rose-400", "text-amber-400", "text-emerald-400", "text-sky-400",
  "text-violet-400", "text-pink-400", "text-orange-400", "text-teal-400",
];

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

// "DD/MM/YYYY HH:mm" → Date
function parseProgramDate(p: Programa): Date | null {
  const s = (p.data_inicio || `${p.data || ""} ${p.horario || ""}`).trim();
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
}

function TvPage() {
  const [watching, setWatching] = useState<Programa | null>(null);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.listarProgramasTV()
      .then((list) => alive && setProgramas(list))
      .catch(() => alive && setProgramas([]))
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

// ---------- BrowseView (home + arquivo + grade) ----------
function BrowseView({ programas, loading, onPlay }: { programas: Programa[]; loading: boolean; onPlay: (p: Programa) => void }) {
  const [tab, setTab] = useState<HomeTab>("home");

  const aoVivo = useMemo(() => programas.filter((p) => p.ao_vivo), [programas]);
  const agora = Date.now();
  const futuros = useMemo(() => {
    return programas
      .filter((p) => !p.ao_vivo && !p.finalizado)
      .map((p) => ({ p, d: parseProgramDate(p) }))
      .filter((x) => !x.d || x.d.getTime() > agora)
      .sort((a, b) => (a.d?.getTime() || 0) - (b.d?.getTime() || 0))
      .map((x) => x.p);
  }, [programas, agora]);
  const finalizados = useMemo(() => {
    return programas
      .filter((p) => p.finalizado)
      .map((p) => ({ p, d: parseProgramDate(p) }))
      .sort((a, b) => (b.d?.getTime() || 0) - (a.d?.getTime() || 0))
      .map((x) => x.p);
  }, [programas]);

  // por categoria (pra montar as fileiras tipo "catálogo")
  const porCategoria = useMemo(() => {
    const map = new Map<string, Programa[]>();
    for (const p of programas) {
      const k = (p.categoria || "Outros").trim() || "Outros";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries()).filter(([, arr]) => arr.length > 0);
  }, [programas]);

  const featured = aoVivo[0] || futuros[0] || finalizados[0] || programas[0] || null;
  const featuredKind: "live" | "next" | "past" | null = !featured
    ? null
    : aoVivo[0]
    ? "live"
    : futuros[0]
    ? "next"
    : "past";

  const tabs: { id: HomeTab; label: string; icon: typeof MessageSquare }[] = [
    { id: "home", label: "Início", icon: Play },
    { id: "grade", label: "Grade", icon: ListVideo },
    { id: "arquivo", label: "Arquivo", icon: Archive },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-3 h-11 border-b border-border/60 shrink-0 overflow-x-auto bg-background/95 backdrop-blur">
        <img src={logoIcon} alt="Empire" className="size-6 rounded object-contain mr-1" />
        <span className="text-xs uppercase tracking-[0.18em] font-bold text-muted-foreground mr-2">Empire TV</span>
        <div className="ml-auto flex items-center gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`h-8 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                <Icon className="size-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "home" && (
          <HomeTabView
            loading={loading}
            featured={featured}
            featuredKind={featuredKind}
            aoVivo={aoVivo}
            futuros={futuros}
            finalizados={finalizados}
            porCategoria={porCategoria}
            onPlay={onPlay}
          />
        )}
        {tab === "grade" && <GradeFull programas={futuros} onPlay={onPlay} loading={loading} />}
        {tab === "arquivo" && <ArquivoFull finalizados={finalizados} loading={loading} />}
      </div>
    </div>
  );
}

function HomeTabView({
  loading, featured, featuredKind, aoVivo, futuros, finalizados, porCategoria, onPlay,
}: {
  loading: boolean;
  featured: Programa | null;
  featuredKind: "live" | "next" | "past" | null;
  aoVivo: Programa[];
  futuros: Programa[];
  finalizados: Programa[];
  porCategoria: Array<[string, Programa[]]>;
  onPlay: (p: Programa) => void;
}) {
  if (loading && !featured) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-10">Carregando catálogo...</div>;
  }
  if (!featured) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground p-10 text-center gap-2">
        <span>O catálogo ainda não chegou.</span>
        <span className="text-xs">Verifique se o Apps Script foi republicado com a ação <code>listar_programas_tv</code>.</span>
      </div>
    );
  }

  const badge =
    featuredKind === "live"
      ? { cls: "bg-red-500/20 text-red-400", icon: <Radio className="size-3 animate-pulse" />, label: "AO VIVO" }
      : featuredKind === "next"
      ? { cls: "bg-amber-500/20 text-amber-400", icon: <Clock className="size-3" />, label: "PRÓXIMA ATRAÇÃO" }
      : { cls: "bg-zinc-500/20 text-zinc-300", icon: <Archive className="size-3" />, label: "EM CATÁLOGO" };

  return (
    <>
      <div className="relative w-full h-[55vh] min-h-[320px] overflow-hidden">
        {featured.cover ? (
          <img src={featured.cover} alt={featured.titulo} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-muted" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />
        <div className="relative h-full flex flex-col justify-end p-6 max-w-2xl">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold w-fit mb-2 ${badge.cls}`}>
            {badge.icon} {badge.label}
          </span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">{featured.titulo}</h1>
          {featured.subtitulo && <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-xl">{featured.subtitulo}</p>}
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {featured.categoria && <span>{featured.categoria}</span>}
            {featured.data_inicio && (<><span>•</span><span className="flex items-center gap-1"><Calendar className="size-3" /> {featured.data_inicio}</span></>)}
          </div>
          {featuredKind !== "next" && (
            <div className="mt-5 flex items-center gap-3">
              <button onClick={() => onPlay(featured)} className="h-11 px-6 rounded-md bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2 hover:bg-primary/90 transition">
                <Play className="size-4 fill-current" /> {featuredKind === "live" ? "Assistir agora" : "Assistir"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-6 space-y-8">
        {aoVivo.length > 0 && <ProgramRow title="No ar agora" programas={aoVivo} onPlay={onPlay} />}
        {futuros.length > 0 && <ProgramRow title="Em breve" programas={futuros} onPlay={onPlay} showSchedule />}
        {finalizados.length > 0 && <ProgramRow title="Já passou" programas={finalizados} onPlay={onPlay} showSchedule />}
        {porCategoria.map(([cat, arr]) => (
          <ProgramRow key={cat} title={cat} programas={arr} onPlay={onPlay} />
        ))}
      </div>
    </>
  );
}

function ProgramRow({ title, programas, onPlay, showSchedule, emptyText }: {
  title: string; programas: Programa[]; onPlay: (p: Programa) => void; showSchedule?: boolean; emptyText?: string;
}) {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
      {programas.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">{emptyText || "Em breve."}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {programas.map((p) => (
            <button key={p.id} onClick={() => onPlay(p)} className="snap-start shrink-0 w-64 group text-left">
              <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
                {p.cover ? (
                  <img src={p.cover} alt={p.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-muted" />
                )}
                {p.ao_vivo && (
                  <span className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold">
                    <Radio className="size-2.5" /> LIVE
                  </span>
                )}
                {showSchedule && p.data_inicio && (
                  <span className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-semibold">
                    <Calendar className="size-2.5" /> {p.data_inicio}
                  </span>
                )}
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

function GradeFull({ programas, onPlay, loading }: { programas: Programa[]; onPlay: (p: Programa) => void; loading: boolean }) {
  if (loading && programas.length === 0) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  if (programas.length === 0) return <div className="p-6 text-sm text-muted-foreground italic">Sem programas agendados.</div>;
  return (
    <div className="p-4 space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Grade — próximas atrações</h2>
      {programas.map((p) => (
        <button key={p.id} onClick={() => onPlay(p)} className="w-full flex gap-3 p-2 rounded-md hover:bg-muted text-left">
          <div className="w-28 aspect-video rounded overflow-hidden bg-muted shrink-0">
            {p.cover && <img src={p.cover} alt={p.titulo} className="w-full h-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{p.titulo}</div>
            <div className="text-xs text-muted-foreground truncate">{p.subtitulo || p.categoria}</div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="size-3" /> {p.data_inicio}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ArquivoFull({ finalizados, loading }: { finalizados: Programa[]; loading: boolean }) {
  const [chatRows, setChatRows] = useState<Array<{ data: string; hora: string; sala: string; total_msgs: number }>>([]);
  const [loadChat, setLoadChat] = useState(true);
  useEffect(() => {
    let alive = true;
    api.listarArquivoTV().then((r) => alive && setChatRows(r)).catch(() => {}).finally(() => alive && setLoadChat(false));
    return () => { alive = false; };
  }, []);
  const chatByPrograma = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of chatRows) m.set(r.sala, r.total_msgs);
    return m;
  }, [chatRows]);

  if (loading && finalizados.length === 0) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  if (finalizados.length === 0) return <div className="p-6 text-sm text-muted-foreground italic">Sem transmissões finalizadas.</div>;
  return (
    <div className="p-4 space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Arquivo — transmissões passadas</h2>
      {finalizados.map((p) => (
        <div key={p.id} className="flex gap-3 p-2 rounded-md hover:bg-muted">
          <div className="w-28 aspect-video rounded overflow-hidden bg-muted shrink-0">
            {p.cover && <img src={p.cover} alt={p.titulo} className="w-full h-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{p.titulo}</div>
            <div className="text-xs text-muted-foreground truncate">{p.subtitulo || p.categoria}</div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="size-3" /> {p.data_inicio}</span>
              {chatByPrograma.has(p.id) && (
                <span className="flex items-center gap-1"><MessageSquare className="size-3" /> {chatByPrograma.get(p.id)} msgs</span>
              )}
            </div>
          </div>
        </div>
      ))}
      {loadChat && <div className="text-[11px] text-muted-foreground mt-2">Carregando chats arquivados...</div>}
    </div>
  );
}

// ---------- WatchView (chat + participantes + sobre) ----------
function WatchView({ programa, onBack }: { programa: Programa; onBack: () => void }) {
  const { user } = useTelegramUser();
  const [tab, setTab] = useState<WatchTab>("chat");

  // Heartbeat de presença
  useEffect(() => {
    if (!user?.id) return;
    const start = Date.now();
    let accumulated = 0;
    let lastTick = start;
    let visible = !document.hidden;

    const onVis = () => {
      if (document.hidden) {
        if (visible) accumulated += Math.floor((Date.now() - lastTick) / 1000);
        visible = false;
      } else {
        visible = true;
        lastTick = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const send = (extraSeconds = 0) => {
      const total = accumulated + extraSeconds;
      if (total < 5) return;
      api.registrarPresencaTV({
        programa_id: programa.id,
        telegram_id: user.id,
        nome: user.name || "Anônimo",
        watched_seconds: total,
      }).catch(() => {});
    };

    const interval = setInterval(() => {
      if (visible) {
        const now = Date.now();
        accumulated += Math.floor((now - lastTick) / 1000);
        lastTick = now;
        send();
      }
    }, 30_000);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
      const extra = visible ? Math.floor((Date.now() - lastTick) / 1000) : 0;
      send(extra);
    };
  }, [programa.id, user?.id, user?.name]);

  const tabs: { id: WatchTab; label: string; icon: typeof MessageSquare }[] = [
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "participantes", label: "Participantes", icon: Users },
    { id: "sobre", label: "Sobre", icon: Info },
  ];

  return (
    <div className="h-full flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border/60 bg-background/90 backdrop-blur shrink-0">
          <button onClick={onBack} className="size-8 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Voltar">
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">{programa.titulo}</div>
          {programa.ao_vivo && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold shrink-0">
              <Radio className="size-2.5 animate-pulse" /> LIVE
            </span>
          )}
        </div>

        <div className="w-full bg-black" style={{ aspectRatio: "16 / 9" }}>
          {programa.stream_url ? (
            <iframe
              src={programa.stream_url}
              title={programa.titulo}
              className="w-full h-full border-0 block"
              allow="autoplay; camera; microphone; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              Sem URL de transmissão.
            </div>
          )}
        </div>

        <div className="lg:hidden px-4 py-3 border-b border-border/60">
          <div className="text-sm font-semibold">{programa.titulo}</div>
          {programa.subtitulo && <div className="text-xs text-muted-foreground mt-0.5">{programa.subtitulo}</div>}
        </div>
      </div>

      <div className="flex-1 lg:flex-none lg:w-[360px] border-t lg:border-t-0 lg:border-l border-border flex flex-col min-h-0 bg-card/30">
        <div className="flex items-center gap-1 px-2 h-10 border-b border-border shrink-0 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 h-8 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                <Icon className="size-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          {tab === "chat" && <ChatPanel programaId={programa.id} />}
          {tab === "participantes" && <ParticipantesPanel programa={programa} />}
          {tab === "sobre" && <SobrePanel programa={programa} />}
        </div>
      </div>
    </div>
  );
}

// ---------- Chat (com reply) ----------
function ChatPanel({ programaId }: { programaId: string }) {
  const { user } = useTelegramUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayName = user?.name || "Anônimo";
  const storageKey = `${CHAT_STORAGE_KEY}_${programaId}`;
  const lastSavedCount = useRef(0);

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

  const flush = useCallback(() => {
    if (messages.length === 0 || messages.length === lastSavedCount.current) return;
    lastSavedCount.current = messages.length;
    api.salvarChatTV({
      programa_id: programaId,
      total_msgs: messages.length,
      mensagens: messages.map((m) => ({ user: m.user, text: m.text, ts: m.ts, reply_to: m.reply_to })),
    }).catch(() => {});
  }, [messages, programaId]);

  useEffect(() => {
    if (messages.length - lastSavedCount.current >= 10) flush();
  }, [messages, flush]);

  useEffect(() => () => { flush(); }, [flush]);

  const startReply = (m: ChatMessage) => {
    setReplyTo(m);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      user: displayName,
      text: t.slice(0, 300),
      ts: Date.now(),
      color: colorFor(displayName),
      reply_to: replyTo ? { id: replyTo.id, user: replyTo.user, text: replyTo.text.slice(0, 80) } : undefined,
    };
    setMessages((m) => [...m, msg]);
    setText("");
    setReplyTo(null);
  };

  const scrollToMsg = (id: string) => {
    const el = document.getElementById(`tvmsg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-1", "ring-primary");
      setTimeout(() => el.classList.remove("ring-1", "ring-primary"), 1200);
    }
  };

  return (
    <>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 text-sm">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-xs text-center px-6">
            Seja o primeiro a comentar.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} id={`tvmsg-${m.id}`} className="group leading-snug break-words rounded px-1 py-0.5 -mx-1">
              {m.reply_to && (
                <button
                  type="button"
                  onClick={() => scrollToMsg(m.reply_to!.id)}
                  className="block w-full text-left mb-0.5 pl-2 border-l-2 border-primary/50 text-[11px] text-muted-foreground hover:bg-muted/50 rounded-r"
                >
                  <span className="font-semibold text-primary/80">{m.reply_to.user}</span>: {m.reply_to.text}
                </button>
              )}
              <span className={`font-bold ${m.color}`}>{m.user}</span>
              <span className="text-muted-foreground">: </span>
              <span className="text-foreground">{m.text}</span>
              <button
                type="button"
                onClick={() => startReply(m)}
                className="ml-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition"
                aria-label="Responder"
              >
                <Reply className="inline size-3" />
              </button>
            </div>
          ))
        )}
      </div>

      {replyTo && (
        <div className="flex items-start gap-2 px-3 py-1.5 border-t border-border bg-muted/40 text-[11px]">
          <Reply className="size-3 mt-0.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-muted-foreground">Respondendo a <span className={`font-semibold ${colorFor(replyTo.user)}`}>{replyTo.user}</span></div>
            <div className="truncate text-foreground/80">{replyTo.text}</div>
          </div>
          <button type="button" onClick={() => setReplyTo(null)} className="shrink-0 hover:text-foreground text-muted-foreground" aria-label="Cancelar resposta">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-center gap-2 px-3 py-2 border-t border-border bg-background"
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={replyTo ? `Responder a ${replyTo.user}...` : "Mandar mensagem"}
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

// ---------- Participantes ----------
function ParticipantesPanel({ programa }: { programa: Programa }) {
  const [rows, setRows] = useState<Array<{ telegram_id: string; nome: string; watched_seconds: number; percentual: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () => {
      api.listarPresencaTV(programa.id)
        .then((r) => { if (alive) setRows(r); })
        .catch(() => {})
        .finally(() => { if (alive) setLoading(false); });
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [programa.id]);

  const sorted = useMemo(() => [...rows].sort((a, b) => b.watched_seconds - a.watched_seconds), [rows]);

  return (
    <div className="flex-1 overflow-y-auto p-3">
      {loading && rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">Carregando...</div>
      ) : sorted.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">Ninguém registrado ainda.</div>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((p) => (
            <li key={p.telegram_id} className="flex items-center justify-between text-sm">
              <span className={`font-semibold truncate ${colorFor(p.nome)}`}>{p.nome}</span>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">
                {p.percentual > 0 ? `${p.percentual.toFixed(0)}%` : fmtMin(p.watched_seconds)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmtMin(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}min` : `${s}s`;
}

// ---------- Sobre ----------
function SobrePanel({ programa }: { programa: Programa }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
      <h3 className="text-base font-bold">{programa.titulo}</h3>
      {programa.categoria && (
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{programa.categoria}</div>
      )}
      {programa.subtitulo && <p className="text-muted-foreground">{programa.subtitulo}</p>}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {programa.ao_vivo && (
          <span className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/15 text-red-400 font-bold">
            <Radio className="size-3 animate-pulse" /> AO VIVO
          </span>
        )}
        {programa.data_inicio && (
          <span className="flex items-center gap-1 px-2 py-1 rounded bg-muted">
            <Calendar className="size-3" /> {programa.data_inicio}
          </span>
        )}
        {programa.buff && (
          <span className="px-2 py-1 rounded bg-muted">Buff: {programa.buff}</span>
        )}
      </div>
    </div>
  );
}
