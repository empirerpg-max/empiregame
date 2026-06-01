import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Tv, Loader2, ChevronLeft, ChevronRight, ArrowLeft,
  MessageCircle, Play, Clock, ChevronDown,
  Music2, Film, Zap, LayoutGrid, CalendarDays, Trophy, Users,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTelegramUser } from "@/lib/telegram";
import {
  tvApi, buildProgramEntries, getProgramStatus,
  buildPlayerSrc, driveImgUrl,
  KICK_CHANNEL,
  type TvStatus, type TvProgram, type ParticipacaoItem, type ProgramEntry, type ChatMsg
} from "@/lib/empiretv";
import { Send } from "lucide-react";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "Empire TV — Programação" },
      { name: "description", content: "Grade de programação da Empire TV." },
    ],
  }),
  component: TvPage,
});


const DIAS_PT  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function parseDataBR(str: string): Date | null {
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDataLabel(str: string) {
  const d = parseDataBR(str);
  if (!d) return { diaSemana: "—", dia: str, mes: "" };
  return { diaSemana: DIAS_PT[d.getDay()], dia: String(d.getDate()).padStart(2, "0"), mes: MESES_PT[d.getMonth()] };
}

function fmtTime(v?: string | number) {
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") {
    return `${String(Math.floor(v / 3600)).padStart(2, "0")}:${String(Math.floor((v % 3600) / 60)).padStart(2, "00")}`;
  }
  const m = String(v).match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return String(v);
}

function checkIsLive(current: TvProgram | null, entry: ProgramEntry): boolean {
  if (!current) return false;
  const s = String(current.status || "").toLowerCase();
  const isLiveStatus = s === "broadcasting" || s === "transmitindo" || s === "live" || s === "ao vivo";
  if (entry.rowNums.length > 0) {
    return isLiveStatus && entry.rowNums.includes(current.rowNum ?? -1);
  }
  return isLiveStatus;
}

function kickEmbedUrl(): string {
  const parent = typeof window !== "undefined"
    ? encodeURIComponent(window.location.hostname)
    : "empirehub.app";
  return `https://player.kick.com/${KICK_CHANNEL}?autoplay=true&muted=false&parent=${parent}`;
}

// ─── MEDAL ───────────────────────────────────────────────────────────────────
function Medal({ pos }: { pos: number }) {
  if (pos === 1) return <span className="text-base">🥇</span>;
  if (pos === 2) return <span className="text-base">🥈</span>;
  if (pos === 3) return <span className="text-base">🥉</span>;
  return <span className="text-xs font-black text-muted-foreground w-5 text-center">{pos}</span>;
}

