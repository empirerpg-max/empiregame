import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Tv, Loader2, Radio, CalendarClock, ExternalLink, MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import { useTelegramUser } from "@/lib/telegram";
import { tvApi, buildPlayerSrc, type TvStatus } from "@/lib/empiretv";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "Empire TV — Transmissões" },
      { name: "description", content: "Programação ao vivo da Empire TV." },
    ],
  }),
  component: TvPage,
});

function fmtTime(v?: string | number) {
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") {
    const h = Math.floor(v / 3600);
    const m = Math.floor((v % 3600) / 60);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime()))
    return d.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
  const m = String(v).match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2,"0")}:${m[2]}`;
  return String(v);
}

function TvPage() {
  const { user }    = useTelegramUser();
  const [data, setData]     = useState<TvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const participacaoRegistrada = useRef<Set<string>>(new Set());

  // Polling status a cada 15s
  useEffect(() => {
    let alive = true;
    const tick = () => {
      tvApi.status()
        .then((r) => alive && setData(r))
        .finally(() => alive && setLoading(false));
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Registra participação ao abrir durante transmissão
  useEffect(() => {
    if (!user?.id || !data?.current) return;
    const programa = data.current.programa || data.current.titulo || "";
    const chave    = `${user.id}_${programa}`;
    if (participacaoRegistrada.current.has(chave)) return;
    participacaoRegistrada.current.add(chave);
    tvApi.registrarParticipacao({
      tgId:    String(user.id),
      nome:    user.name || "Jogador",
      programa,
      tipo:    String(data.current.tipo || ""),
    });
  }, [user, data?.current?.programa]);

  const current        = data?.current ?? null;
  const schedule       = data?.fullSchedule ?? [];
  const playerSrc      = buildPlayerSrc(current);
  const isBroadcasting = current?.status === "broadcasting";
  const topicoUrl      = current?.topicoUrl as string | undefined;

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
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Transmissão ao vivo
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr,380px] gap-6">

          {/* Coluna esquerda */}
          <div className="space-y-4">

            {/* Cabeçalho do programa atual */}
            {isBroadcasting && (
              <motion.div
                initial={{ opacity:0, y:-6 }}
                animate={{ opacity:1, y:0 }}
                className="rounded-3xl border border-primary/30 bg-primary/5 p-4 space-y-1"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                  No ar agora
                </p>
                <h2 className="text-xl font-black">
                  {current?.programa || current?.titulo || "Programa"}
                </h2>
                {current?.tipo && (
                  <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                    {current.tipo}
                  </p>
                )}
                {current?.material && (
                  <p className="text-sm text-foreground/80">{current.material}</p>
                )}
                {current?.buff && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest">
                    ⚡ BUFF: {current.buff}
                  </span>
                )}
              </motion.div>
            )}

            {/* Player Kick — aspect ratio original sem corte */}
            <motion.div
              initial={{ opacity:0, y:8 }}
              animate={{ opacity:1, y:0 }}
              className="relative w-full rounded-3xl overflow-hidden border border-border bg-black"
              style={{ aspectRatio:"16/9" }}
            >
              {loading ? (
                <div className="absolute inset-0 grid place-items-center">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </div>
              ) : (
                <iframe
                  key={playerSrc}
                  src={playerSrc}
                  title="Empire TV — Kick"
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              )}

              {isBroadcasting && (
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-black uppercase tracking-widest z-10">
                  <span className="size-2 rounded-full bg-white animate-pulse" />
                  Ao vivo
                </div>
              )}

              {!loading && !isBroadcasting && (
                <div className="absolute inset-0 grid place-items-center bg-black/80">
                  <div className="text-center px-6">
                    <Radio className="size-10 text-muted-foreground mx-auto mb-2" />
                    <p className="font-black uppercase tracking-widest text-sm text-white">
                      {current?.status === "upcoming" ? "Em breve" : "Sem transmissão no ar"}
                    </p>
                    {current?.status === "upcoming" && current?.programa && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Próximo: <strong>{current.programa}</strong> às {fmtTime(current.horario as string)}
                      </p>
                    )}
                    {data?.message && (
                      <p className="text-xs text-muted-foreground mt-1">{data.message}</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Grade */}
            <div className="rounded-3xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="size-4 text-primary" />
                <p className="text-xs font-black uppercase tracking-widest">Programação</p>
              </div>
              {schedule.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum programa agendado.</p>
              ) : (
                <ul className="space-y-2">
                  {schedule.map((p, i) => {
                    const isNow = isBroadcasting &&
                      (p.programa || p.titulo) === (current?.programa || current?.titulo) &&
                      p.inicio === current?.inicio;
                    return (
                      <li
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                          isNow ? "border-primary/40 bg-primary/10" : "border-border bg-background"
                        }`}
                      >
                        <div className="text-xs font-black tabular-nums w-16 text-muted-foreground shrink-0">
                          {fmtTime(p.inicio as any)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{p.programa || p.titulo || "—"}</p>
                          {p.tipo && (
                            <p className="text-xs text-muted-foreground truncate">{p.tipo}</p>
                          )}
                          {p.material && (
                            <p className="text-xs text-foreground/60 truncate">{p.material}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {p.topicoUrl && (
                            <a
                              href={String(p.topicoUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
                            >
                              <MessageCircle className="size-3" />
                              Chat
                            </a>
                          )}
                          {isNow && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                              Agora
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Coluna direita — Chat Telegram embedado */}
          <div className="rounded-3xl border border-border bg-card flex flex-col overflow-hidden" style={{ minHeight: 600 }}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest">Chat ao vivo</p>
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
              {topicoUrl ? (
                // Widget oficial do Telegram — chat em tempo real nativo
                <iframe
                  key={topicoUrl}
                  src={`https://t.me/empireventos1/${topicoUrl.split("/").pop()}?embed=1&discussion=empireventos1&comments_limit=50&color=8B5CF6&dark=1`}
                  className="absolute inset-0 w-full h-full border-0"
                  allow="autoplay; encrypted-media"
                  title="Chat Empire TV"
                />
              ) : (
                // Fallback: chat geral do supergrupo enquanto não há programa no ar
                <iframe
                  src="https://t.me/empireventos1?embed=1&discussion=empireventos1&comments_limit=50&color=8B5CF6&dark=1"
                  className="absolute inset-0 w-full h-full border-0"
                  allow="autoplay; encrypted-media"
                  title="Chat Empire TV"
                />
              )}
            </div>

            {/* Botão para comentar — abre o tópico no Telegram */}
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
      </div>
    </div>
  );
}
