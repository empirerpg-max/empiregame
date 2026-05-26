import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Tv, Send, Loader2, Radio, CalendarClock, ImageIcon, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTelegramUser } from "@/lib/telegram";
import {
  tvApi,
  buildPlayerSrc,
  searchGifs,
  type TvStatus,
  type TvChatMessage,
  type GifResult,
} from "@/lib/empiretv";

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
  // Se vier em segundos do dia (número)
  if (typeof v === "number") {
    const h = Math.floor(v / 3600);
    const m = Math.floor((v % 3600) / 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime()))
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  // String tipo "HH:MM:SS"
  const m = String(v).match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return String(v);
}

function TvPage() {
  const { user } = useTelegramUser();
  const [data, setData] = useState<TvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgs, setMsgs] = useState<TvChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const participacaoRegistrada = useRef<Set<string>>(new Set());

  // Polling status a cada 15s
  useEffect(() => {
    let alive = true;
    const tick = () => {
      tvApi
        .status()
        .then((r) => alive && setData(r))
        .finally(() => alive && setLoading(false));
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Polling chat a cada 5s
  useEffect(() => {
    let alive = true;
    const tick = () => tvApi.chatList().then((r) => alive && setMsgs(r)).catch(() => {});
    tick();
    const id = setInterval(tick, 5_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Scroll automático no chat
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length]);

  // Registra participação quando usuário abre a página durante uma transmissão
  useEffect(() => {
    if (!user?.id || !data?.current) return;
    const programa = data.current.programa || data.current.titulo || "";
    const chave = `${user.id}_${programa}`;
    if (participacaoRegistrada.current.has(chave)) return;
    participacaoRegistrada.current.add(chave);
    tvApi.registrarParticipacao({
      tgId: String(user.id),
      nome: user.name || "Jogador",
      programa,
    });
  }, [user, data?.current?.programa]);

  const current = data?.current ?? null;
  const schedule = data?.fullSchedule ?? [];
  const playerSrc = buildPlayerSrc(current);
  const isBroadcasting = current?.status === "broadcasting";

  async function enviar(texto?: string, gifUrl?: string) {
    const t = (texto || draft).trim();
    if ((!t && !gifUrl) || !user?.id) return;
    setSending(true);
    try {
      await tvApi.chatSend({
        tgId: String(user.id),
        nome: user.name || "Você",
        texto: gifUrl ? (t || "gif") : t,
        tipo: gifUrl ? "gif" : "texto",
        gifUrl: gifUrl || "",
      });
      setDraft("");
      setShowGifPicker(false);
      const r = await tvApi.chatList();
      setMsgs(r);
    } finally {
      setSending(false);
    }
  }

  async function buscarGifs(q: string) {
    if (!q.trim()) return;
    setGifLoading(true);
    const r = await searchGifs(q);
    setGifs(r);
    setGifLoading(false);
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
              Transmissão ao vivo
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr,360px] gap-6">
          {/* Coluna esquerda: player + info + grade */}
          <div className="space-y-4">

            {/* Cabeçalho do programa atual */}
            {isBroadcasting && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
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
                    +BUFF: {current.buff}
                  </span>
                )}
              </motion.div>
            )}

            {/* Player — aspect ratio original sem corte */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative w-full rounded-3xl overflow-hidden border border-border bg-black"
              style={{ aspectRatio: "16/9" }}
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

              {/* Badge ao vivo */}
              {isBroadcasting && (
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-black uppercase tracking-widest z-10">
                  <span className="size-2 rounded-full bg-white animate-pulse" />
                  Ao vivo
                </div>
              )}

              {/* Sem transmissão */}
              {!loading && !isBroadcasting && (
                <div className="absolute inset-0 grid place-items-center bg-black/80">
                  <div className="text-center px-6">
                    <Radio className="size-10 text-muted-foreground mx-auto mb-2" />
                    <p className="font-black uppercase tracking-widest text-sm text-white">
                      {current?.status === "upcoming" ? "Em breve" : "Sem transmissão no ar"}
                    </p>
                    {current?.status === "upcoming" && current?.programa && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Próximo: <strong>{current.programa}</strong> às{" "}
                        {fmtTime(current.horario as string)}
                      </p>
                    )}
                    {data?.message && (
                      <p className="text-xs text-muted-foreground mt-1">{data.message}</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Grade de programação */}
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
                    const isNow =
                      isBroadcasting &&
                      (p.programa || p.titulo) === (current?.programa || current?.titulo) &&
                      p.inicio === current?.inicio;
                    return (
                      <li
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                          isNow
                            ? "border-primary/40 bg-primary/10"
                            : "border-border bg-background"
                        }`}
                      >
                        <div className="text-xs font-black tabular-nums w-16 text-muted-foreground shrink-0">
                          {fmtTime(p.inicio as any)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">
                            {p.programa || p.titulo || "—"}
                          </p>
                          {p.tipo && (
                            <p className="text-xs text-muted-foreground truncate">{p.tipo}</p>
                          )}
                          {p.material && (
                            <p className="text-xs text-foreground/60 truncate">{p.material}</p>
                          )}
                        </div>
                        {isNow && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary shrink-0">
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

          {/* Chat ao vivo */}
          <div className="rounded-3xl border border-border bg-card flex flex-col h-[70vh] lg:h-auto lg:min-h-[600px]">
            <div className="p-4 border-b border-border">
              <p className="text-xs font-black uppercase tracking-widest">Chat ao vivo</p>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {msgs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center mt-8">
                  Seja o primeiro a comentar.
                </p>
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
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">
                          {m.nome || "Anon"}
                        </p>
                      )}
                      {m.tipo === "gif" && m.gifUrl ? (
                        <img
                          src={m.gifUrl}
                          alt={m.texto || "gif"}
                          className="rounded-xl max-w-full max-h-40 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatEnd} />
            </div>

            {/* GIF Picker */}
            <AnimatePresence>
              {showGifPicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 220, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border overflow-hidden"
                >
                  <div className="p-2 flex gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background border border-border">
                      <Search className="size-3 text-muted-foreground shrink-0" />
                      <input
                        value={gifQuery}
                        onChange={(e) => setGifQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && buscarGifs(gifQuery)}
                        placeholder="Buscar GIF..."
                        className="flex-1 bg-transparent text-xs focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => buscarGifs(gifQuery)}
                      className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
                    >
                      Buscar
                    </button>
                  </div>
                  <div className="px-2 pb-2 overflow-x-auto">
                    {gifLoading ? (
                      <div className="flex items-center justify-center h-24">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {gifs.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => enviar("", g.url)}
                            className="shrink-0 rounded-xl overflow-hidden border border-border hover:border-primary transition-colors"
                          >
                            <img
                              src={g.preview}
                              alt={g.title}
                              className="h-24 w-auto object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                        {gifs.length === 0 && (
                          <p className="text-xs text-muted-foreground p-4">
                            Nenhum GIF encontrado.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input do chat */}
            <form
              onSubmit={(e) => { e.preventDefault(); enviar(); }}
              className="p-3 border-t border-border flex gap-2"
            >
              <button
                type="button"
                onClick={() => setShowGifPicker((v) => !v)}
                disabled={!user?.id}
                className={`size-10 rounded-xl border grid place-items-center transition-colors disabled:opacity-40 ${
                  showGifPicker
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary"
                }`}
              >
                {showGifPicker ? <X className="size-4" /> : <ImageIcon className="size-4" />}
              </button>
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
