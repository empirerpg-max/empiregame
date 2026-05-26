import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tv, Send, Loader2, Radio, CalendarClock } from "lucide-react";
import { motion } from "motion/react";
import { useTelegramUser } from "@/lib/telegram";
import { tvApi, buildPlayerSrc, type TvStatus, type TvChatMessage } from "@/lib/empiretv";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "Empire TV — Transmissões" },
      { name: "description", content: "Programação ao vivo da Empire TV: transmissões agendadas e chat." },
    ],
  }),
  component: TvPage,
});

function fmtTime(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function TvPage() {
  const { user } = useTelegramUser();
  const [data, setData] = useState<TvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgs, setMsgs] = useState<TvChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      tvApi.status().then((r) => alive && setData(r)).finally(() => alive && setLoading(false));
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = () => tvApi.chatList().then((r) => alive && setMsgs(r)).catch(() => {});
    tick();
    const id = setInterval(tick, 5_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length]);

  const current = data?.current ?? null;
  const schedule = data?.fullSchedule ?? [];
  const playerSrc = useMemo(() => buildPlayerSrc(current), [current]);

  async function enviar() {
    const t = draft.trim();
    if (!t || !user?.id) return;
    setSending(true);
    try {
      await tvApi.chatSend({ tgId: user.id, nome: user.name || "Você", texto: t });
      setDraft("");
      const r = await tvApi.chatList();
      setMsgs(r);
    } finally {
      setSending(false);
    }
  }

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
              Transmissão agendada
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr,360px] gap-6">
          {/* Player + Now playing */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="aspect-video w-full rounded-3xl overflow-hidden border border-border bg-black grid place-items-center relative"
            >
              {loading ? (
                <Loader2 className="size-8 animate-spin text-primary" />
              ) : playerSrc ? (
                <iframe
                  key={playerSrc}
                  src={playerSrc}
                  title={current?.programa || current?.titulo || "Empire TV"}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              ) : (
                <div className="text-center px-6">
                  <Radio className="size-10 text-muted-foreground mx-auto mb-2" />
                  <p className="font-black uppercase tracking-widest text-sm">Sem transmissão no ar</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data?.message || "Aguarde o próximo programa da grade."}
                  </p>
                </div>
              )}
              {current && (
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-black uppercase tracking-widest">
                  <span className="size-2 rounded-full bg-white animate-pulse" />
                  Ao vivo
                </div>
              )}
            </motion.div>

            {current && (
              <div className="rounded-3xl border border-border bg-card p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">No ar agora</p>
                <h2 className="text-lg font-black mt-1">{current.programa || current.titulo || "Programa"}</h2>
                {current.descricao && (
                  <p className="text-sm text-muted-foreground mt-1">{String(current.descricao)}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {fmtTime(current.inicio)} → {fmtTime(current.fim)}
                </p>
              </div>
            )}

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
                    const isNow = current && (p.programa || p.titulo) === (current.programa || current.titulo) &&
                      p.inicio === current.inicio;
                    return (
                      <li
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-2xl border ${
                          isNow ? "border-primary/40 bg-primary/10" : "border-border bg-background"
                        }`}
                      >
                        <div className="text-xs font-black tabular-nums w-20 text-muted-foreground">
                          {fmtTime(p.inicio)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{p.programa || p.titulo || "—"}</p>
                          {p.descricao && (
                            <p className="text-xs text-muted-foreground truncate">{String(p.descricao)}</p>
                          )}
                        </div>
                        {isNow && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                            Agora
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Chat */}
          <div className="rounded-3xl border border-border bg-card flex flex-col h-[70vh] lg:h-auto lg:min-h-[600px]">
            <div className="p-4 border-b border-border">
              <p className="text-xs font-black uppercase tracking-widest">Chat ao vivo</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {msgs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center mt-8">Seja o primeiro a comentar.</p>
              ) : (
                msgs.map((m, i) => {
                  const mine = user?.id && String(m.tgId) === String(user.id);
                  return (
                    <div
                      key={m.id || i}
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-background border border-border"
                      }`}
                    >
                      {!mine && (
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
                          {m.nome || "Anon"}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                    </div>
                  );
                })
              )}
              <div ref={chatEnd} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviar();
              }}
              className="p-3 border-t border-border flex gap-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={user?.id ? "Digite uma mensagem..." : "Faça login para conversar"}
                disabled={!user?.id || sending}
                className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!user?.id || sending || !draft.trim()}
                className="size-10 rounded-xl bg-primary text-primary-foreground grid place-items-center disabled:opacity-40"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
