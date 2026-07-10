import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from "react";

export type PlayItem = {
  id: string;
  titulo: string;
  artista: string;
  capa: string;
  audioSrc: string; // drive_url ou youtube_id direto
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
  iframeSrc: string | null;
};

const PlayContext = createContext<PlayContextType | null>(null);

function extractDriveId(str: string): string | null {
  if (!str) return null;
  const m = String(str).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(str).match(/id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (!/^https?:\/\//.test(str) && !str.includes("/")) return str.trim();
  return null;
}

export function driveAudioPreview(url: string): string {
  const id = extractDriveId(url) || url;
  return `https://drive.google.com/file/d/${id}/preview`;
}

export function PlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>({
    queue: [],
    currentIdx: null,
    playing: false,
  });

  const play = useCallback((item: PlayItem, queue?: PlayItem[]) => {
    const newQueue = queue ?? [item];
    const idx = queue ? queue.findIndex((q) => q.id === item.id) : 0;
    setState({ queue: newQueue, currentIdx: idx >= 0 ? idx : 0, playing: true });
  }, []);

  const pause = useCallback(() => setState((s) => ({ ...s, playing: false })), []);
  const resume = useCallback(() => setState((s) => ({ ...s, playing: true })), []);
  const close = useCallback(() => setState({ queue: [], currentIdx: null, playing: false }), []);

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

  const currentItem = state.currentIdx !== null ? state.queue[state.currentIdx] : null;
  const iframeSrc = currentItem && state.playing ? driveAudioPreview(currentItem.audioSrc) : null;

  return (
    <PlayContext.Provider value={{ state, play, pause, resume, next, prev, close, iframeSrc }}>
      {children}
    </PlayContext.Provider>
  );
}

export function usePlay() {
  const ctx = useContext(PlayContext);
  if (!ctx) throw new Error("usePlay must be used inside PlayProvider");
  return ctx;
}
