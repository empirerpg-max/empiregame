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

const TELEGRAM_CHANNEL = "empireventos1";
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

// Verifica se o current pertence a esta entrada e está no ar
// Aceita qualquer valor de status que indique transmissão
function checkIsLive(current: TvProgram | null, entry: ProgramEntry): boolean {
  if (!current) return false;
  const s = String(current.status || "").toLowerCase();
  const isLiveStatus = s === "broadcasting" || s === "transmitindo" || s === "live" || s === "ao vivo";
  // Se tem rowNums, verifica se pertence; senão, assume que qualquer live pertence
  if (entry.rowNums.length > 0) {
    return isLiveStatus && entry.rowNums.includes(current.rowNum ?? -1);
  }
  return isLiveStatus;
}

// URL do embed Kick com o parâmetro parent para liberar cross-origin
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
          <StatusBadge live={entry.hasLive} upcoming={!entry.hasLive} />
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
// Tenta embed com parent; se falhar (WebView/Telegram que bloqueia), mostra botão externo
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

// ─── LIVE CHAT (in-app, ligado ao Telegram via Apps Script) ──────────────────
function LiveChat({ programa, topicoId, user }: {
  programa: string;
  topicoId: string;
  user: ReturnType<typeof useTelegramUser>["user"];
}) {
  const [msgs, setMsgs]       = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto]     = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef             = useRef<HTMLDivElement>(null);
  const lastIdRef             = useRef<string>("");

  useEffect(() => {
    let alive = true;
    const tick = () => {
      tvApi.chatList()
        .then(d => {
          if (!alive) return;
          const arr = Array.isArray(d) ? d : [];
          setMsgs(arr);
          const lastId = arr[arr.length - 1]?.id || "";
          if (lastId !== lastIdRef.current) {
            lastIdRef.current = lastId;
            requestAnimationFrame(() => {
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            });
          }
        })
        .catch(() => {})
        .finally(() => { if (alive) setLoading(false); });
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  async function enviar() {
    const t = texto.trim();
    if (!t || !user?.id || sending) return;
    setSending(true);
    const optimistic: ChatMsg = {
      id: "tmp-" + Date.now(),
      tgId: String(user.id),
      nome: user.name || "Você",
      texto: t,
      tipo: "texto",
      gifUrl: "",
      data: new Date().toISOString(),
    };
    setMsgs(m => [...m, optimistic]);
    setTexto("");
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
    try {
      await tvApi.chatSend({
        tgId: String(user.id),
        nome: user.name || "Jogador",
        texto: t,
        topicoId,
      });
    } catch {
      // mantém a otimista — próximo tick reconcilia
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-4 animate-spin text-primary" />
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
          const isMe = user?.id && String(m.tgId) === String(user.id);
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMe ? "bg-primary text-primary-foreground" : "bg-white/5 border border-white/5"}`}>
                {!isMe && (
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary/80 mb-0.5">{m.nome || "Anon"}</p>
                )}
                {m.gifUrl ? (
                  <img src={m.gifUrl} alt="" className="rounded-lg max-h-40" />
                ) : (
                  <p className="text-sm leading-snug whitespace-pre-wrap break-words">{m.texto}</p>
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
          placeholder={user?.id ? `Comentar como ${user.name || "você"}…` : "Entre pelo Telegram para comentar"}
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

  const topicoUrl = (isThisLive && current?.topicoUrl ? String(current.topicoUrl) : entry.topicoUrl) || "";
  const threadId  = (() => {
    if (!topicoUrl) return null;
    const parts = topicoUrl.split("/");
    const last  = parts[parts.length - 1];
    return /^\d+$/.test(last) ? last : null;
  })();

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

  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />Voltar para a grade
        </button>
      )}

      <div className="grid lg:grid-cols-[1fr,380px] gap-5">
        {/* Coluna esquerda */}
        <div className="space-y-3">
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              {isThisLive && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">
                  <span className="size-1.5 rounded-full bg-white animate-pulse" />Ao vivo agora
                </span>
              )}
              {entry.data && <span className="text-xs text-muted-foreground">{entry.data}</span>}
              {entry.horario && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />{fmtTime(entry.horario)}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black tracking-tight">{entry.programa}</h2>
          </motion.div>

          {/* Player */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="relative w-full rounded-3xl overflow-hidden border border-border bg-black"
            style={{ aspectRatio: "16/9" }}
          >
            {isThisLive ? (
              <KickPlayer programa={entry.programa} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3">
                {capaUrl
                  ? <img src={capaUrl} alt="" className="w-32 rounded-xl opacity-30" />
                  : <Tv className="size-12 text-muted-foreground" />
                }
                <p className="font-black uppercase tracking-widest text-sm text-white">Transmissão em breve</p>
                {entry.horario && (
                  <p className="text-xs text-muted-foreground -mt-1">às {fmtTime(entry.horario)}</p>
                )}
              </div>
            )}
            {isThisLive && (
              <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-black uppercase tracking-widest z-10 pointer-events-none">
                <span className="size-2 rounded-full bg-white animate-pulse" /> Ao vivo
              </div>
            )}
          </motion.div>

          <NowPlayingBar current={isThisLive ? current : null} />
        </div>

        {/* Coluna direita: Chat + Ranking */}
        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-border bg-card flex flex-col overflow-hidden" style={{ minHeight: 420, maxHeight: 560 }}>
            <div className="p-4 border-b border-border flex items-center gap-2">
              <MessageCircle className="size-4 text-primary" />
              <p className="text-xs font-black uppercase tracking-widest">Chat ao vivo</p>
            </div>
            <LiveChat
              programa={entry.programa}
              topicoId={String(current?.topicoId || entry.topicoId || "")}
              user={user}
            />
          </div>


          <div className="rounded-3xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <Trophy className="size-4 text-yellow-400" />
              <p className="text-xs font-black uppercase tracking-widest">Participação de hoje</p>
            </div>
            <div className="p-3">
              <RankingParticipacao
                programa={entry.programa}
                currentUserId={user?.id ? String(user.id) : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
type ViewMode = "grade" | "data";

function TvPage() {
  const { user } = useTelegramUser();
  const [data, setData]                   = useState<TvStatus | null>(null);
  const [loading, setLoading]             = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<ProgramEntry | null>(null);
  const [viewMode, setViewMode]           = useState<ViewMode>("grade");

  useEffect(() => {
    let alive = true;
    const tick = () => tvApi.status().then(r => { if (alive) setData(r); }).finally(() => { if (alive) setLoading(false); });
    tick();
    const id = setInterval(tick, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const current       = data?.current ?? null;
  const fullSchedule  = data?.fullSchedule ?? [];
  const currentRowNum = current?.rowNum;

  const entries  = buildProgramEntries(fullSchedule, currentRowNum);
  const featured = entries.find(e => e.hasLive) ?? entries[0] ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center">
              <Tv className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-widest">Empire TV</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Transmissões agendadas · Chat ao vivo</p>
            </div>
          </div>
          {featured && featured.hasLive && !selectedEntry && (
            <button
              onClick={() => setSelectedEntry(featured)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-500 transition-colors"
            >
              <span className="size-1.5 rounded-full bg-white animate-pulse" />Assistir ao vivo
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && (
          <AnimatePresence mode="wait">
            {selectedEntry ? (
              <motion.div key="room" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <EventRoom
                  entry={selectedEntry}
                  current={current}
                  onBack={() => setSelectedEntry(null)}
                />
              </motion.div>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

                {/* Banner destaque */}
                {featured && (
                  <motion.div
                    className="relative rounded-3xl overflow-hidden border border-border cursor-pointer group"
                    onClick={() => setSelectedEntry(featured)}
                    whileHover={{ scale: 1.005 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {driveImgUrl(featured.capaUrl) ? (
                      <div className="absolute inset-0">
                        <img src={driveImgUrl(featured.capaUrl)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-black" />
                    )}
                    <div className="relative p-6 md:p-10 space-y-3 min-h-[200px] flex flex-col justify-end">
                      <div className="flex items-center gap-2 flex-wrap">
                        {featured.hasLive ? (
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">
                            <span className="size-1.5 rounded-full bg-white animate-pulse" />Ao vivo agora
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">Em breve</span>
                        )}
                        {featured.hasLive && current?.tipo && (
                          <span className="text-xs font-bold text-white/60 uppercase">{current.tipo}</span>
                        )}
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white drop-shadow-md">{featured.programa}</h2>
                      {featured.hasLive && (current?.material || current?.buff) && (
                        <div className="flex items-center gap-3 flex-wrap">
                          {current?.material && (
                            <span className="flex items-center gap-1.5 text-sm text-white/70">
                              <Music2 className="size-3.5" />{current.material}
                            </span>
                          )}
                          {current?.buff && (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-black">
                              <Zap className="size-3" />{current.buff}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-4 pt-1">
                        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-black hover:bg-white/90 transition-colors">
                          <Play className="size-4" />{featured.hasLive ? "Assistir" : "Ver programação"}
                        </button>
                        {featured.data && (
                          <span className="text-xs text-white/50">{featured.data}{featured.horario ? ` · ${fmtTime(featured.horario)}` : ""}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Seletor Grade / Por data */}
                <div className="flex items-center gap-2">
                  <button onClick={() => setViewMode("grade")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors
                      ${viewMode === "grade" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-white/5"}`}
                  >
                    <LayoutGrid className="size-3.5" /> Grade
                  </button>
                  <button onClick={() => setViewMode("data")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors
                      ${viewMode === "data" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-white/5"}`}
                  >
                    <CalendarDays className="size-3.5" /> Por data
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {viewMode === "grade" ? (
                    <motion.div key="grade-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      {entries.length === 0 && (
                        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
                          <Tv className="size-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Nenhuma programação disponível</p>
                        </div>
                      )}
                      {entries.map(entry => (
                        <ProgramCard key={entry.programa + entry.data} entry={entry} onSelect={() => setSelectedEntry(entry)} />
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div key="data-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <PlannerView entries={entries} onSelect={setSelectedEntry} />
                    </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
