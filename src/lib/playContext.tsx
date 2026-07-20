import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type MediaType = "drive" | "youtube";

export type PlayItem = {
  id: string;
  titulo: string;
  artista: string;
  capa: string;
  /** Drive file-id puro OU YouTube video-id puro (11 chars) ou URL completa */
  audioSrc: string;
  letra?: string;
  categoria: "musica" | "musicvideo" | "video";
};

type PlayerState = {
  queue: PlayItem[];
  currentIdx: number | null;
  /**
   * `playing` representa o estado CONFIRMADO pelos eventos nativos do player.
   * Só vira true após 'play' (audio) ou onStateChange(PLAYING) (YouTube) dispararem.
   * Nunca é definido como true otimisticamente no onClick.
   */
  playing: boolean;
};

/** Instância do YT.Player da YouTube IFrame API nativa */
export type YTPlayerInstance = {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  destroy: () => void;
  getPlayerState: () => number;
};

type PlayContextType = {
  state: PlayerState;
  play: (item: PlayItem, queue?: PlayItem[]) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  close: () => void;
  mediaType: MediaType | null;
  currentMediaId: string | null;
  /** Ref para o elemento <audio> nativo (Drive) */
  audioRef: React.RefObject<HTMLAudioElement | null>;
  /** Ref para a instância interna do player do YouTube IFrame API */
  ytPlayerRef: React.MutableRefObject<YTPlayerInstance | null>;
  /** Chamado pelo player nativo quando a mídia REALMENTE começou a tocar */
  confirmPlaying: () => void;
  /** Chamado pelo player nativo quando a mídia REALMENTE parou/falhou */
  confirmPaused: () => void;
  /** Chamado ao fim da faixa — avança a fila ou reseta */
  onEnded: () => void;
  /** @deprecated mantido para não quebrar imports existentes */
  iframeSrc: null;
  /** @deprecated use confirmPlaying/confirmPaused */
  syncPlaying: (v: boolean) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function extractDriveId(str: string): string | null {
  if (!str) return null;
  const m =
    String(str).match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    String(str).match(/id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (!/^https?:\/\//.test(str) && !str.includes("/")) return str.trim();
  return null;
}

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

export function detectMediaType(audioSrc: string): MediaType {
  if (!audioSrc) return "drive";
  const s = audioSrc.trim();
  if (
    s.includes("youtube") ||
    s.includes("youtu.be") ||
    /^[a-zA-Z0-9_-]{11}$/.test(s)
  ) {
    return "youtube";
  }
  return "drive";
}

/**
 * Proxy Cloudflare para contornar CORS/CORB do Google Drive.
 * Rota o stream pelo worker em vez de chamar o Drive diretamente.
 */
export function driveProxyUrl(idOrUrl: string): string {
  const id = extractDriveId(idOrUrl) ?? idOrUrl;
  return `https://empire-drive-proxy.empirerpg-forum.workers.dev/?id=${id}`;
}

/** @deprecated use driveProxyUrl */
export const driveStreamUrl = driveProxyUrl;
/** @deprecated use driveProxyUrl */
export const driveAudioPreview = driveProxyUrl;

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const PlayContext = createContext<PlayContextType | null>(null);

export function PlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>({
    queue: [],
    currentIdx: null,
    playing: false,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);

  // ── Derivados ───────────────────────────────────────────────────────────────────
  const currentItem =
    state.currentIdx !== null ? state.queue[state.currentIdx] : null;

  const mediaType: MediaType | null = currentItem
    ? detectMediaType(currentItem.audioSrc)
    : null;

  const currentMediaId: string | null = currentItem
    ? mediaType === "youtube"
      ? (extractYouTubeId(currentItem.audioSrc) ?? currentItem.audioSrc)
      : (extractDriveId(currentItem.audioSrc) ?? currentItem.audioSrc)
    : null;

  // ── Confirmações de estado (chamadas pelos eventos nativos) ──────────────

  const confirmPlaying = useCallback(() => {
    setState((s) => ({ ...s, playing: true }));
  }, []);

  const confirmPaused = useCallback(() => {
    setState((s) => ({ ...s, playing: false }));
  }, []);

  /** @deprecated */
  const syncPlaying = useCallback((v: boolean) => {
    setState((s) => ({ ...s, playing: v }));
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────

  /**
   * Registra a faixa/fila e já seta o src no elemento <audio>.
   * playing=false propositalmente: o MiniPlayer dispara .play() no onClick
   * (user-gesture) e só então confirmPlaying() atualiza o estado.
   *
   * Setar src aqui (e não só no useEffect do MiniPlayer) elimina a race
   * condition onde o usuário clica em Play antes do useEffect rodar.
   */
  const play = useCallback(
    (item: PlayItem, queue?: PlayItem[]) => {
      const newQueue = queue ?? [item];
      const idx = queue ? queue.findIndex((q) => q.id === item.id) : 0;
      setState({
        queue: newQueue,
        currentIdx: idx >= 0 ? idx : 0,
        playing: false,
      });

      // Pré-carrega o src no elemento <audio> imediatamente
      // (sincronização com o useEffect do MiniPlayer, que também seta o src)
      const type = detectMediaType(item.audioSrc);
      if (type === "drive" && audioRef.current) {
        const id = extractDriveId(item.audioSrc) ?? item.audioSrc;
        const url = driveProxyUrl(id);
        if (audioRef.current.src !== url) {
          audioRef.current.pause();
          audioRef.current.src = url;
          audioRef.current.load();
        }
      }
    },
    []
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    try {
      ytPlayerRef.current?.pauseVideo();
    } catch {
      /* */
    }
    setState((s) => ({ ...s, playing: false }));
  }, []);

  // resume é intencional sem setState — o MiniPlayer usa triggerPlay() no onClick
  const resume = useCallback(() => {}, []);

  const close = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = "";
    try {
      ytPlayerRef.current?.stopVideo();
    } catch {
      /* */
    }
    setState({ queue: [], currentIdx: null, playing: false });
  }, []);

  const next = useCallback(() => {
    setState((s) => {
      if (s.currentIdx === null) return s;
      const nextIdx = s.currentIdx + 1;
      if (nextIdx >= s.queue.length) return s;
      return { ...s, currentIdx: nextIdx, playing: false };
    });
  }, []);

  const prev = useCallback(() => {
    setState((s) => {
      if (s.currentIdx === null) return s;
      const prevIdx = s.currentIdx - 1;
      if (prevIdx < 0) return s;
      return { ...s, currentIdx: prevIdx, playing: false };
    });
  }, []);

  const onEnded = useCallback(() => {
    setState((s) => {
      if (s.currentIdx === null) return s;
      const nextIdx = s.currentIdx + 1;
      if (nextIdx < s.queue.length) {
        return { ...s, currentIdx: nextIdx, playing: false };
      }
      return { ...s, playing: false };
    });
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
        mediaType,
        currentMediaId,
        audioRef,
        ytPlayerRef,
        confirmPlaying,
        confirmPaused,
        onEnded,
        iframeSrc: null,
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