// ─── RANKING ─────────────────────────────────────────────────────────────────
function RankingParticipacao({ programa, currentUserId }: { programa: string; currentUserId?: string }) {
  const [items, setItems]     = useState<ParticipacaoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programa) return;
    setLoading(true);
    tvApi.participacao(programa)
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    const id = setInterval(() => {
      tvApi.participacao(programa).then(data => setItems(Array.isArray(data) ? data : [])).catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [programa]);

  if (loading) return <div className="flex items-center justify-center py-6"><Loader2 className="size-4 animate-spin text-primary" /></div>;
  if (items.length === 0) return (
    <div className="text-center py-6 space-y-1">
      <Users className="size-5 text-muted-foreground mx-auto" />
      <p className="text-[11px] text-muted-foreground">Nenhuma participação ainda hoje.</p>
    </div>
  );

  const sorted = [...items].sort((a, b) => (b.mensagens || 0) - (a.mensagens || 0));
  const total  = sorted.reduce((acc, i) => acc + (i.mensagens || 0), 0);

  return (
    <div className="space-y-1.5">
      {sorted.map((item, idx) => {
        const pct  = total > 0 ? Math.round((item.mensagens / total) * 100) : 0;
        const isMe = currentUserId && String(item.tgId) === String(currentUserId);
        return (
          <motion.div key={item.tgId + idx} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
            className={`relative flex items-center gap-2.5 px-3 py-2 rounded-xl overflow-hidden ${isMe ? "border border-primary/40 bg-primary/10" : "bg-white/5"}`}
          >
            <div className="absolute inset-y-0 left-0 rounded-xl transition-all duration-700"
              style={{ width: `${pct}%`, background: isMe ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.04)" }} />
            <div className="relative flex items-center gap-2.5 w-full">
              <Medal pos={idx + 1} />
              <p className={`flex-1 text-xs font-bold truncate ${isMe ? "text-primary" : ""}`}>{item.nome}{isMe ? " (você)" : ""}</p>
              <span className="text-[10px] text-muted-foreground shrink-0">{item.mensagens} msg</span>
              <span className={`text-[10px] font-black shrink-0 ${isMe ? "text-primary" : "text-white/60"}`}>{pct}%</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── NOW PLAYING BAR ─────────────────────────────────────────────────────────
function NowPlayingBar({ current }: { current: TvProgram | null }) {
  if (!current || (!current.tipo && !current.material && !current.buff)) return null;
  return (
    <motion.div key={`${current.rowNum}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm"
    >
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/90 text-white text-[9px] font-black uppercase tracking-widest shrink-0">
        <span className="size-1.5 rounded-full bg-white animate-pulse" /> Ao vivo agora
      </span>
      {current.tipo && (
        <span className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide">
          <Film className="size-3.5 shrink-0" />{current.tipo}
        </span>
      )}
      {current.tipo && current.material && <span className="text-white/20">•</span>}
      {current.material && (
        <span className="flex items-center gap-1.5 text-xs text-white/70 font-medium">
          <Music2 className="size-3.5 shrink-0 text-white/40" />{current.material}
        </span>
      )}
      {current.buff && (
        <>
          <span className="text-white/20">•</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[9px] font-black uppercase tracking-wide">
            <Zap className="size-3 shrink-0" />{current.buff}
          </span>
        </>
      )}
    </motion.div>
  );
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function StatusBadge({ live, upcoming }: { live?: boolean; upcoming?: boolean }) {
  if (live) return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase tracking-widest">
      <span className="size-1.5 rounded-full bg-white animate-pulse" />Ao vivo
    </span>
  );
  if (upcoming) return (
    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-black uppercase tracking-widest">Em breve</span>
  );
  return null;
}

// ─── PROGRAM CARD ─────────────────────────────────────────────────────────────
function ProgramCard({ entry, onSelect }: { entry: ProgramEntry; onSelect: () => void }) {
  const capa = driveImgUrl(entry.capaUrl);
  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-white/5 transition-colors text-left group"
    >
      <div className="size-16 rounded-xl overflow-hidden bg-black/40 shrink-0 relative">
        {capa ? (
          <img src={capa} alt={entry.programa} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/20 to-black">
            <Tv className="size-5 text-primary/50" />
          </div>
        )}
        {entry.hasLive && (
          <div className="absolute inset-0 grid place-items-center bg-black/30">
            <Play className="size-5 text-white drop-shadow" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-black text-sm truncate">{entry.programa}</p>
          {entry.hasLive && <StatusBadge live />}
        </div>
        {entry.data && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock className="size-3" />
            <span>{entry.data}{entry.horario ? ` às ${fmtTime(entry.horario)}` : ""}</span>
          </div>
        )}
      </div>
      <ChevronDown className="size-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
    </motion.button>
  );
}

// ─── PLANNER ──────────────────────────────────────────────────────────────────
function PlannerView({ entries, onSelect }: {
  entries: ProgramEntry[];
  onSelect: (e: ProgramEntry) => void;
}) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const datesWithEvents = new Set(
    entries.map(e => {
      const d = parseDataBR(e.data);
      if (!d) return null;
      return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
    }).filter(Boolean)
  );

  const todayStr = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;
  const [selectedDate, setSelectedDate] = useState<string>(
    datesWithEvents.has(todayStr) ? todayStr : (Array.from(datesWithEvents)[0] as string ?? "")
  );

  function navMonth(dir: number) {
    let m = month + dir, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }

  const dayEntries = selectedDate
    ? entries.filter(e => {
        const d = parseDataBR(e.data);
        if (!d) return false;
        return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}` === selectedDate;
      })
    : [];

  return (
    <div className="grid lg:grid-cols-[280px,1fr] gap-6">
      <div className="rounded-3xl border border-border bg-card p-4 select-none h-fit">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navMonth(-1)} className="size-7 rounded-lg hover:bg-white/10 grid place-items-center transition-colors"><ChevronLeft className="size-4" /></button>
          <p className="text-xs font-black uppercase tracking-widest">{MESES_PT[month]} {year}</p>
          <button onClick={() => navMonth(1)} className="size-7 rounded-lg hover:bg-white/10 grid place-items-center transition-colors"><ChevronRight className="size-4" /></button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {DIAS_PT.map(d => <div key={d} className="text-center text-[9px] font-black text-muted-foreground py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day     = i + 1;
            const dateStr = `${String(day).padStart(2,"0")}/${String(month+1).padStart(2,"0")}/${year}`;
            const hasEvent = datesWithEvents.has(dateStr);
            const isToday  = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
            const isSel    = selectedDate === dateStr;
            return (
              <button key={day} onClick={() => hasEvent && setSelectedDate(dateStr)} disabled={!hasEvent}
                className={`relative h-8 rounded-lg text-xs font-bold transition-colors
                  ${isSel ? "bg-primary text-primary-foreground" : ""}
                  ${isToday && !isSel ? "border border-primary text-primary" : ""}
                  ${hasEvent && !isSel ? "hover:bg-white/10" : ""}
                  ${!hasEvent ? "text-muted-foreground/30 cursor-default" : "cursor-pointer"}`}
              >
                {day}
                {hasEvent && !isSel && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
        {selectedDate && (() => {
          const { diaSemana, dia, mes } = fmtDataLabel(selectedDate);
          return (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{diaSemana}</p>
              <p className="text-lg font-black">{dia} <span className="text-muted-foreground font-medium text-sm">{mes}</span></p>
              <p className="text-[10px] text-muted-foreground mt-1">{dayEntries.length} programa{dayEntries.length !== 1 ? "s" : ""}</p>
            </div>
          );
        })()}
      </div>
      <div className="space-y-3">
        {dayEntries.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
            <CalendarDays className="size-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Selecione uma data com programação</p>
          </div>
        )}
        {dayEntries.map((entry, i) => (
          <motion.div key={entry.programa + entry.data} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
            <ProgramCard entry={entry} onSelect={() => onSelect(entry)} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── KICK PLAYER ─────────────────────────────────────────────────────────────
function KickPlayer({ programa }: { programa: string }) {
  const [failed, setFailed] = useState(false);
  const src = kickEmbedUrl();

  if (failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-4">
        <Tv className="size-10 text-primary/60" />
        <p className="text-sm font-black text-white uppercase tracking-widest">Transmissão ao vivo</p>
        <a
          href={`https://kick.com/${KICK_CHANNEL}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-black hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="size-4" /> Abrir no Kick
        </a>
        <p className="text-[10px] text-white/30 max-w-[200px] text-center">
          O embed pode ser bloqueado em alguns navegadores. Abra direto no Kick para assistir.
        </p>
      </div>
    );
  }

  return (
    <iframe
      key={src}
      src={src}
      title={programa}
      className="absolute inset-0 w-full h-full border-0"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      onError={() => setFailed(true)}
    />
  );
}

// ─── LIVE CHAT ────────────────────────────────────────────────────────────────
const CHAT_WS_URL   = "wss://empiretv-chat-backend.onrender.com";
const CHAT_PING_URL = "https://empiretv-chat-backend.onrender.com/ping";
const WS_CONNECT_TIMEOUT_MS = 12_000;

function LiveChat({ programa, topicoId, user }: {
  programa: string;
  topicoId: string;
  user: ReturnType<typeof useTelegramUser>["user"];
}) {
  const [msgs, setMsgs]         = useState<ChatMsg[]>([]);
  const [loading, setLoading]   = useState(true);
  const [wsError, setWsError]   = useState(false);
  const [texto, setTexto]       = useState("");
  const [sending, setSending]   = useState(false);
  const scrollRef               = useRef<HTMLDivElement>(null);
  const wsRef                   = useRef<WebSocket | null>(null);

  // FIX 3: guard — não rola durante abertura do teclado no Telegram WebApp
  const inputFocusedRef         = useRef(false);

  // FIX 1: nome em ref para não ser dependência do useEffect
  // Evita recriar o socket toda vez que useTelegramUser() re-renderiza com novo objeto user
  const nomeRef                 = useRef(user?.name || "Jogador");
  useEffect(() => { nomeRef.current = user?.name || "Jogador"; });

  function scrollBottom() {
    // FIX 3: não rola enquanto o teclado virtual está abrindo
    if (inputFocusedRef.current) return;
    requestAnimationFrame(() => {
      try {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      } catch {}
    });
  }

  function buildSocket(roomId: string, userId: string, onReady?: () => void) {
    const ws = new WebSocket(CHAT_WS_URL);
    wsRef.current = ws;
    let destroyed = false;

    const connectTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        if (!destroyed) { setLoading(false); setWsError(true); }
      }
    }, WS_CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      clearTimeout(connectTimeout);
      ws.send(JSON.stringify({ type: "join", roomId, userId, nome: nomeRef.current }));
      onReady?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "history" && Array.isArray(data.messages)) {
          setMsgs(data.messages as ChatMsg[]);
          setLoading(false);
          scrollBottom();
        }

        if (data.type === "message" && data.message) {
          const m = data.message as ChatMsg;
          setMsgs((prev) => {
            // remove otimista duplicado de outros usuários (não do remetente — o ACK cuida disso)
            return [...prev, m];
          });
          scrollBottom();
        }

        // FIX 4: trata message_ack — substitui mensagem otimista (tmp-) pelo id real do servidor
        // O backend envia ack só para o remetente; broadcast vai para os outros.
        // Sem isso, a mensagem otimista ficava presa com id "tmp-XXX" para sempre.
        if (data.type === "message_ack" && data.message) {
          const m = data.message as ChatMsg;
          setMsgs((prev) =>
            prev.map((p) =>
              p.id.startsWith("tmp-") && p.tgId === m.tgId && p.texto === m.texto
                ? m
                : p
            )
          );
        }
      } catch {
        // ignora erros de parse
      }
    };

    ws.onerror = () => {
      clearTimeout(connectTimeout);
      if (!destroyed) setLoading(false);
    };

    ws.onclose = () => {
      clearTimeout(connectTimeout);
      destroyed = true;
    };

    return () => {
      destroyed = true;
      clearTimeout(connectTimeout);
      try { ws.close(); } catch {}
    };
  }

  useEffect(() => {
    if (!topicoId || !user?.id) {
      setMsgs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setWsError(false);
    setMsgs([]);

    const roomId = String(topicoId);
    const userId = String(user.id);
    let cleanup: (() => void) | undefined;

    // FIX 2: ping HTTP antes do WebSocket — acorda o Render Free (cold start)
    // O Render dorme após 15min e pode travar o handshake WS por 30-90s no Telegram WebApp.
    // O ping HTTP é mais tolerante ao cold start; só abrimos o WS depois que ele responder.
    fetch(CHAT_PING_URL, { signal: AbortSignal.timeout(8_000) })
      .catch(() => {/* ignora — tenta o WS mesmo sem resposta do ping */})
      .finally(() => { cleanup = buildSocket(roomId, userId); });

    return () => { cleanup?.(); wsRef.current = null; };

    // FIX 1: user?.name REMOVIDO das dependências
    // Era a causa principal do travamento: qualquer rerender do useTelegramUser()
    // com novo objeto user recriava o socket, disparava setLoading(true) + setMsgs([])
    // enquanto o usuário tentava digitar, bloqueando o input.
  }, [topicoId, user?.id]);

  async function enviar() {
    const t = texto.trim();
    if (!t || !user?.id || sending) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    setSending(true);
    const roomId = String(topicoId);
    const userId = String(user.id);

    // mensagem otimista — substituída pelo message_ack (FIX 4)
    const optimistic: ChatMsg = {
      id: "tmp-" + Date.now(),
      tgId: userId,
      nome: nomeRef.current,
      texto: t,
      tipo: "texto",
      gifUrl: "",
      data: new Date().toISOString(),
    };

    setMsgs((m) => [...m, optimistic]);
    setTexto("");
    scrollBottom();

    try {
      wsRef.current.send(JSON.stringify({
        type: "message", roomId, userId, nome: nomeRef.current, texto: t,
      }));
    } catch {
      // mantém otimista em caso de falha
    } finally {
      setSending(false);
    }
  }

  function handleRetry() {
    if (!user?.id || !topicoId) return;
    setWsError(false);
    setLoading(true);
    const roomId = String(topicoId);
    const userId = String(user.id);
    fetch(CHAT_PING_URL, { signal: AbortSignal.timeout(8_000) })
      .catch(() => {})
      .finally(() => { buildSocket(roomId, userId); });
  }

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <Loader2 className="size-4 animate-spin text-primary" />
            <p className="text-[10px] text-muted-foreground">Conectando ao chat…</p>
          </div>
        )}

        {!loading && wsError && (
          <div className="h-full grid place-items-center text-center px-4">
            <div className="space-y-2">
              <MessageCircle className="size-7 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">Chat temporariamente indisponível.</p>
              <button onClick={handleRetry} className="text-[10px] text-primary underline underline-offset-2">
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {!loading && !wsError && msgs.length === 0 && (
          <div className="h-full grid place-items-center text-center px-4">
            <div className="space-y-1.5">
              <MessageCircle className="size-7 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">Seja o primeiro a comentar.</p>
            </div>
          </div>
        )}

        {msgs.map((m) => {
          const isMe = user?.id && String(m.tgId) === String(user.id);
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMe ? "bg-primary text-primary-foreground" : "bg-white/5 border border-white/5"}`}>
                {!isMe && (
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary/80 mb-0.5">
                    {m.nome || "Anon"}
                  </p>
                )}
                {m.gifUrl ? (
                  <img src={m.gifUrl} alt="" className="rounded-lg max-h-40" />
                ) : (
                  <p className="text-sm leading-snug whitespace-pre-wrap break-words">
                    {m.texto}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); enviar(); }}
        className="p-3 border-t border-border flex items-center gap-2"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          // FIX 3: guard de foco para não conflitar scrollBottom com abertura do teclado
          onFocus={() => { inputFocusedRef.current = true; }}
          onBlur={() => { inputFocusedRef.current = false; }}
          placeholder={user?.id ? `Comentar como ${nomeRef.current}…` : "Entre pelo Telegram para comentar"}
          disabled={!user?.id || sending}
          maxLength={500}
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!user?.id || !texto.trim() || sending}
          className="size-10 grid place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </>
  );
}

// ─── SALA DO EVENTO ───────────────────────────────────────────────────────────
function EventRoom({
  entry, current, onBack
}: {
  entry: ProgramEntry;
  current: TvProgram | null;
  onBack?: () => void;
}) {
  const { user } = useTelegramUser();
  const participacaoRegistrada = useRef<Set<string>>(new Set());

  const isThisLive = checkIsLive(current, entry);
  const capaUrl    = driveImgUrl(isThisLive && current?.capaUrl ? String(current.capaUrl) : entry.capaUrl);

  useEffect(() => {
    if (!user?.id || !isThisLive || !current) return;
    const chave = `${user.id}_${entry.programa}_${current.topicoId || ""}`;
    if (participacaoRegistrada.current.has(chave)) return;
    participacaoRegistrada.current.add(chave);
    tvApi.registrarParticipacao({
      tgId: String(user.id),
      nome: user.name || "Jogador",
      programa: entry.programa,
      tipo: String(current.tipo || ""),
      topicoId: String(current.topicoId || ""),
      topicoUrl: String(current.topicoUrl || ""),
    });
  }, [user, isThisLive, current?.topicoId]);

  const topicoId = (isThisLive && current?.topicoId) ? String(current.topicoId) : entry.topicoId || "";
  const tabs = ["Chat", "Ranking"] as const;
  const [tab, setTab] = useState<typeof tabs[number]>("Chat");

  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Voltar
        </button>
      )}

      {/* Capa / Player */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
        {isThisLive ? (
          <KickPlayer programa={entry.programa} />
        ) : capaUrl ? (
          <img src={capaUrl} alt={entry.programa} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary/20 to-black">
            <Tv className="size-12 text-primary/40" />
          </div>
        )}
      </div>

      {/* Info do programa */}
      <div className="space-y-2">
        <div className="flex items-start gap-3 flex-wrap">
          <h2 className="font-black text-xl flex-1">{entry.programa}</h2>
          {isThisLive && <StatusBadge live />}
        </div>
        {entry.data && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span>{entry.data}{entry.horario ? ` às ${fmtTime(entry.horario)}` : ""}</span>
          </div>
        )}
        {isThisLive && current && <NowPlayingBar current={current} />}
      </div>

      {/* Chat / Ranking */}
      {topicoId && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col" style={{ height: 420 }}>
          <div className="flex border-b border-border shrink-0">
            {tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest transition-colors
                  ${tab === t ? "text-primary border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t === "Chat" ? <><MessageCircle className="size-3.5 inline mr-1" />Chat</> : <><Trophy className="size-3.5 inline mr-1" />Ranking</>}
              </button>
            ))}
          </div>

          {tab === "Chat" ? (
            <LiveChat programa={entry.programa} topicoId={topicoId} user={user} />
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <RankingParticipacao programa={entry.programa} currentUserId={user?.id ? String(user.id) : undefined} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TV PAGE ──────────────────────────────────────────────────────────────────
function TvPage() {
  const { user } = useTelegramUser();
  const [status, setStatus]       = useState<TvStatus | null>(null);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState<"grid" | "planner">("grid");
  const [selectedEntry, setSelectedEntry] = useState<ProgramEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await tvApi.status();
        if (!cancelled) setStatus(data);
      } catch {
        /* ignora */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const entries = status ? buildProgramEntries(status) : [];
  const current = status?.current ?? null;

  // abre automaticamente o programa ao vivo
  useEffect(() => {
    if (!entries.length || selectedEntry) return;
    const live = entries.find(e => e.hasLive);
    if (live) setSelectedEntry(live);
  }, [entries.length]);

  if (loading) return (
    <div className="min-h-screen grid place-items-center">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );

  if (selectedEntry) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <EventRoom entry={selectedEntry} current={current} onBack={() => setSelectedEntry(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-black text-2xl">Empire TV</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Grade de programação</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-border">
          <button onClick={() => setView("grid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
              ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          ><LayoutGrid className="size-3.5" /> Grade</button>
          <button onClick={() => setView("planner")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
              ${view === "planner" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          ><CalendarDays className="size-3.5" /> Agenda</button>
        </div>
      </div>

      {/* Status atual */}
      {current && getProgramStatus(current) === "live" && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center gap-3"
        >
          <span className="size-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-red-400 uppercase tracking-widest">Ao vivo agora</p>
            <p className="font-bold text-sm truncate">{current.programa}</p>
          </div>
          <button onClick={() => {
            const live = entries.find(e => e.hasLive);
            if (live) setSelectedEntry(live);
          }} className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-black hover:bg-red-500 transition-colors shrink-0">
            Assistir
          </button>
        </motion.div>
      )}

      {/* Conteúdo */}
      <AnimatePresence mode="wait">
        {view === "grid" ? (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {entries.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-10 text-center">
                <Tv className="size-8 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">Nenhuma programação disponível.</p>
              </div>
            ) : entries.map((entry, i) => (
              <motion.div key={entry.programa + entry.data} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <ProgramCard entry={entry} onSelect={() => setSelectedEntry(entry)} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div key="planner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PlannerView entries={entries} onSelect={setSelectedEntry} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
