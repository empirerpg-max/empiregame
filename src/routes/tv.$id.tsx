import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Tv, Loader2, Radio, ExternalLink, MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import { useTelegramUser } from "@/lib/telegram";
import { tvApi, buildPlayerSrc, type TvStatus, type TvProgram } from "@/lib/empiretv";

export const Route = createFileRoute("/tv/$id")({
  component: TvRoomPage,
});

function fmtTime(v?: string | number) {
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") {
    return `${String(Math.floor(v/3600)).padStart(2,"0")}:${String(Math.floor((v%3600)/60)).padStart(2,"0")}`;
  }
  const m = String(v).match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2,"0")}:${m[2]}`;
  return String(v);
}

function TvRoomPage() {
  const { id }     = Route.useParams();
  const navigate   = useNavigate();
  const { user }   = useTelegramUser();
  const [data, setData]       = useState<TvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const participacaoRegistrada = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const tick = () => tvApi.status().then(r => alive && setData(r)).finally(() => alive && setLoading(false));
    tick();
    const idInterval = setInterval(tick, 15_000);
    return () => { alive = false; clearInterval(idInterval); };
  }, []);

  // Encontra o programa pelo rowNum
  const schedule = data?.fullSchedule ?? [];
  const current  = data?.current ?? null;
  const program: TvProgram | null =
    schedule.find(p => String(p.rowNum) === id) ||
    (current && String(current.rowNum) === id ? current : null);

  const isCurrent      = current && String(current.rowNum) === id;
  const isBroadcasting = isCurrent && current?.status === "broadcasting";
  const playerSrc      = buildPlayerSrc(program);
  const topicoUrl      = program?.topicoUrl as string | undefined;
  const threadId       = topicoUrl?.split("/").pop();

  // Registra participação
  useEffect(() => {
    if (!user?.id || !isBroadcasting || !program) return;
    const programa = program.programa || program.titulo || "";
    const chave    = `${user.id}_${programa}`;
    if (participacaoRegistrada.current.has(chave)) return;
    participacaoRegistrada.current.add(chave);
    tvApi.registrarParticipacao({
      tgId:    String(user.id),
      nome:    user.name || "Jogador",
      programa,
      tipo:    String(program.tipo || ""),
    });
  }, [user, isBroadcasting, program?.programa]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-5">

        {/* Voltar */}
        <button
          onClick={() => navigate({ to: "/tv" })}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Voltar para a grade
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : !program ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Radio className="size-10 text-muted-foreground" />
            <p className="font-black uppercase tracking-widest text-sm">Programa não encontrado</p>
            <button onClick={() => navigate({ to: "/tv" })} className="text-xs text-primary hover:underline">
              Ver grade completa
            </button>
          </div>
        ) : (
          <>
            {/* Info do programa */}
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-border bg-card overflow-hidden"
            >
              {(program.capaUrl as string) && (
                <div className="relative w-full" style={{ aspectRatio: "21/4" }}>
                  <img
                    src={program.capaUrl as string}
                    alt=""
                    className="w-full h-full object-cover"
                  />
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
                    <h2 className="text-2xl font-black">
                      {program.programa || program.titulo || "Programa"}
                    </h2>
                    {program.tipo && (
                      <p className="text-sm font-bold text-primary uppercase tracking-wide">{program.tipo}</p>
                    )}
                    {program.material && (
                      <p className="text-sm text-muted-foreground">{program.material}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {program.data && <p className="text-xs text-muted-foreground">{String(program.data)}</p>}
                    <p className="text-sm font-bold tabular-nums">{fmtTime(program.horario || program.inicio as any)}</p>
                  </div>
                </div>
                {program.buff && (
                  <span className="inline-block px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest">
                    ⚡ BUFF: {program.buff}
                  </span>
                )}
              </div>
            </motion.div>

            <div className="grid lg:grid-cols-[1fr,380px] gap-6">

              {/* Player */}
              <div className="space-y-3">
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
                    <div className="absolute inset-0 grid place-items-center bg-black">
                      <div className="text-center px-6 space-y-2">
                        {(program.capaUrl as string) ? (
                          <img src={program.capaUrl as string} alt="" className="w-32 rounded-xl mx-auto opacity-40" />
                        ) : (
                          <Tv className="size-12 text-muted-foreground mx-auto" />
                        )}
                        <p className="font-black uppercase tracking-widest text-sm text-white">
                          {current?.status === "upcoming" && isCurrent ? "Transmissão em breve" : "Fora do ar"}
                        </p>
                        {current?.status === "upcoming" && isCurrent && (
                          <p className="text-xs text-muted-foreground">
                            às {fmtTime(program.horario as string)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {isBroadcasting && (
                    <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-black uppercase tracking-widest z-10">
                      <span className="size-2 rounded-full bg-white animate-pulse" />
                      Ao vivo
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Chat Telegram */}
              <div className="rounded-3xl border border-border bg-card flex flex-col overflow-hidden" style={{ minHeight: 520 }}>
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest">Chat</p>
                  {topicoUrl && (
                    <a
                      href={topicoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      Abrir no Telegram
                    </a>
                  )}
                </div>

                <div className="flex-1 relative">
                  {threadId ? (
                    <iframe
                      key={threadId}
                      src={`https://t.me/empireventos1/${threadId}?embed=1&discussion=empireventos1&comments_limit=50&color=8B5CF6&dark=1`}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="autoplay; encrypted-media"
                      title="Chat Empire TV"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="text-center px-6 space-y-2">
                        <MessageCircle className="size-8 text-muted-foreground mx-auto" />
                        <p className="text-xs text-muted-foreground">
                          O chat será aberto quando a transmissão começar.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-border">
                  <a
                    href={topicoUrl || "https://t.me/empireventos1"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    <MessageCircle className="size-4" />
                    Comentar no Telegram
                  </a>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
