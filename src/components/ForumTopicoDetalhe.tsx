// src/components/ForumTopicoDetalhe.tsx
// Fórum estilo Telegram com suporte a emojis, GIFs e stickers
// CORRIGIDO: usa id_do_topico, nome_do_jogador, comentario do backend

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  ChevronLeft, Play, Music, Send, Smile, X,
  Check, Loader2,
} from "lucide-react";
import {
  getField,
  resolveThumb,
  formatRelativo,
  normalizeComentario,
} from "@/lib/playHelpers";
import type { PlayItem, ForumComentario, NovoComentarioPayload } from "@/types/play";
import { usePlay } from "@/lib/playContext";

const API_URL =
  "https://script.google.com/macros/s/AKfycby1S1mIBXdj4hLqc9RYv1ZJjL7d5ct6to18FNPmpJn1KOnZrYCKJKPNe2LP0dPW-G8HOg/exec";

// ─── Emojis disponíveis no picker ──────────────────────────────────────────
const EMOJI_LIST = [
  "😀","😂","🥹","😍","🤩","😎","🥶","😭","😤","🤯",
  "🔥","❤️","💯","👏","🎵","🎶","🎤","🎸","🥁","🎧",
  "🏆","⭐","✨","💥","👑","🙌","💪","🫶","🤝","👀",
  "🎮","🕹️","🎲","🃏","🌟","💫","🌙","☀️","🌈","🎉",
  "🎊","🥳","🤣","😜","😏","😬","🙄","😇","🤔","💀",
];

// ─── GIFs rápidos (Tenor público) ──────────────────────────────────────────
const QUICK_GIFS = [
  { label: "🔥 Fire",  url: "https://media.tenor.com/2Jtq6YeRJuwAAAAC/fire.gif" },
  { label: "👏 Clap",  url: "https://media.tenor.com/IqEMKSHQMBsAAAAC/applause.gif" },
  { label: "😂 Laugh", url: "https://media.tenor.com/ybx9I74paZ8AAAAC/laugh.gif" },
  { label: "🏆 Win",   url: "https://media.tenor.com/TLsDBDW0-SkAAAAC/trophy.gif" },
  { label: "❤️ Love",  url: "https://media.tenor.com/FuGX2nGjbHkAAAAC/love.gif" },
  { label: "🎵 Music", url: "https://media.tenor.com/IRwl5V5tB9EAAAAC/music.gif" },
];

// ─── Stickers grandes ──────────────────────────────────────────────────────
const STICKER_LIST = [
  "🎵","🎶","🎸","🥁","🎤","🎧","🎹","🎺","🎻","🪗",
  "🏆","🥇","🎖️","🏅","👑","💎","🔥","⚡","💥","🌟",
  "🎮","🕹️","👾","🎲","🃏","🎯","🎪","🎠","🎡","🎢",
];

type PickerTab = "emoji" | "gif" | "sticker";

function ReacaoMedia({ value }: { value: string }) {
  if (!value) return null;
  if (value.startsWith("http") && (/\.gif(\?|$)/i.test(value) || /\/gif/i.test(value))) {
    return (
      <img
        src={value}
        alt="gif"
        className="h-10 w-auto max-w-[120px] rounded-lg object-contain"
        loading="lazy"
        decoding="async"
      />
    );
  }
  return <span className="text-lg leading-none">{value}</span>;
}

