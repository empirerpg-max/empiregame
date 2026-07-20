import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export type MediaType = "drive" | "youtube";

export type PlayItem = {
  id: string;
  titulo: string;
  artista: string;
  capa: string;
  audioSrc: string; // drive file-id puro OU youtube video-id puro
  letra?: string;
  categoria: "musica" | "musicvideo" | "video";
};

type PlayerState = {
  queue: PlayItem[];
  currentIdx: number | null;
  playing: boolean;
};

type PlayContextType = {
  state: PlayerState;
  play: (item: PlayItem, queue?: PlayItem[]) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  close: () => void;
  /** @deprecated use mediaType + currentMediaId instead */
  iframeSrc: string | null;
  mediaType: MediaType | null;
  currentMediaId: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  ytPlayerRef: React.MutableRefObject<YT.Player | null>;
  onEnded: () => void;
  syncPlaying: (isPlaying: boolean) => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Devolve o fileId puro do Google Drive a partir de:
 * - uma URL completa (drive.google.com/file/d/<id>/...)
 * - uma query-string (?id=<id>)
 * - já um ID puro (sem barras/protocol)
 */
export function extractDriveId(str: string): string | null {
  if (!str) return null;
  const m =
    String(str).match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    String(str).match(/id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (!/^https?:\/\//.test(str) && !str.includes("/")) return str.trim();
  return null;
}

/**
 * Devolve o videoId puro do YouTube a partir de:
 * - youtu.be/<id>
 * - youtube.com/watch?v=<id>
 * - youtube.com/embed/<id>
 * - já um ID puro (11 chars alfanuméricos)
 */
export function extractYouTubeId(str: string): string | null {
  if (!str) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = String(str).match(p);
    if (m) return m[1];
  }
  return null;
}

/** Detecta o tipo de mídia pelo conteúdo de audioSrc */
export function detectMediaType(audioSrc: string): MediaType {
  if (!audioSrc) return "drive";
  if (
    audioSrc.includes("youtube") ||
    audioSrc.includes("youtu.be") ||
    /^[a-zA-Z0-9_-]{11}$/.test(audioSrc.trim())
  ) {
    return "youtube";
  }
  return "drive";
}

/**
 * URL de stream direto do Google Drive (HTML5 <audio>).
 * NOTA: funciona para arquivos públicos ou compartilhados com "qualquer
 * pessoa com o link". O export=download faz o browser carregar o binário
 * diretamente, sem a página de preview do Drive.
 */
export function driveStreamUrl(idOrUrl: string): string {
  const id = extractDriveId(idOrUrl) ?? idOrUrl;
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

/** @deprecated mantido por compatibilidade – use driveStreamUrl */
export function driveAudioPreview(url: string): string {
  return driveStreamUrl(url);
}

// ─── Context ─────────────────────────────────────────────────────────────────

const PlayContext = createContext<PlayContextType | null>(null);

export function PlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>({
    queue: [],
    currentIdx: null,
    playing: false,
  });

  // Refs dos players nativos — criados aqui para existirem por toda a vida
  // do Provider sem re-montar quando a faixa muda.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YT.Player | null>(null);

  // ── Derivados ──────────────────────────────────────────────────────────────
  const currentItem =
    state.currentIdx !== null ? state.queue[state.currentIdx] : null;

  const mediaType: MediaType | null = currentItem
    ? detectMediaType(currentItem.audioSrc)
    : null;

  const currentMediaId: string | null = currentItem
    ? mediaType === "youtube"
      ? extractYouTubeId(currentItem.audioSrc) ?? currentItem.audioSrc
      : extractDriveId(currentItem.audioSrc) ?? currentItem.audioSrc
    : null;

  /** @deprecated */
  const iframeSrc: string | null =
    currentItem && state.playing && mediaType === "drive"
      ? driveStreamUrl(currentItem.audioSrc)
      : null;

  // ── Sincroniza playing → player nativo ─────────────────────────────────────
  useEffect(() => {
    if (!currentItem) return;

    if (mediaType === "drive" && audioRef.current) {
      if (state.playing) {
        audioRef.current.play().catch(() => {
          // Autoplay bloqueado: o botão de play já foi o gesto do usuário,
          // então isso não deveria acontecer. Apenas silencia o warning.
        });
      } else {
        audioRef.current.pause();
      }
    }

    if (mediaType === "youtube" && ytPlayerRef.current) {
      try {
        if (state.playing) {
          ytPlayerRef.current.playVideo();
        } else {
          ytPlayerRef.current.pauseVideo();
        }
      } catch {
        // player ainda não inicializado — o onReady do YouTube vai chamar
        // playVideo assim que estiver pronto.
      }
    }
  }, [state.playing, currentItem, mediaType]);

  // ── Troca de faixa: recarrega o elemento de áudio ──────────────────────────
  useEffect(() => {
    if (!currentItem || mediaType !== "drive") return;
    const audio = audioRef.current;
    if (!audio) return;

    const url = driveStreamUrl(currentItem.audioSrc);
    audio.src = url;
    audio.load();
    if (state.playing) {
      audio.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMediaId, mediaType]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const play = useCallback((item: PlayItem, queue?: PlayItem[]) => {
    const newQueue = queue ?? [item];
    const idx = queue ? queue.findIndex((q) => q.id === item.id) : 0;
    setState({ queue: newQueue, currentIdx: idx >= 0 ? idx : 0, playing: true });
  }, []);

  const pause = useCallback(() =>
    setState((s) => ({ ...s, playing: false })), []);

  const resume = useCallback(() =>
    setState((s) => ({ ...s, playing: true })), []);

  const close = useCallback(() => {
    // Para tudo antes de fechar
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.stopVideo(); } catch { /* */ }
    }
    setState({ queue: [], currentIdx: null, playing: false });
  }, []);

  const next = useCallback(() => {
    setState((s) => {
      if (s.currentIdx === null) return s;
      const nextIdx = s.currentIdx + 1;
      if (nextIdx >= s.queue.length) return s;
      return { ...s, currentIdx: nextIdx, playing: true };
    });
  }, []);

  const prev = useCallback(() => {
    setState((s) => {
      if (s.currentIdx === null) return s;
      const prevIdx = s.currentIdx - 1;
      if (prevIdx < 0) return s;
      return { ...s, currentIdx: prevIdx, playing: true };
    });
  }, []);

  /** Chamado pelo player quando a mídia termina — avança ou reseta */
  const onEnded = useCallback(() => {
    setState((s) => {
      if (s.currentIdx === null) return s;
      const nextIdx = s.currentIdx + 1;
      if (nextIdx < s.queue.length) {
        return { ...s, currentIdx: nextIdx, playing: true };
      }
      // Fim da fila: reseta mas mantém a última faixa visível
      return { ...s, playing: false };
    });
  }, []);

  /** Permite que o player de YouTube sincronize o estado quando o usuário
   *  pausa/retoma dentro do próprio iframe (opcional, mas deixa o ícone certo). */
  const syncPlaying = useCallback((isPlaying: boolean) => {
    setState((s) => ({ ...s, playing: isPlaying }));
  }, []);

  return (
    <PlayContext.Provider
      value={{
        state,
        play,
        pause,
        resume,
        next,
        prev,
        close,
        iframeSrc,
        mediaType,
        currentMediaId,
        audioRef,
        ytPlayerRef,
        onEnded,
        syncPlaying,
      }}
    >
      {children}
    </PlayContext.Provider>
  );
}

export function usePlay() {
  const ctx = useContext(PlayContext);
  if (!ctx) throw new Error("usePlay must be used inside PlayProvider");
  return ctx;
}
