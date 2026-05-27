import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Tv, Loader2, Radio, Calendar, ChevronLeft, ChevronRight,
  ArrowLeft, MessageCircle, Send
} from "lucide-react";
import { motion } from "motion/react";
import { useTelegramUser } from "@/lib/telegram";
import {
  tvApi, groupByDate, groupByPrograma, getProgramStatus,
  buildPlayerSrc, driveImgUrl, type TvStatus, type TvProgram
} from "@/lib/empiretv";

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

function StatusBadge({ status }: { status: "live" | "upcoming" | "ended" }) {
  if (status === "live") return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase tracking-widest">
      <span className="size-1.5 rounded-full bg-white animate-pulse" />
      Ao vivo
    </span>
  );
  if (status === "ended") return (
    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-[9px] font-black uppercase tracking-widest">Encerrado</span>
  );
  return (
    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-black uppercase tracking-widest">Em breve</span>
  );
}

function ProgramCard({ program, currentRowNum, onClick }: {
  program: TvProgram;
  currentRowNum?: number;
  onClick: () => void;
}) {
  const status = getProgramStatus(program, currentRowNum);
  const capa   = driveImgUrl(program.capaUrl as string | undefined ?? "");
  return (
    <motion.button
      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="relative w-full text-left rounded-2xl overflow-hidden border border-border bg-card group cursor-pointer"
    >
      <div className="aspect-video w-full bg-black/60 relative overflow-hidden">
        {capa ? (
          <img src={capa} alt={program.programa || "Programa"} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/30 to-black">
            <Tv className="size-8 text-primary/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300" />
        <div className="absolute top-2 left-2"><StatusBadge status={status} /></div>
        {status !== "ended" && (
          <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="size-12 rounded-full bg-white/20 backdrop-blur-sm grid place-items-center border border-white/40">
              <div className="w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-l-[12px] border-l-white ml-1" />
            </div>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-black text-sm leading-tight line-clamp-1">{program.programa || program.titulo || "Programa"}</p>
          <p className="text-[10px] font-bold text-muted-foreground shrink-0 tabular-nums">
            {fmtTime(program.horario || (program as any).horarioStr || program.inicio as any)}
          </p>
        </div>
        {program.tipo     && <p className="text-[10px] font-bold text-primary uppercase tracking-wide">{program.tipo}</p>}
        {program.material && <p className="text-xs text-muted-foreground line-clamp-1">{program.material}</p>}
        {program.buff     && <span className="inline-block px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[9px] font-black">⚡ {program.buff}</span>}
      </div>
    </motion.button>
  );
}

function MiniCalendar({ schedule, selectedDate, onSelect }: {
  schedule: TvProgram[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const datesWithEvents = new Set(
    schedule.map(p => {
      const d = parseDataBR(String(p.data || ""));
      if (!d) return null;
      return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
    }).filter(Boolean)
  );
  function navMonth(dir: number) {
    let m = month + dir, y = year;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setMonth(m); setYear(y);
  }
  return (
    <div className="rounded-3xl border border-border bg-card p-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navMonth(-1)} className="size-7 rounded-lg hover:bg-white/10 grid place-items-center transition-colors"><ChevronLeft className="size-4" /></button>
        <p className="text-xs font-black uppercase tracking-widest">{MESES_PT[month]} {year}</p>
        <button onClick={() => navMonth(1)}  className="size-7 rounded-lg hover:bg-white/10 grid place-items-center transition-colors"><ChevronRight className="size-4" /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DIAS_PT.map(d => <div key={d} className="text-center text-[9px] font-black text-muted-foreground py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day      = i + 1;
          const dateStr  = `${String(day).padStart(2,"0")}/${String(month+1).padStart(2,"00")}/${year}`;
          const hasEvent = datesWithEvents.has(dateStr);
          const isToday  = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
          const isSel    = selectedDate === dateStr;
          return (
            <button key={day} onClick={() => hasEvent && onSelect(dateStr)} disabled={!hasEvent}
              className={`relative h-8 rounded-lg text-xs font-bold transition-colors
                ${isSel ? "bg-primary text-primary-foreground" : ""}
                ${isToday && !isSel ? "border border-primary text-primary" : ""}
                ${hasEvent && !isSel ? "hover:bg-white/10" : ""}
                ${!hasEvent ? "text-muted-foreground/30 cursor-default" : "cursor-pointer"}
              `}
            >
              {day}
              {hasEvent && !isSel && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── SALA DO EVENTO ───────────────────────────────────────────────────────────
function EventRoom({ program, current, onBack }: {
  program: TvProgram;
  current: TvProgram | null;
  onBack?: () => void;
}) {
  const { user } = useTelegramUser();
  const participacaoRegistrada = useRef<Set<string>>(new Set());
  const isCurrent      = current && current.rowNum === program.rowNum;
  const isBroadcasting = isCurrent && current?.status === "broadcasting";
  const playerSrc      = buildPlayerSrc(program);
  const topicoUrl      = (program.topicoUrl as string | undefined) || `https://t.me/${TELEGRAM_CHANNEL}`;
  const capaConvertida = driveImgUrl(program.capaUrl as string | undefined ?? "");
  const threadId       = (() => {
    if (!program.topicoUrl) return null;
    const parts = String(program.topicoUrl).split("/");
    const last  = parts[parts.length - 1];
    return /^\d+$/.test(last) ? last : null;
  })();

  useEffect(() => {
    if (!user?.id || !isBroadcasting) return;
    const programa = program.programa || program.titulo || "";
    const chave    = `${user.id}_${programa}_${program.topicoId || ""}`;
    if (participacaoRegistrada.current.has(chave)) return;
    participacaoRegistrada.current.add(chave);
    tvApi.registrarParticipacao({
      tgId: String(user.id),
      nome: user.name || "Jogador",
      programa,
      tipo: String(program.tipo || ""),
      topicoId: String(program.topicoId || ""),
      topicoUrl: String(program.topicoUrl || ""),
    });
  }, [user, isBroadcasting, program.programa, program.topicoId]);

  return (
    <div className="space-y-5">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
          Voltar para a grade
        </button>
      )}


      {/* Banner */}
      <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} className="rounded-3xl border border-border bg-card overflow-hidden">
        {capaConvertida && (
          <div className="relative w-full" style={{ aspectRatio: "21/4" }}>
            <img src={capaConvertida} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
          </div>
        )}
        <div className="p-5 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              {isBroadcasting && (
                <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">
                  <span className="size-1.5 rounded-full bg-white animate-pulse" />
                  Ao vivo agora
                </span>
              )}
              <h2 className="text-2xl font-black">{program.programa || program.titulo || "Programa"}</h2>
              {program.tipo     && <p className="text-sm font-bold text-primary uppercase tracking-wide">{program.tipo}</p>}
              {program.material && <p className="text-sm text-muted-foreground">{program.material}</p>}
            </div>
            <div className="text-right shrink-0">
              {program.data && <p className="text-xs text-muted-foreground">{String(program.data)}</p>}
              <p className="text-sm font-bold tabular-nums">{fmtTime(program.horario || (program as any).horarioStr || program.inicio as any)}</p>
            </div>
          </div>
          {program.buff && (
            <span className="inline-block px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest">⚡ BUFF: {program.buff}</span>
          )}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-[1fr,380px] gap-6">
        {/* Player Kick */}
        <div className="space-y-3">
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="relative w-full rounded-3xl overflow-hidden border border-border bg-black"
            style={{ aspectRatio: "16/9" }}
          >
            {isBroadcasting ? (
              <iframe
                src={playerSrc}
                title="Empire TV — Kick"
                className="absolute inset-0 w-full h-full"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-black">
                <div className="text-center px-6 space-y-3">
                  {capaConvertida
                    ? <img src={capaConvertida} alt="" className="w-32 rounded-xl mx-auto opacity-40" />
                    : <Tv className="size-12 text-muted-foreground mx-auto" />
                  }
                  <p className="font-black uppercase tracking-widest text-sm text-white">
                    {current?.status === "upcoming" && isCurrent ? "Transmissão em breve" : "Fora do ar"}
                  </p>
                  {current?.status === "upcoming" && isCurrent && (
                    <p className="text-xs text-muted-foreground">às {fmtTime((program.horario || (program as any).horarioStr) as string)}</p>
                  )}
                  <a href={`https://t.me/${TELEGRAM_CHANNEL}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/20 text-primary text-xs font-bold hover:bg-primary/30 transition-colors">
                    <Send className="size-3" /> Acompanhar no Telegram
                  </a>
                </div>
              </div>
            )}
            {isBroadcasting && (
              <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-black uppercase tracking-widest z-10">
                <span className="size-2 rounded-full bg-white animate-pulse" /> Ao vivo
              </div>
            )}
          </motion.div>
        </div>

        {/* Chat Telegram */}
        <div className="rounded-3xl border border-border bg-card flex flex-col overflow-hidden" style={{ minHeight: 520 }}>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-primary" />
              <p className="text-xs font-black uppercase tracking-widest">Chat ao vivo</p>
            </div>
          </div>
          <div className="flex-1 relative">
            {threadId ? (
              <iframe key={threadId}
                src={`https://t.me/${TELEGRAM_CHANNEL}/${threadId}?embed=1&discussion=${TELEGRAM_CHANNEL}&comments_limit=50&color=8B5CF6&dark=1`}
                className="absolute inset-0 w-full h-full border-0"
                allow="autoplay; encrypted-media" title="Chat Empire TV" />
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center px-6 space-y-2">
                  <MessageCircle className="size-8 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">O chat será aberto quando a transmissão começar.</p>
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-border">
            <a href={topicoUrl} target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
              <Send className="size-4" /> Comentar no Telegram
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
function TvPage() {
  const [data, setData]       = useState<TvStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const tick = () => tvApi.status().then(r => alive && setData(r)).finally(() => alive && setLoading(false));
    tick();
    const id = setInterval(tick, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const current = data?.current ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center">
            <Tv className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest">Empire TV</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Transmissão ao vivo</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && (
          <EventRoom
            program={current ?? ({} as TvProgram)}
            current={current}
            onBack={() => { /* sem grade — nada a fazer */ }}
          />
        )}
      </div>
    </div>
  );
}
