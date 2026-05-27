import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Tv, Loader2, Radio, Calendar, ChevronLeft, ChevronRight,
  ArrowLeft, MessageCircle, Send, Play, Clock, Layers,
  ChevronDown, ChevronUp, Music2, Film, Zap, LayoutGrid, CalendarDays
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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

// ─── NOW PLAYING BAR ─────────────────────────────────────────────────────────
function NowPlayingBar({ program }: { program: TvProgram }) {
  const isBroadcasting = String(program.status || "").toLowerCase() === "broadcasting" ||
                         String(program.status || "").toLowerCase() === "transmitindo";
  if (!program.tipo && !program.material) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm"
    >
      {isBroadcasting && (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/90 text-white text-[9px] font-black uppercase tracking-widest shrink-0">
          <span className="size-1.5 rounded-full bg-white animate-pulse" />
          Ao vivo
        </span>
      )}
      {program.tipo && (
        <span className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide">
          <Film className="size-3.5 shrink-0" />
          {program.tipo}
        </span>
      )}
      {program.tipo && program.material && (
        <span className="text-white/20">•</span>
      )}
      {program.material && (
        <span className="flex items-center gap-1.5 text-xs text-white/70 font-medium">
          <Music2 className="size-3.5 shrink-0 text-white/40" />
          {program.material}
        </span>
      )}
      {program.buff && (
        <>
          <span className="text-white/20">•</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[9px] font-black uppercase tracking-wide">
            <Zap className="size-3 shrink-0" />
            {program.buff}
          </span>
        </>
      )}
    </motion.div>
  );
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
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

