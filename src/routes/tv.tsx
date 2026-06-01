import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Tv, Loader2, ChevronLeft, ChevronRight, ArrowLeft,
  MessageCircle, Play, Clock, ChevronDown,
  Music2, Film, Zap, LayoutGrid, CalendarDays, Trophy, Users,
  ExternalLink, X, CornerUpLeft
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
import {
  fetchMensagens, inserirMensagem, getRanking, podeSendMensagem,
  type MensagemDB, type RankingItem
} from "@/lib/supabase";

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

// ─── MEDAL ─────────────────────────────────────────────────────────────────────────────
function Medal({ pos }: { pos: number }) {
  if (pos === 1) return <span className="text-base">🥇</span>;
  if (pos === 2) return <span className="text-base">🥈</span>;
  if (pos === 3) return <span className="text-base">🥉</span>;
  return <span className="text-xs font-black text-muted-foreground w-5 text-center">{pos}</span>;
}

// ─── RANKING ─────────────────────────────────────────────────────────────────────────
function RankingParticipacao({ streamId, currentUserId }: { streamId: string; currentUserId?: string }) {
  const [items, setItems]     = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!streamId) return;
    setLoading(true);
    getRanking(streamId)
      .then(data => setItems(data))
      .finally(() => setLoading(false));
    const id = setInterval(() => {
      getRanking(streamId).then(data => setItems(data)).catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [streamId]);

  if (loading) return <div className="flex items-center justify-center py-6"><Loader2 className="size-4 animate-spin text-primary" /></div>;
  if (items.length === 0) return (
    <div className="text-center py-6 space-y-1">
      <Users className="size-5 text-muted-foreground mx-auto" />
      <p className="text-[11px] text-muted-foreground">Nenhuma participação ainda.</p>
    </div>
  );

  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => {
        const isMe = currentUserId && String(item.telegram_id) === String(currentUserId);
        return (
          <motion.div key={item.telegram_id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
            className={`relative flex items-center gap-2.5 px-3 py-2 rounded-xl overflow-hidden ${isMe ? "border border-primary/40 bg-primary/10" : "bg-white/5"}`}
          >
            <div className="absolute inset-y-0 left-0 rounded-xl transition-all duration-700"
              style={{ width: `${item.porcentagem}%`, background: isMe ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.04)" }} />
            <div className="relative flex items-center gap-2.5 w-full">
              <Medal pos={idx + 1} />
              <p className={`flex-1 text-xs font-bold truncate ${isMe ? "text-primary" : ""}`}>{item.nome}{isMe ? " (você)" : ""}</p>
              <span className="text-[10px] text-muted-foreground shrink-0">{item.total_mensagens} msg</span>
              <span className={`text-[10px] font-black shrink-0 ${isMe ? "text-primary" : "text-white/60"}`}>{item.porcentagem}%</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── NOW PLAYING BAR ───────────────────────────────────────────────────────────────────
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

// ─── STATUS BADGE ───────────────────────────────────────────────────────────────────────────
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

// ─── PROGRAM CARD ─────────────────────────────────────────────────────────────────────────
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

// ─── PLANNER ──────────────────────────────────────────────────────────────────────────────
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

// ─── KICK PLAYER ─────────────────────────────────────────────────────────────────────────
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

// ─── LIVE CHAT ───────────────────────────────────────────────────────────────────────────────
// Chat em tempo real via polling incremental ao Supabase.
// NÃO usa Supabase Realtime (WebSocket) pois causa crash no Telegram Mini App WebView.
// Estratégia: busca histórico inicial → polling a cada 3s buscando apenas msgs novas (afterId).
//
// CORREÇÕES APLICADAS:
// 1. Input NÃO fica disabled durante envio — apenas o botão mostra spinner.
// 2. scrollBottom usa bottomRef + scrollIntoView (single RAF) para não brigar
//    com o teclado virtual ao rolar.
// 3. enviar() usa try/finally: setSending(false) SEMPRE executa.
// 4. inserirMensagem usa AbortSignal.timeout(3500): cancela o fetch automaticamente.
// 5. FIX: usuário "guest" (fallback quando fora do Telegram) é bloqueado de enviar
//    com mensagem clara — Number("guest") = NaN e causava falha silenciosa no banco.
// 6. FIX: fetchMensagens inicial usa .finally() para garantir setLoading(false)
//    mesmo em caso de falha inesperada.
// 7. FIX: enviar() mostra alerta toast quando chamado fora do Telegram (guest),
//    em vez de sair silenciosamente.

const POLL_INTERVAL = 3000;

// Detecta se o usuário é válido (não é o fallback "guest" sem Telegram real)
function isValidTelegramUser(user: { id: string; isTest?: boolean } | null): boolean {
  if (!user) return false;
  if (user.id === "guest") return false;
  const numId = Number(user.id);
  return !isNaN(numId) && numId > 0;
}

function LiveChat({ streamId, user }: {
  streamId: string;
  user: ReturnType<typeof useTelegramUser>["user"];
}) {
  const [msgs, setMsgs]           = useState<MensagemDB[]>([]);
  const [loading, setLoading]     = useState(true);
  const [texto, setTexto]         = useState("");
  const [sending, setSending]     = useState(false);
  const [replyTo, setReplyTo]     = useState<MensagemDB | null>(null);
  const [toast, setToast]         = useState<string | null>(null);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputFocusedRef           = useRef(false);
  const nomeRef                   = useRef(user?.name || "Jogador");
  const lastIdRef                 = useRef(0);
  useEffect(() => { nomeRef.current = user?.name || "Jogador"; });

  const userValido = isValidTelegramUser(user);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function scrollBottom() {
    if (inputFocusedRef.current) return;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  useEffect(() => {
    if (!streamId || !userValido) {
      setMsgs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMsgs([]);
    setReplyTo(null);
    lastIdRef.current = 0;

    // FIX: .finally() garante que setLoading(false) SEMPRE executa,
    // mesmo se fetchMensagens lançar erro inesperado fora do try/catch interno.
    fetchMensagens(streamId, 60, 0)
      .then(data => {
        setMsgs(data);
        if (data.length > 0) lastIdRef.current = data[data.length - 1].id;
        scrollBottom();
      })
      .finally(() => setLoading(false));

    const timer = setInterval(async () => {
      try {
        const novas = await fetchMensagens(streamId, 20, lastIdRef.current);
        if (novas.length === 0) return;
        lastIdRef.current = novas[novas.length - 1].id;
        setMsgs(prev => {
          const merged = [...prev];
          novas.forEach(nova => {
            const idxOtimista = merged.findIndex(
              p => typeof p.id === "number" && p.id > 1_700_000_000_000 &&
                   p.texto === nova.texto &&
                   String(p.telegram_id) === String(nova.telegram_id)
            );
            if (idxOtimista >= 0) {
              merged[idxOtimista] = nova;
            } else if (!merged.some(p => p.id === nova.id)) {
              merged.push(nova);
            }
          });
          return merged;
        });
        scrollBottom();
      } catch {}
    }, POLL_INTERVAL);

    return () => clearInterval(timer);
  }, [streamId, user?.id]);

  async function enviar() {
    const t = texto.trim();
    if (!t || sending || !streamId) return;

    // FIX: mostra toast explicativo em vez de sair silenciosamente
    if (!userValido) {
      showToast("Abra pelo Telegram para comentar.");
      return;
    }

    // Verifica rate limit client-side antes de qualquer coisa
    if (!podeSendMensagem(user!.id)) {
      showToast("Aguarde um momento antes de enviar outra mensagem.");
      return;
    }

    setSending(true);
    setTexto("");
    setReplyTo(null);

    const optimisticId = Date.now();
    const optimistic: MensagemDB = {
      id: optimisticId as unknown as number,
      created_at: new Date().toISOString(),
      stream_id: streamId,
      telegram_id: Number(user!.id),
      username: user!.username || null,
      nome: nomeRef.current,
      texto: t,
      reply_to_id: replyTo?.id ?? null,
    };
    setMsgs(prev => [...prev, optimistic]);
    scrollBottom();

    try {
      const result = await inserirMensagem({
        stream_id: streamId,
        telegram_id: Number(user!.id),
        username: user!.username || null,
        nome: nomeRef.current,
        texto: t,
        reply_to_id: replyTo?.id ?? null,
      });
      if (result === "rate_limited") {
        showToast("Você está enviando mensagens muito rápido.");
        setMsgs(prev => prev.filter(m => m.id !== optimisticId));
      }
    } catch {
      // Remove mensagem otimista se houve falha total não tratada
      setMsgs(prev => prev.filter(m => m.id !== optimisticId));
      showToast("Erro ao enviar. Tente novamente.");
    } finally {
      // SEMPRE libera o botão, mesmo em erro ou timeout
      setSending(false);
    }
  }

  // Usuário não identificado (fora do Telegram ou guest) — mostra input bloqueado
  if (!userValido) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
        <MessageCircle className="size-8 text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">Chat disponível no Telegram</p>
        <p className="text-xs text-muted-foreground max-w-[220px]">
          Abra este app pelo bot do Telegram para participar do chat ao vivo.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 relative">
        {/* Toast de feedback */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key="toast"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="sticky top-2 z-10 mx-auto w-fit px-4 py-2 rounded-xl bg-black/80 border border-white/10 text-xs text-white backdrop-blur-sm shadow-lg"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {loading && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <Loader2 className="size-4 animate-spin text-primary" />
            <p className="text-[10px] text-muted-foreground">Carregando chat…</p>
          </div>
        )}

        {!loading && msgs.length === 0 && (
          <div className="h-full grid place-items-center text-center px-4">
            <div className="space-y-1.5">
              <MessageCircle className="size-7 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">Seja o primeiro a comentar.</p>
            </div>
          </div>
        )}

        {msgs.map((m) => {
          const isMe = user?.id && String(m.telegram_id) === String(user.id);
          const replied = m.reply_to_id ? msgs.find(p => p.id === m.reply_to_id) : null;
          return (
            <div
              key={m.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              onDoubleClick={() => setReplyTo(m)}
            >
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 space-y-1 ${
                isMe ? "bg-primary text-primary-foreground" : "bg-white/5 border border-white/5"
              }`}>
                {!isMe && (
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary/80">
                    {m.nome || "Anon"}
                  </p>
                )}
                {replied && (
                  <div className={`text-[10px] px-2 py-1 rounded-lg border-l-2 border-primary/60 ${
                    isMe ? "bg-black/20" : "bg-white/5"
                  }`}>
                    <span className="font-bold text-primary/80">{replied.nome}: </span>
                    <span className="opacity-70 line-clamp-1">{replied.texto}</span>
                  </div>
                )}
                <p className="text-sm leading-snug whitespace-pre-wrap break-words">
                  {m.texto}
                </p>
              </div>
            </div>
          );
        })}

        {/* Ancora de scroll — scrollIntoView aponta aqui */}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-t border-border text-xs">
          <CornerUpLeft className="size-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground truncate flex-1">
            <span className="font-bold text-primary">{replyTo.nome}:</span> {replyTo.texto}
          </span>
          <button onClick={() => setReplyTo(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); enviar(); }}
        className="p-3 border-t border-border flex items-center gap-2"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => { inputFocusedRef.current = true; }}
          onBlur={() => {
            setTimeout(() => { inputFocusedRef.current = false; }, 300);
          }}
          placeholder={`Comentar como ${nomeRef.current}…`}
          maxLength={500}
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={!texto.trim() || sending}
          className="size-10 grid place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </>
  );
}

// ─── SALA DO EVENTO ───────────────────────────────────────────────────────────────────────────
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

  // FIX: streamId usa topicoId do current (ao vivo) ou do entry, mas nunca string vazia.
  // Se ambos forem vazios, o chat não é renderizado e mostra aviso claro.
  const streamId = (isThisLive && current?.topicoId)
    ? String(current.topicoId)
    : (entry.topicoId || "");

  const tabs = ["Chat", "Ranking"] as const;
  const [tab, setTab] = useState<typeof tabs[number]>("Chat");

  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Voltar
        </button>
      )}

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

      {streamId ? (
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
            <LiveChat streamId={streamId} user={user} />
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <RankingParticipacao streamId={streamId} currentUserId={user?.id ? String(user.id) : undefined} />
            </div>
          )}
        </div>
      ) : (
        // FIX: se streamId estiver vazio, mostra aviso claro em vez de sumir silenciosamente
        <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
          <MessageCircle className="size-6 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground">
            O chat será liberado quando a transmissão estiver ao vivo.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── TV PAGE ────────────────────────────────────────────────────────────────────────────────
function TvPage() {
  const { user } = useTelegramUser();
  const [status, setStatus]         = useState<TvStatus | null>(null);
  const [loading, setLoading]       = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<ProgramEntry | null>(null);
  const [view, setView]             = useState<"grade" | "planner">("grade");

  useEffect(() => {
    tvApi.status().then(s => { setStatus(s); setLoading(false); });
    const id = setInterval(() => {
      tvApi.status().then(s => setStatus(s)).catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const entries: ProgramEntry[] = status ? buildProgramEntries(status) : [];
  const current = status?.current ?? null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando programação…</p>
        </div>
      </div>
    );
  }

  if (selectedEntry) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <EventRoom entry={selectedEntry} current={current} onBack={() => setSelectedEntry(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Tv className="size-5 text-primary" />
          <h1 className="font-black text-lg">Empire TV</h1>
        </div>
        <p className="text-xs text-muted-foreground">Programação completa do canal</p>
      </div>

      {current && getProgramStatus(current) === "broadcasting" && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[9px] font-black uppercase tracking-widest">
              <span className="size-1.5 rounded-full bg-white animate-pulse" /> Ao vivo
            </span>
            <p className="font-black text-sm">{current.programa}</p>
          </div>
          <NowPlayingBar current={current} />
          <button
            onClick={() => {
              const e = entries.find(en => checkIsLive(current, en));
              if (e) setSelectedEntry(e);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:bg-primary/90 transition-colors"
          >
            <Play className="size-3.5" /> Assistir e Comentar
          </button>
        </motion.div>
      )}

      <div className="flex gap-2">
        {(["grade", "planner"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-colors
              ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
          >
            {v === "grade" ? <><LayoutGrid className="size-3.5" />Grade</> : <><CalendarDays className="size-3.5" />Planner</>}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {entries.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
            <Tv className="size-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma programação disponível.</p>
          </div>
        )}
        {view === "grade" ? (
          entries.map((entry, i) => (
            <motion.div key={entry.programa + entry.data} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <ProgramCard entry={entry} onSelect={() => setSelectedEntry(entry)} />
            </motion.div>
          ))
        ) : (
          <PlannerView entries={entries} onSelect={setSelectedEntry} />
        )}
      </div>
    </div>
  );
}
