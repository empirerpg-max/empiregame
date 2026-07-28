import React, { useState, useRef, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { ChevronDown, ChevronUp, Play, Send, Music, Film } from 'lucide-react';

// --- Telegram WebApp Auth (silent, native) ---
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initDataUnsafe: {
          user?: { id: number; first_name: string; username?: string; photo_url?: string };
        };
        ready: () => void;
      };
    };
  }
}

function useTelegramUser() {
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  return {
    id: tgUser?.id ?? 0,
    name: tgUser?.first_name ?? 'Anônimo',
    photo: tgUser?.photo_url,
  };
}

// --- Types ---
export interface Obra {
  id: string;
  title: string;
  artist: string;
  cover: string;
  type: 'music' | 'video';
  lyrics?: string;
  videoUrl?: string;
  streams: number;
}

export interface Comment {
  id: string;
  userId: number;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: string;
  optimistic?: boolean;
}

// --- SWR fetcher ---
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// --- MiniPlayer stub (calls existing player if available) ---
function MiniPlayerTrigger({ videoUrl, title }: { videoUrl: string; title: string }) {
  return (
    <button
      onClick={() => {
        // Integrate with existing MiniPlayer component via custom event
        window.dispatchEvent(new CustomEvent('empire:play', { detail: { videoUrl, title } }));
      }}
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#2AABEE] text-white font-semibold text-sm hover:bg-[#229ed9] transition-colors"
    >
      <Play size={16} className="fill-white" />
      Assistir
    </button>
  );
}

// --- Expandable Lyrics ---
function LyricsSection({ lyrics }: { lyrics: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/5 text-white text-sm font-medium"
      >
        <span className="flex items-center gap-2"><Music size={15} /> Letra</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="px-4 py-3 text-white/70 text-sm whitespace-pre-line leading-relaxed bg-black/20">
          {lyrics}
        </div>
      )}
    </div>
  );
}

// --- Comment Bubble (Telegram style) ---
function CommentBubble({ comment, isOwn }: { comment: Comment; isOwn: boolean }) {
  const initials = comment.userName.charAt(0).toUpperCase();
  return (
    <div className={`flex gap-2 items-end mb-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-[#2AABEE] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
        {comment.userPhoto
          ? <img src={comment.userPhoto} alt={comment.userName} className="w-full h-full object-cover" />
          : initials}
      </div>
      {/* Bubble */}
      <div
        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-snug shadow ${
          isOwn
            ? 'bg-[#2AABEE] text-white rounded-br-sm'
            : 'bg-[#1e2736] text-white/90 rounded-bl-sm'
        } ${comment.optimistic ? 'opacity-60' : 'opacity-100'} transition-opacity`}
      >
        {!isOwn && <p className="text-[10px] font-semibold text-[#2AABEE] mb-0.5">{comment.userName}</p>}
        <p>{comment.text}</p>
        <p className={`text-[10px] mt-1 text-right ${isOwn ? 'text-white/70' : 'text-white/40'}`}>
          {new Date(comment.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// --- Chat Interface ---
function ForumChat({ obraId, obraTitle }: { obraId: string; obraTitle: string }) {
  const telegramUser = useTelegramUser();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');

  const cacheKey = `/api/forum/${obraId}/comments`;
  const { data: comments = [] } = useSWR<Comment[]>(cacheKey, fetcher, {
    refreshInterval: 15000,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');

    const optimisticComment: Comment = {
      id: `opt-${Date.now()}`,
      userId: telegramUser.id,
      userName: telegramUser.name,
      userPhoto: telegramUser.photo,
      text: trimmed,
      createdAt: new Date().toISOString(),
      optimistic: true,
    };

    // Optimistic UI — add immediately
    await mutate(cacheKey, [...comments, optimisticComment], false);

    try {
      const res = await fetch(`/api/forum/${obraId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: telegramUser.id,
          userName: telegramUser.name,
          userPhoto: telegramUser.photo,
          text: trimmed,
        }),
      });
      const saved: Comment = await res.json();
      // Replace optimistic comment with real one
      await mutate(
        cacheKey,
        comments.filter((c) => !c.optimistic).concat(saved),
        false
      );
    } catch {
      // Rollback on error
      await mutate(cacheKey, comments, false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
        <span className="text-[#2AABEE] font-bold text-xs uppercase tracking-wider">💬 Comunidade</span>
        <span className="text-white/40 text-xs">— {obraTitle}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {comments.length === 0 && (
          <div className="text-center text-white/30 text-sm mt-8">
            Seja o primeiro a comentar! 🎵
          </div>
        )}
        {comments.map((c) => (
          <CommentBubble key={c.id} comment={c} isOwn={c.userId === telegramUser.id} />
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/10 flex items-center gap-2">
        <div className="flex-1 flex items-center bg-[#1e2736] rounded-full px-4 py-2">
          <input
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/30"
            placeholder="Escreva um comentário..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="w-9 h-9 rounded-full bg-[#2AABEE] flex items-center justify-center disabled:opacity-30 hover:bg-[#229ed9] transition-colors"
        >
          <Send size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}

// --- Main ForumObra Component ---
export default function ForumObra({ obra }: { obra: Obra }) {
  useEffect(() => {
    window.Telegram?.WebApp?.ready();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#0f1923] text-white">
      {/* Hero Cover */}
      <div className="relative w-full aspect-square max-h-72 overflow-hidden">
        <img
          src={obra.cover}
          alt={obra.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0f1923]/40 to-[#0f1923]" />
        {/* Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-white/80">
          {obra.type === 'music' ? <Music size={12} /> : <Film size={12} />}
          {obra.type === 'music' ? 'Música' : 'Vídeo'}
        </div>
      </div>

      {/* Info + Actions */}
      <div className="px-4 pt-2 pb-4">
        <h1 className="text-xl font-bold text-white leading-tight">{obra.title}</h1>
        <p className="text-white/60 text-sm mt-0.5">{obra.artist}</p>
        <p className="text-white/30 text-xs mt-1">{obra.streams.toLocaleString('pt-BR')} streams</p>

        <div className="mt-3 flex gap-2 flex-wrap">
          {obra.type === 'video' && obra.videoUrl && (
            <MiniPlayerTrigger videoUrl={obra.videoUrl} title={obra.title} />
          )}
          {obra.type === 'music' && obra.lyrics && (
            <LyricsSection lyrics={obra.lyrics} />
          )}
        </div>

        {/* Lyrics below cover for music without inline button */}
        {obra.type === 'music' && !obra.lyrics && (
          <p className="text-white/30 text-xs mt-2 italic">Letra não disponível.</p>
        )}
      </div>

      {/* Forum / Chat */}
      <div className="flex-1 flex flex-col border-t border-white/10">
        <ForumChat obraId={obra.id} obraTitle={obra.title} />
      </div>
    </div>
  );
}