// ─── PROGRAM ROW (grade por programa — lista de episódios) ───────────────────
function ProgramRow({ nome, episodios, currentRowNum, onSelect }: {
  nome: string;
  episodios: TvProgram[];
  currentRowNum?: number;
  onSelect: (p: TvProgram) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasLive = episodios.some(e => getProgramStatus(e, currentRowNum) === "live");
  const capaFirst = driveImgUrl(episodios[0]?.capaUrl as string | undefined ?? "");

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors text-left"
      >
        {capaFirst ? (
          <img src={capaFirst} alt={nome} className="size-12 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="size-12 rounded-xl bg-primary/20 grid place-items-center shrink-0">
            <Tv className="size-5 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black text-sm">{nome}</p>
            {hasLive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase tracking-widest">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                Ao vivo
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{episodios.length} episódio{episodios.length !== 1 ? "s" : ""}</p>
        </div>
        {expanded ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border divide-y divide-border">
              {episodios.map((ep, i) => {
                const status = getProgramStatus(ep, currentRowNum);
                return (
                  <button
                    key={ep.rowNum ?? i}
                    onClick={() => onSelect(ep)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors text-left group"
                  >
                    <div className="size-8 rounded-lg bg-white/5 grid place-items-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Play className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold truncate">{ep.material || ep.tipo || `Ep. ${i + 1}`}</p>
                        <StatusBadge status={status} />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {ep.tipo && <span className="text-primary font-bold uppercase tracking-wide">{ep.tipo}</span>}
                        {ep.tipo && ep.data && <span>•</span>}
                        {ep.data && <span>{String(ep.data)}</span>}
                        {(ep.horario || (ep as any).horarioStr) && <span>às {fmtTime(ep.horario || (ep as any).horarioStr)}</span>}
                      </div>
                    </div>
                    {ep.buff && (
                      <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[9px] font-black shrink-0">⚡ {ep.buff}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PLANNER (grade por data) ─────────────────────────────────────────────────
function PlannerView({ schedule, currentRowNum, onSelect }: {
  schedule: TvProgram[];
  currentRowNum?: number;
  onSelect: (p: TvProgram) => void;
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

  const todayStr = `${String(today.getDate()).padStart(2,"0")}/${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`;
  const [selectedDate, setSelectedDate] = useState<string>(
    datesWithEvents.has(todayStr) ? todayStr : (Array.from(datesWithEvents)[0] as string ?? "")
  );

  function navMonth(dir: number) {
    let m = month + dir, y = year;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setMonth(m); setYear(y);
  }

  const grouped = groupByDate(schedule);
  const dayPrograms = selectedDate ? (grouped[selectedDate] || []) : [];

  return (
    <div className="grid lg:grid-cols-[280px,1fr] gap-6">
      {/* Mini Calendário */}
      <div className="rounded-3xl border border-border bg-card p-4 select-none h-fit">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navMonth(-1)} className="size-7 rounded-lg hover:bg-white/10 grid place-items-center transition-colors">
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-xs font-black uppercase tracking-widest">{MESES_PT[month]} {year}</p>
          <button onClick={() => navMonth(1)}  className="size-7 rounded-lg hover:bg-white/10 grid place-items-center transition-colors">
            <ChevronRight className="size-4" />
          </button>
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
                  ${!hasEvent ? "text-muted-foreground/30 cursor-default" : "cursor-pointer"}
                `}
              >
                {day}
                {hasEvent && !isSel && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div className="mt-4 pt-4 border-t border-border">
            {(() => {
              const { diaSemana, dia, mes } = fmtDataLabel(selectedDate);
              return (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{diaSemana}</p>
                  <p className="text-lg font-black">{dia} <span className="text-muted-foreground font-medium text-sm">{mes}</span></p>
                  <p className="text-[10px] text-muted-foreground mt-1">{dayPrograms.length} programa{dayPrograms.length !== 1 ? "s" : ""}</p>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Lista do dia */}
      <div className="space-y-3">
        {dayPrograms.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
            <CalendarDays className="size-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Selecione uma data com programação</p>
          </div>
        )}
        {dayPrograms.map((ep, i) => {
          const status = getProgramStatus(ep, currentRowNum);
          const capa   = driveImgUrl(ep.capaUrl as string | undefined ?? "");
          return (
            <motion.button
              key={ep.rowNum ?? i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(ep)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-white/5 transition-colors text-left group"
            >
              <div className="size-16 rounded-xl overflow-hidden bg-black/40 shrink-0 relative">
                {capa ? (
                  <img src={capa} alt={ep.programa || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/20 to-black">
                    <Tv className="size-5 text-primary/50" />
                  </div>
                )}
                <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                  <Play className="size-5 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-sm truncate">{ep.programa || ep.titulo || "Programa"}</p>
                  <StatusBadge status={status} />
                </div>
                <div className="flex items-center gap-2 text-[10px] flex-wrap">
                  {ep.tipo && <span className="text-primary font-bold uppercase tracking-wide">{ep.tipo}</span>}
                  {ep.material && <span className="text-muted-foreground">{ep.material}</span>}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Clock className="size-3" />
                  <span>{fmtTime(ep.horario || (ep as any).horarioStr)}</span>
                </div>
              </div>

              {ep.buff && (
                <span className="px-2 py-1 rounded-xl bg-yellow-500/20 text-yellow-400 text-[9px] font-black shrink-0">⚡ {ep.buff}</span>
              )}
            </motion.button>
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
  const capaConvertida = driveImgUrl(program.capaUrl as string | undefined ?? "");
  const programName    = program.programa || program.titulo || "Programa";

  const threadId = (() => {
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
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" />
          Voltar para a grade
        </button>
      )}

      <div className="grid lg:grid-cols-[1fr,380px] gap-5">
        {/* Coluna esquerda: título + player + nowPlaying */}
        <div className="space-y-3">
          {/* Nome do programa ACIMA do player */}
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              {isBroadcasting && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">
                  <span className="size-1.5 rounded-full bg-white animate-pulse" />
                  Ao vivo agora
                </span>
              )}
              {program.data && (
                <span className="text-xs text-muted-foreground">{String(program.data)}</span>
              )}
              {(program.horario || (program as any).horarioStr) && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  {fmtTime(program.horario || (program as any).horarioStr as string)}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black tracking-tight">{programName}</h2>
          </motion.div>

          {/* Player */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
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
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-4">
                {capaConvertida
                  ? <img src={capaConvertida} alt="" className="w-32 rounded-xl opacity-30" />
                  : <Tv className="size-12 text-muted-foreground" />
                }
                <p className="font-black uppercase tracking-widest text-sm text-white">
                  {current?.status === "upcoming" && isCurrent ? "Transmissão em breve" : "Fora do ar"}
                </p>
                {current?.status === "upcoming" && isCurrent && (
                  <p className="text-xs text-muted-foreground -mt-2">às {fmtTime((program.horario || (program as any).horarioStr) as string)}</p>
                )}
              </div>
            )}
            {isBroadcasting && (
              <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-black uppercase tracking-widest z-10">
                <span className="size-2 rounded-full bg-white animate-pulse" /> Ao vivo
              </div>
            )}
          </motion.div>

          {/* NowPlaying — tipo, material e buff ABAIXO do player */}
          <NowPlayingBar program={program} />
        </div>

        {/* Chat Telegram embarcado */}
        <div className="rounded-3xl border border-border bg-card flex flex-col overflow-hidden" style={{ minHeight: 520 }}>
          <div className="p-4 border-b border-border flex items-center gap-2">
            <MessageCircle className="size-4 text-primary" />
            <p className="text-xs font-black uppercase tracking-widest">Chat ao vivo</p>
          </div>
          <div className="flex-1 relative">
            {threadId ? (
              <iframe
                key={threadId}
                src={`https://t.me/${TELEGRAM_CHANNEL}/${threadId}?embed=1&discussion=${TELEGRAM_CHANNEL}&comments_limit=50&color=8B5CF6&dark=1`}
                className="absolute inset-0 w-full h-full border-0"
                allow="autoplay; encrypted-media"
                title="Chat Empire TV"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center px-6 space-y-2">
                  <MessageCircle className="size-8 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">O chat estará disponível quando a transmissão começar.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
type ViewMode = "grade" | "data";

function TvPage() {
  const [data, setData]                = useState<TvStatus | null>(null);
  const [loading, setLoading]          = useState(true);
  const [selectedProgram, setSelected] = useState<TvProgram | null>(null);
  const [viewMode, setViewMode]        = useState<ViewMode>("grade");

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
  const featured      = current ?? null;
  const byPrograma    = groupByPrograma(fullSchedule);
  const upcoming      = fullSchedule.filter(p => {
    const s = String(p.status || "").toLowerCase();
    return s !== "finalizado" && s !== "ended";
  });

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
          {current && !selectedProgram && (
            <button
              onClick={() => setSelected(current)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-500 transition-colors"
            >
              <span className="size-1.5 rounded-full bg-white animate-pulse" />
              Assistir ao vivo
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
            {selectedProgram ? (
              <motion.div key="room" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <EventRoom
                  program={selectedProgram}
                  current={current}
                  onBack={() => setSelected(null)}
                />
              </motion.div>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

                {/* Banner destaque */}
                {featured && (
                  <motion.div
                    className="relative rounded-3xl overflow-hidden border border-border cursor-pointer group"
                    onClick={() => setSelected(featured)}
                    whileHover={{ scale: 1.005 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {driveImgUrl(featured.capaUrl as string | undefined ?? "") ? (
                      <div className="absolute inset-0">
                        <img
                          src={driveImgUrl(featured.capaUrl as string | undefined ?? "")}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-black" />
                    )}

                    <div className="relative p-6 md:p-10 space-y-3 min-h-[200px] flex flex-col justify-end">
                      <div className="flex items-center gap-2 flex-wrap">
                        {String(featured.status || "").toLowerCase() === "broadcasting" ? (
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">
                            <span className="size-1.5 rounded-full bg-white animate-pulse" />
                            Ao vivo agora
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">Em breve</span>
                        )}
                        {featured.tipo && <span className="text-xs font-bold text-white/60 uppercase">{featured.tipo}</span>}
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white drop-shadow-md">
                        {featured.programa || featured.titulo || "Empire TV"}
                      </h2>
                      {(featured.material || featured.buff) && (
                        <div className="flex items-center gap-3 flex-wrap">
                          {featured.material && (
                            <span className="flex items-center gap-1.5 text-sm text-white/70">
                              <Music2 className="size-3.5" />
                              {featured.material}
                            </span>
                          )}
                          {featured.buff && (
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-black">
                              <Zap className="size-3" />
                              {featured.buff}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-4 pt-1">
                        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-black hover:bg-white/90 transition-colors">
                          <Play className="size-4" /> Assistir
                        </button>
                        {featured.data && (
                          <span className="text-xs text-white/50">
                            {String(featured.data)} · {fmtTime(featured.horario || (featured as any).horarioStr)}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Seletor de view */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode("grade")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors
                      ${viewMode === "grade" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-white/5"}`}
                  >
                    <LayoutGrid className="size-3.5" /> Grade
                  </button>
                  <button
                    onClick={() => setViewMode("data")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors
                      ${viewMode === "data" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-white/5"}`}
                  >
                    <CalendarDays className="size-3.5" /> Por data
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {viewMode === "grade" ? (
                    <motion.div key="grade-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      {Object.keys(byPrograma).length === 0 && (
                        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
                          <Tv className="size-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Nenhuma programação disponível</p>
                        </div>
                      )}
                      {Object.entries(byPrograma).map(([nome, eps]) => (
                        <ProgramRow
                          key={nome}
                          nome={nome}
                          episodios={eps}
                          currentRowNum={currentRowNum}
                          onSelect={setSelected}
                        />
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div key="data-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <PlannerView
                        schedule={upcoming}
                        currentRowNum={currentRowNum}
                        onSelect={setSelected}
                      />
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
