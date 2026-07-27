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

export type MediaType = "drive" | "youtube" | "telegram";

export type PlayItem = {
  id: string;
  titulo: string;
  artista: string;
  capa: string;
  /** Drive file-id puro OU YouTube video-id puro (11 chars) OU telegram_file_id (começa com BAA…) OU URL completa */
  audioSrc: string;
  letra?: string;
  categoria: "musica" | "musicvideo" | "video";
};

type PlayerState = {
  queue: PlayItem[];
  currentIdx: number | null;
  /**
   * `playing` representa a INTENÇÃO do usuário.
   * Quando autoPlay=true, já entra como true para o MiniPlayer acionar
   * triggerPlay() automaticamente no useEffect.
   */
  playing: boolean;
};

type PlayContextType = {
  state: PlayerState;
  play: (item: PlayItem, queue?: PlayItem[], opts?: { autoPlay?: boolean }) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  close: () => void;
  mediaType: MediaType | null;
  currentMediaId: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  ytPlayerRef: React.MutableRefObject<YT.Player | null>;
  /** Chamado pelo player nativo quando a mídia de fato começou a tocar */
  confirmPlaying: () => void;
  /** Chamado pelo player nativo quando a mídia foi pausada/parou */
  confirmPaused: () => void;
  /** Chamado ao fim da faixa — avança a fila ou reseta */
  onEnded: () => void;
  /** @deprecated mantido para não quebrar imports existentes */
  iframeSrc: null;
  /** @deprecated */
  syncPlaying: (v: boolean) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de extração de ID
// ─────────────────────────────────────────────────────────────────────────────

export function extractDriveId(str: string): string | null {
  if (!str) return null;
  const m =
    String(str).match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    String(str).match(/id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // Só retorna como Drive ID se NÃO for um telegram_file_id
  if (!/^https?:\/\//.test(str) && !str.includes("/") && !isTelegramFileId(str)) return str.trim();
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

/**
 * Detecta se a string é um telegram_file_id.
 * Formato típico: começa com "BAA", "AgA", "BAAC", etc. — base64url, 60+ chars.
 * Nunca tem espaços ou "/" e é consideravelmente mais longo que um YouTube ID (11 chars).
 */
export function isTelegramFileId(str: string): boolean {
  if (!str) return false;
  const s = str.trim();
  // Não é URL, não tem "/", tamanho ≥ 20 chars, apenas chars base64url
  return (
    !/^https?:\/\//.test(s) &&
    !s.includes("/") &&
    s.length >= 20 &&
    /^[A-Za-z0-9_-]+$/.test(s) &&
    // YouTube IDs têm exatamente 11 chars — se for maior, não é YT
    s.length !== 11
  );
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

  if (isTelegramFileId(s)) {
    return "telegram";
  }

  return "drive";
}

/**
 * URL de stream do Google Drive via proxy Cloudflare.
 * Evita CORS/CORB do Drive direto.
 */
export function driveStreamUrl(idOrUrl: string): string {
  const id = extractDriveId(idOrUrl) ?? idOrUrl;
  return `https://empire-media-api.empirerpg-forum.workers.dev/?id=${id}`;
}

/**
 * URL de stream de arquivo do Telegram via Bot API proxy Cloudflare.
 * O Worker chama getFile + redireciona para file.telegram.org.
 * Funciona para áudios (qualquer tamanho) e vídeos até 20MB (Bot API limit).
 */
export function telegramStreamUrl(fileId: string): string {
  return `https://empire-media-api.empirerpg-forum.workers.dev/tg?file_id=${encodeURIComponent(fileId)}`;
}

/** @deprecated – use driveStreamUrl */
export const driveAudioPreview = driveStreamUrl;
/** @deprecated – use driveStreamUrl */
export const driveProxyUrl = driveStreamUrl;

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
  const ytPlayerRef = useRef<YT.Player | null>(null);

  // ── Derivados ────────────────────────────────────────────────────────────
  const currentItem =
    state.currentIdx !== null ? state.queue[state.currentIdx] : null;

  const mediaType: MediaType | null = currentItem
    ? detectMediaType(currentItem.audioSrc)
    : null;

  const currentMediaId: string | null = currentItem
    ? mediaType === "youtube"
      ? (extractYouTubeId(currentItem.audioSrc) ?? currentItem.audioSrc)
      : mediaType === "telegram"
      ? currentItem.audioSrc.trim()
      : (extractDriveId(currentItem.audioSrc) ?? currentItem.audioSrc)
    : null;

  // ── Confirmações de estado real (chamadas pelo player nativo) ────────────

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

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Inicia a reprodução de um item.
   * Se opts.autoPlay=true, playing já entra como true e o MiniPlayer
   * aciona triggerPlay() automaticamente via useEffect [currentMediaId, playing].
   */
  const play = useCallback(
    (item: PlayItem, queue?: PlayItem[], opts?: { autoPlay?: boolean }) => {
      const newQueue = queue ?? [item];
      const idx = queue ? queue.findIndex((q) => q.id === item.id) : 0;
      setState({
        queue: newQueue,
        currentIdx: idx >= 0 ? idx : 0,
        playing: opts?.autoPlay === true,
      });
    },
    []
  );

  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.pauseVideo(); } catch { /* YT não iniciado */ }
    }
    setState((s) => ({ ...s, playing: false }));
  }, []);

  /**
   * Resume: seta playing:true imediatamente para o botão refletir
   * antes do evento 'play' chegar via confirmPlaying.
   * O MiniPlayer ainda chama triggerPlay() no onClick para garantir
   * o user-gesture no navegador.
   */
  const resume = useCallback(() => {
    setState((s) => ({ ...s, playing: true }));
  }, []);

  const close = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.stopVideo(); } catch { /* */ }
    }
    setState({ queue: [], currentIdx: null, playing: false });
  }, []);

  /**
   * next/prev: preservam o estado de playing para que o efeito 4
   * do MiniPlayer dispare triggerPlay() automaticamente na nova faixa
   * quando o usuário já estava ouvindo.
   */
  const next = useCallback(() => {
    setState((s) => {
      if (s.currentIdx === null) return s;
      const nextIdx = s.currentIdx + 1;
      if (nextIdx >= s.queue.length) return s;
      return { ...s, currentIdx: nextIdx };
    });
  }, []);

  const prev = useCallback(() => {
    setState((s) => {
      if (s.currentIdx === null) return s;
      const prevIdx = s.currentIdx - 1;
      if (prevIdx < 0) return s;
      return { ...s, currentIdx: prevIdx };
    });
  }, []);

  const onEnded = useCallback(() => {
    setState((s) => {
      if (s.currentIdx === null) return s;
      const nextIdx = s.currentIdx + 1;
      if (nextIdx < s.queue.length) {
        return { ...s, currentIdx: nextIdx, playing: true };
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