function ReacoesAgrupadas({ comentarios }: { comentarios: ForumComentario[] }) {
  const grupos = useMemo(() => {
    const map: Record<string, number> = {};
    comentarios.forEach((c) => {
      if (c.reacao) map[c.reacao] = (map[c.reacao] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [comentarios]);
  if (!grupos.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-1 pb-1">
      {grupos.map(([emoji, count]) => (
        <div
          key={emoji}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/[0.10] text-[11px] font-bold"
        >
          <ReacaoMedia value={emoji} />
          {count > 1 && <span className="text-muted-foreground text-[10px]">{count}</span>}
        </div>
      ))}
    </div>
  );
}

function MediaPicker({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const [tab, setTab] = useState<PickerTab>("emoji");
  if (!open) return null;
  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 z-30 rounded-2xl bg-[#1a1a1a] border border-white/[0.10] shadow-2xl overflow-hidden">
      <div className="flex border-b border-white/[0.06]">
        {(["emoji","gif","sticker"] as PickerTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
              tab === t
                ? "text-primary border-b-2 border-primary -mb-px"
                : "text-muted-foreground"
            }`}
          >
            {t === "emoji" ? "😀 Emoji" : t === "gif" ? "🎞 GIF" : "🎭 Sticker"}
          </button>
        ))}
        <button
          onClick={onClose}
          className="px-3 text-muted-foreground hover:text-white transition-colors"
          aria-label="Fechar picker"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="p-3 max-h-[200px] overflow-y-auto scrollbar-hide">
        {tab === "emoji" && (
          <div className="grid grid-cols-8 gap-1.5">
            {EMOJI_LIST.map((e) => (
              <button
                key={e}
                onClick={() => { onSelect(e); onClose(); }}
                className="size-9 rounded-xl grid place-items-center text-lg hover:bg-white/10 active:scale-90 transition-all"
                aria-label={e}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        {tab === "gif" && (
          <div className="grid grid-cols-3 gap-2">
            {QUICK_GIFS.map((g) => (
              <button
                key={g.url}
                onClick={() => { onSelect(g.url); onClose(); }}
                className="rounded-xl overflow-hidden aspect-video bg-white/[0.04] hover:ring-2 ring-primary transition-all"
                aria-label={g.label}
              >
                <img
                  src={g.url}
                  alt={g.label}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        )}
        {tab === "sticker" && (
          <div className="grid grid-cols-6 gap-2">
            {STICKER_LIST.map((s) => (
              <button
                key={s}
                onClick={() => { onSelect(s); onClose(); }}
                className="aspect-square rounded-xl grid place-items-center text-3xl hover:bg-white/10 active:scale-90 transition-all"
                aria-label={s}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentBubble({ comentario, isOwn = false }: { comentario: ForumComentario; isOwn?: boolean }) {
  const isGif =
    comentario.texto.startsWith("http") &&
    (/\.gif(\?|$)/i.test(comentario.texto) || /\/gif/i.test(comentario.texto));
  const isSticker =
    !comentario.texto.startsWith("http") &&
    [...comentario.texto].length <= 2;

  return (
    <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {!isOwn && (
        <div className="size-7 rounded-full bg-primary/20 grid place-items-center flex-shrink-0 mt-0.5">
          <span className="text-[10px] font-black text-primary">
            {(comentario.nome?.[0] ?? "?").toUpperCase()}
          </span>
        </div>
      )}
      <div
        className={`max-w-[72%] ${
          isGif || isSticker
            ? ""
            : `px-3 py-2 rounded-2xl ${
                isOwn
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-white/[0.07] rounded-tl-sm"
              }`
        }`}
      >
        {!isOwn && !isGif && !isSticker && (
          <p className="text-[9px] font-black uppercase tracking-tight text-primary mb-0.5">
            {comentario.nome}
          </p>
        )}
        {isGif ? (
          <img
            src={comentario.texto}
            alt="gif"
            className="rounded-2xl max-w-[200px] max-h-[160px] object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : isSticker ? (
          <span className="text-5xl leading-none block">{comentario.texto}</span>
        ) : (
          <p className="text-xs leading-relaxed break-words">{comentario.texto}</p>
        )}
        {comentario.reacao && (
          <div className="mt-1 inline-flex">
            <ReacaoMedia value={comentario.reacao} />
          </div>
        )}
        {comentario.timestamp && (
          <p className={`text-[9px] mt-0.5 ${
            isOwn ? "text-primary-foreground/60" : "text-muted-foreground/50"
          } text-right`}>
            {formatRelativo(comentario.timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}

function InlineMediaPlayer({ item }: { item: PlayItem }) {
  const { play } = usePlay();
  const [modalOpen, setModalOpen] = useState(false);
  const isVideo = item.categoria === "video" || item.categoria === "musicvideo";
  const src = item.audioSrc || "";
  const ytId = src.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/)?.[1];

  // VideoModal importado inline para manter compatibilidade
  // Se você tiver VideoModal separado, importe-o acima
  if (isVideo) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="mt-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1"
        >
          <Play className="size-3" fill="currentColor" />
          {ytId ? "Assistir no player" : "Assistir vídeo"}
        </button>
        {/* VideoModal inline placeholder — substitua pelo seu componente */}
        {modalOpen && (
          <div
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
            onClick={() => setModalOpen(false)}
          >
            <div className="w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {ytId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={item.titulo}
                />
              ) : (
                <video src={src} controls autoPlay className="w-full h-full" playsInline />
              )}
            </div>
          </div>
        )}
      </>
    );
  }
  return (
    <button
      onClick={() => play(item, [item], { autoPlay: true })}
      className="mt-2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1"
    >
      <Play className="size-3" fill="currentColor" /> Tocar
    </button>
  );
}

// ─── ForumTopicoDetalhe ───────────────────────────────────────────────────────
interface Props {
  item: PlayItem;
  categoria: string;
  onBack: () => void;
}

export default function ForumTopicoDetalhe({ item, categoria, onBack }: Props) {
  const [comentarios, setComentarios] = useState<ForumComentario[] | null>(null);
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [letraExpandida, setLetraExpandida] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetch(
      `${API_URL}?action=comentarios&categoria=${categoria}&idTopico=${encodeURIComponent(item.id)}`
    )
      .then((r) => r.json())
      .then((j) => {
        // CORRIGIDO: normalizeComentario usa id_do_topico, nome_do_jogador, comentario
        setComentarios((j.data || []).map((c: Record<string, string>) => normalizeComentario(c)));
      })
      .catch(() => setComentarios([]));
  }, [item.id, categoria]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [texto]);

  useEffect(() => {
    if (comentarios !== null)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [comentarios]);

  const enviarDireto = useCallback(async (conteudo: string) => {
    if (enviando || !conteudo) return;
    setEnviando(true);
    try {
      const payload: NovoComentarioPayload = {
        action: "novoComentario",
        categoria,
        idTopico: item.id,
        nomeJogador: nome.trim() || "Anônimo",
        comentario: conteudo,
      };
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      setEnviado(true);
      setTimeout(() => { load(); setEnviado(false); }, 800);
    } catch { /* silencia */ }
    finally { setEnviando(false); }
  }, [enviando, categoria, item.id, nome, load]);

  const insertMedia = useCallback((value: string) => {
    const isUrl = value.startsWith("http");
    if (isUrl) { enviarDireto(value); return; }
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? texto.length;
      const end = el.selectionEnd ?? texto.length;
      setTexto(texto.slice(0, start) + value + texto.slice(end));
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + value.length;
        el.focus();
      });
    } else {
      setTexto((t) => t + value);
    }
  }, [texto, enviarDireto]);

  const enviar = useCallback(async () => {
    const comentarioTexto = texto.trim();
    if (!comentarioTexto || enviando) return;
    setEnviando(true);
    setEnviado(false);
    try {
      const payload: NovoComentarioPayload = {
        action: "novoComentario",
        categoria,
        idTopico: item.id,
        nomeJogador: nome.trim() || "Anônimo",
        comentario: comentarioTexto,
      };
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      setTexto("");
      setEnviado(true);
      setTimeout(() => {
        load();
        setEnviado(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
      }, 800);
    } catch { /* silencia */ }
    finally { setEnviando(false); }
  }, [texto, enviando, categoria, item.id, nome, load]);

  const catLabel =
    categoria === "musicas" ? "🎵 Músicas"
    : categoria === "musicvideos" ? "🎬 Clipes"
    : "📺 Vídeos";

  return (
    <div className="flex flex-col space-y-0">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground active:text-primary transition-colors mb-3"
      >
        <ChevronLeft className="size-4" />
        <span>{catLabel}</span>
      </button>

      {/* Header tópico */}
      <div className="rounded-[1.5rem] overflow-hidden bg-white/[0.03] border border-white/[0.06] mb-3">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/70">{catLabel}</span>
            <span className="text-[9px] text-muted-foreground/40">· tópico</span>
          </div>
          <div className="flex items-start gap-3">
            <div className="size-14 rounded-2xl overflow-hidden bg-primary/10 flex-shrink-0">
              {item.capa
                ? <img src={resolveThumb(item.capa, 80)} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <div className="w-full h-full grid place-items-center"><Music className="size-5 text-primary/40" /></div>
              }
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-sm uppercase tracking-tight leading-tight">{item.titulo}</p>
              {/* artista nunca será '-' após a correção */}
              {item.artista && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.artista}</p>
              )}
            </div>
          </div>
          <InlineMediaPlayer item={item} />
        </div>
        {item.letra && (
          <div className="border-t border-white/[0.06]">
            <button
              onClick={() => setLetraExpandida((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary active:opacity-70 transition-opacity select-none"
              aria-expanded={letraExpandida}
            >
              <span>📝 {letraExpandida ? "Ocultar Letra" : "Ver Letra Completa"}</span>
              <ChevronLeft className={`size-3.5 transition-transform duration-200 ${letraExpandida ? "-rotate-90" : "rotate-180"}`} />
            </button>
            {letraExpandida && (
              <div className="px-4 pb-4">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{item.letra}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="overflow-y-auto space-y-3 px-1 pb-2 min-h-[120px] max-h-[400px] scrollbar-hide">
        {comentarios === null ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="size-7 rounded-full bg-white/[0.05] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-1/4 rounded-full bg-white/[0.04] animate-pulse" />
                  <div className="h-8 w-3/4 rounded-2xl bg-white/[0.04] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : comentarios.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-4xl">💬</span>
            <p className="text-[10px] text-muted-foreground/60 font-black uppercase tracking-widest">Nenhum comentário ainda</p>
            <p className="text-[10px] text-muted-foreground/40">Seja o primeiro a comentar!</p>
          </div>
        ) : (
          <>
            <ReacoesAgrupadas comentarios={comentarios} />
            {comentarios.map((c, i) => (
              <CommentBubble key={`${c.nome}-${i}`} comentario={c} />
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input estilo Telegram */}
      <div className="sticky bottom-0 pt-2 pb-safe-bottom">
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome (opcional)"
          className="w-full mb-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-xs placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 transition-colors"
        />
        <div className="relative flex items-end gap-2 bg-white/[0.05] border border-white/[0.08] rounded-2xl px-2 py-1.5 focus-within:border-primary/40 transition-colors">
          <MediaPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={insertMedia}
          />
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className={`size-8 rounded-xl grid place-items-center flex-shrink-0 transition-colors ${
              pickerOpen ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"
            }`}
            aria-label="Emojis, GIFs e Stickers"
          >
            <Smile className="size-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
            }}
            placeholder="Escreva um comentário..."
            rows={1}
            className="flex-1 bg-transparent text-xs placeholder:text-muted-foreground/40 outline-none resize-none py-1.5 leading-relaxed max-h-[120px] overflow-y-auto scrollbar-hide"
          />
          <button
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            className={`size-8 rounded-xl grid place-items-center flex-shrink-0 transition-all ${
              texto.trim() && !enviando
                ? "bg-primary text-primary-foreground active:scale-90"
                : "text-muted-foreground/30"
            }`}
            aria-label="Enviar"
          >
            {enviando ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : enviado ? (
              <Check className="size-3.5" />
            ) : (
              <Send className="size-3.5" />
            )}
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/30 text-center mt-1.5 font-black uppercase tracking-widest">
          Enter para enviar · Shift+Enter nova linha
        </p>
      </div>
    </div>
  );
}
