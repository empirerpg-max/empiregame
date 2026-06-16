import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Radio, Users } from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";
import { useTelegramUser } from "@/lib/telegram";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "Empire TV" },
      { name: "description", content: "Empire TV — transmissões ao vivo do Empire." },
    ],
  }),
  component: TvPage,
});

const STREAM_URL = "https://empiretv.vercel.app/";
const CHAT_STORAGE_KEY = "empire_tv_chat_v1";

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  ts: number;
  color: string;
}

const NAME_COLORS = [
  "text-rose-400",
  "text-amber-400",
  "text-emerald-400",
  "text-sky-400",
  "text-violet-400",
  "text-pink-400",
  "text-orange-400",
  "text-teal-400",
];

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

function TvPage() {
  const { user } = useTelegramUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const displayName = user?.name || "Anônimo";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-200))); } catch { /* ignore */ }
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    const msg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      user: displayName,
      text: t.slice(0, 300),
      ts: Date.now(),
      color: colorFor(displayName),
    };
    setMessages((m) => [...m, msg]);
    setText("");
  };

  return (
    <div className="fixed inset-0 top-[calc(4rem+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] flex flex-col bg-background text-foreground">
      {/* Sticky video stack */}
      <div className="sticky top-0 z-20 bg-background border-b border-border shadow-lg">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 bg-card/60 backdrop-blur">
          <div className="flex items-center gap-2 min-w-0">
            <img src={logoIcon} alt="Empire" className="size-7 rounded-md object-contain" />
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-none truncate">Empire TV</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                Transmissão ao vivo
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/15 text-red-400 font-bold">
              <Radio className="size-3 animate-pulse" /> AO VIVO
            </span>
            <span className="hidden sm:flex items-center gap-1 text-muted-foreground">
              <Users className="size-3" /> {messages.length}
            </span>
          </div>
        </div>

        {/* Video — 16:9, fixed at top */}
        <div className="relative w-full bg-black" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={STREAM_URL}
            title="Empire TV"
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; camera; microphone; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-h-0 bg-card/30">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Chat da transmissão
          </span>
          <span className="text-[10px] text-muted-foreground">{displayName}</span>
        </div>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 text-sm">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-xs text-center px-6">
              Seja o primeiro a comentar a transmissão.
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="leading-snug break-words">
                <span className={`font-bold ${m.color}`}>{m.user}</span>
                <span className="text-muted-foreground">: </span>
                <span className="text-foreground">{m.text}</span>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-center gap-2 px-3 py-2 border-t border-border bg-background"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mandar mensagem"
            maxLength={300}
            className="flex-1 h-9 px-3 rounded-md bg-muted text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1 disabled:opacity-40"
          >
            <Send className="size-4" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      </div>
    </div>
  );
}
