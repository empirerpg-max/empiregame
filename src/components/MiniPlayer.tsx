/**
 * MiniPlayer — player de áudio/vídeo flutuante.
 *
 * ══════════════════════════════════════════════════════════════════
 * LÓGICA UNIVERSAL DE RENDERIZAÇÃO DE VÍDEO (Music Videos)
 * ══════════════════════════════════════════════════════════════════
 *
 * A prop `videoSrc` (passada internamente via `currentItem.audioSrc`)
 * é avaliada pela função `resolveVideoMode` antes de renderizar:
 *
 *  ┌─ URL contém 'youtube.com' | 'youtu.be' | ID YT (11 chars)
 *  │   → <iframe> com embed do YouTube
 *  │
 *  ├─ URL contém 'drive.google.com'
 *  │   → <iframe> com Google Drive preview
 *  │
 *  ├─ isTelegramFileId(src)   ← ID nativo (BAACAg…)
 *  │   → exibe loading → fetch Apps Script → <video autoPlay>
 *  │
 *  ├─ URL contém 'api.telegram.org/file'
 *  │   → <video controls autoPlay> nativo HTML5
 *  │
 *  └─ URL termina com .mp4 (qualquer host)
 *      → <video controls autoPlay> nativo HTML5
 *
 * Para categorias que NÃO são 'musicvideo'/'video', o player de áudio
 * original (Drive/Telegram via proxy + YT invisible player) continua
 * funcionando exatamente como antes.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import {
  usePlay,
  driveStreamUrl,
  telegramStreamUrl,
  detectMediaType,
  extractYouTubeId,
  extractDriveId,
  isTelegramFileId,
} from "@/lib/playContext";
import { ChevronLeft, ChevronRight, X, Music, Minimize2, Maximize2, Loader2 } from "lucide-react";
import { driveImg } from "@/lib/api";

// ─── Apps Script URL (mesma usada em play.index.tsx) ──────────────────────
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby1S1mIBXdj4hLqc9RYv1ZJjL7d5ct6to18FNPmpJn1KOnZrYCKJKPNe2LP0dPW-G8HOg/exec";

// ─────────────────────────────────────────────────────────────────────────────
// YT API type shim
// ─────────────────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YT.Player;
      PlayerState: { UNSTARTED: -1; ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

type VideoMode =
  | { kind: "youtube-iframe"; embedUrl: string }
  | { kind: "drive-iframe"; embedUrl: string }
  | { kind: "native-video"; src: string }
  | { kind: "telegram-fetch"; fileId: string }   // ← NOVO: file_id nativo aguardando fetch
  | { kind: "audio" };

// ─────────────────────────────────────────────────────────────────────────────
// resolveVideoMode — lógica universal de detecção de fonte de vídeo
// ─────────────────────────────────────────────────────────────────────────────
function resolveVideoMode(src: string, isVideoCategory: boolean): VideoMode {
  if (!isVideoCategory) return { kind: "audio" };

  const s = src.trim();

  // ── YouTube ──────────────────────────────────────────────────────────────
  if (
    s.includes("youtube.com") ||
    s.includes("youtu.be") ||
    /^[a-zA-Z0-9_-]{11}$/.test(s)
  ) {
    const id = extractYouTubeId(s) ?? s;
    return {
      kind: "youtube-iframe",
      embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&controls=1&rel=0&modestbranding=1&playsinline=1`,
    };
  }

  // ── Google Drive ─────────────────────────────────────────────────────────
  if (s.includes("drive.google.com")) {
    const id = extractDriveId(s) ?? s;
    return {
      kind: "drive-iframe",
      embedUrl: `https://drive.google.com/file/d/${id}/preview`,
    };
  }

  // ── Telegram file_id nativo (BAACAg…) → precisa de fetch ao Apps Script ─
  if (isTelegramFileId(s)) {
    return { kind: "telegram-fetch", fileId: s };
  }

  // ── Telegram file API (URL direta gerada pelo backend) ───────────────────
  if (s.includes("api.telegram.org/file")) {
    return { kind: "native-video", src: s };
  }

  // ── Arquivo .mp4 nativo (qualquer host) ──────────────────────────────────
  if (/\.mp4(\?.*)?$/i.test(s)) {
    return { kind: "native-video", src: s };
  }

  // ── Fallback: tratar como áudio / proxy existente ────────────────────────
  return { kind: "audio" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: carrega a YT IFrame API uma única vez
// ─────────────────────────────────────────────────────────────────────────────
function useLoadYTApi(onReady: () => void) {
  const cbRef = useRef(onReady);
  cbRef.current = onReady;

  useEffect(() => {
    if (window.YT?.Player) {
      cbRef.current();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      cbRef.current();
    };
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve src do <audio> (Drive ou Telegram via proxy)
// ─────────────────────────────────────────────────────────────────────────────
function resolveAudioSrc(
  mediaType: "drive" | "telegram" | "youtube" | null,
  mediaId: string | null
): string {
  if (!mediaId) return "";
  if (mediaType === "telegram") return telegramStreamUrl(mediaId);
  return driveStreamUrl(mediaId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: dado um telegram_file_id, faz fetch ao Apps Script e retorna a URL mp4
// ─────────────────────────────────────────────────────────────────────────────
function useTelegramVideoUrl(fileId: string | null): {
  url: string | null;
  loading: boolean;
  error: string | null;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    setUrl(null);
    setError(null);
    setLoading(true);

    fetch(`${APPS_SCRIPT_URL}?action=getVideoUrl&file_id=${encodeURIComponent(fileId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: { url?: string; error?: string }) => {
        if (cancelled) return;
        if (j.url) {
          setUrl(j.url);
        } else {
          setError(j.error ?? "URL não retornada pelo servidor.");
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [fileId]);

  return { url, loading, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoPanel — renderiza iframe, <video> ou loading conforme o modo
// ─────────────────────────────────────────────────────────────────────────────
interface VideoPanelProps {
  mode: VideoMode;
  expanded: boolean;
}

function VideoPanel({ mode, expanded }: VideoPanelProps) {
  const [videoError, setVideoError] = useState(false);

  // Reseta o estado de erro sempre que a source mudar
  useEffect(() => {
    setVideoError(false);
  }, [mode]);

  if (mode.kind === "audio") return null;

  const containerClass = expanded
    ? "w-full aspect-video rounded-t-xl overflow-hidden bg-black"
    : "hidden";

  // ── Telegram file_id nativo — precisa de fetch ao Apps Script ─────────────
  if (mode.kind === "telegram-fetch") {
    return <TelegramFetchPanel fileId={mode.fileId} expanded={expanded} />;
  }

  // ── <video> nativo — Telegram (api.telegram.org/file) ou .mp4 ────────────
  if (mode.kind === "native-video") {
    if (videoError) {
      return (
        <div className={containerClass + " flex items-center justify-center"}>
          <p className="text-xs text-muted-foreground px-4 text-center">
            Não foi possível carregar o vídeo. O arquivo pode estar indisponível.
          </p>
        </div>
      );
    }

    return (
      <div className={containerClass}>
        <video
          key={mode.src}
          controls
          autoPlay
          playsInline
          style={{ width: "100%", height: "100%" }}
          onError={() => {
            console.error("[MiniPlayer] Erro ao carregar vídeo nativo:", mode.src);
            setVideoError(true);
            toast.error("Erro ao carregar o vídeo. Verifique se o arquivo está acessível.");
          }}
          aria-label="Reprodução de vídeo"
        >
          <source src={mode.src} type="video/mp4" />
          Seu navegador não suporta a reprodução de vídeo HTML5.
        </video>
      </div>
    );
  }

  // ── <iframe> — YouTube ou Google Drive ───────────────────────────────────
  return (
    <div className={containerClass}>
      <iframe
        key={mode.embedUrl}
        src={mode.embedUrl}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="w-full h-full border-0"
        title="Reprodução de vídeo"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TelegramFetchPanel — loading → fetch → <video>
// ─────────────────────────────────────────────────────────────────────────────
function TelegramFetchPanel({ fileId, expanded }: { fileId: string; expanded: boolean }) {
  const { url, loading, error } = useTelegramVideoUrl(fileId);
  const [videoError, setVideoError] = useState(false);

  const containerClass = expanded
    ? "w-full aspect-video rounded-t-xl overflow-hidden bg-black flex items-center justify-center"
    : "hidden";

  if (loading) {
    return (
      <div className={containerClass}>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="size-6 text-primary animate-spin" />
          <p className="text-[10px] text-muted-foreground">Carregando vídeo…</p>
        </div>
      </div>
    );
  }

  if (error || (!loading && !url)) {
    return (
      <div className={containerClass}>
        <p className="text-xs text-muted-foreground px-4 text-center">
          {error ?? "Não foi possível obter a URL do vídeo."}
        </p>
      </div>
    );
  }

  if (videoError) {
    return (
      <div className={containerClass}>
        <p className="text-xs text-muted-foreground px-4 text-center">
          Não foi possível reproduzir o vídeo.
        </p>
      </div>
    );
  }

  return (
    <div className={expanded ? "w-full aspect-video rounded-t-xl overflow-hidden bg-black" : "hidden"}>
      <video
        key={url!}
        controls
        autoPlay
        playsInline
        style={{ width: "100%", height: "100%" }}
        onError={() => {
          console.error("[MiniPlayer] Erro ao reproduzir vídeo Telegram:", url);
          setVideoError(true);
          toast.error("Erro ao reproduzir o vídeo do Telegram.");
        }}
        aria-label="Reprodução de vídeo Telegram"
      >
        <source src={url!} type="video/mp4" />
        Seu navegador não suporta vídeo HTML5.
      </video>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MiniPlayer
// ─────────────────────────────────────────────────────────────────────────────
export function MiniPlayer() {
  const {
    state,
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
  } = usePlay();

  const { queue, currentIdx, playing } = state;

  // ── Video panel state ────────────────────────────────────────────────────
  const [videoExpanded, setVideoExpanded] = useState(false);

  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytApiReady = useRef(false);
  const ytActiveId = useRef<string | null>(null);
  const pendingPlay = useRef(false);

  // Deriva o item atual e o modo de vídeo ──────────────────────────────────
  const item = currentIdx !== null ? queue[currentIdx] : null;
  const isVideoCategory = item?.categoria === "musicvideo" || item?.categoria === "video";
  const videoMode: VideoMode = item
    ? resolveVideoMode(item.audioSrc, isVideoCategory)
    : { kind: "audio" };

  // Vídeo em iframe/native → expande automaticamente na primeira abertura
  useEffect(() => {
    if (videoMode.kind !== "audio") {
      setVideoExpanded(true);
    } else {
      setVideoExpanded(false);
    }
  }, [videoMode.kind, currentIdx]);

  // ── 1. Cria o <audio> nativo (uma única vez) ─────────────────────────────
  useEffect(() => {
    if (audioRef.current) return;
    const audio = new Audio();
    audio.preload = "none";
    audio.crossOrigin = "anonymous";

    audio.addEventListener("play", confirmPlaying);
    audio.addEventListener("pause", confirmPaused);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", (e) => {
      const mediaErr = (e.target as HTMLAudioElement).error;
      console.error(
        "[MiniPlayer] Erro ao carregar áudio:",
        mediaErr?.code,
        mediaErr?.message,
        "| src:",
        (e.target as HTMLAudioElement).src
      );
      confirmPaused();
      toast.error(
        "Não foi possível carregar a mídia. Verifique se o arquivo está público ou tente novamente mais tarde."
      );
    });

    audioRef.current = audio;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Cria / recria o YT.Player invisível (apenas para áudio YT) ────────
  const buildYTPlayer = useCallback(
    (videoId: string, autoStart: boolean) => {
      if (!ytContainerRef.current) return;

      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch { /* */ }
        ytPlayerRef.current = null;
      }
      ytActiveId.current = videoId;

      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId,
        width: "1",
        height: "1",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady(e: YT.PlayerEvent) {
            if (autoStart || pendingPlay.current) {
              pendingPlay.current = false;
              e.target.playVideo();
            }
          },
          onStateChange(e: YT.OnStateChangeEvent) {
            const S = window.YT.PlayerState;
            if (e.data === S.PLAYING) confirmPlaying();
            if (e.data === S.PAUSED) confirmPaused();
            if (e.data === S.ENDED) onEnded();
          },
          onError() {
            confirmPaused();
            toast.error("Erro ao carregar vídeo do YouTube.");
          },
        },
      });
    },
    [ytPlayerRef, confirmPlaying, confirmPaused, onEnded]
  );

  const onYTApiReady = useCallback(() => {
    ytApiReady.current = true;
    if (
      videoMode.kind === "audio" &&
      mediaType === "youtube" &&
      currentMediaId &&
      ytActiveId.current !== currentMediaId
    ) {
      buildYTPlayer(currentMediaId, pendingPlay.current);
    }
  }, [videoMode.kind, mediaType, currentMediaId, buildYTPlayer]);

  useLoadYTApi(onYTApiReady);

  // ── 3. Troca de faixa — configura src / player ───────────────────────────
  useEffect(() => {
    if (!currentMediaId) return;

    if (videoMode.kind !== "audio") {
      audioRef.current?.pause();
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.stopVideo(); } catch { /* */ }
      }
      return;
    }

    if (mediaType === "drive" || mediaType === "telegram") {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.src = resolveAudioSrc(mediaType, currentMediaId);
      audio.load();
    }

    if (mediaType === "youtube") {
      if (!ytApiReady.current) return;
      if (ytActiveId.current !== currentMediaId) {
        buildYTPlayer(currentMediaId, false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMediaId, mediaType, videoMode.kind]);

  // ── 4. Auto-play quando playing é true (apenas modo áudio) ───────────────
  useEffect(() => {
    if (!currentMediaId || !playing) return;
    if (videoMode.kind !== "audio") return;

    const id = setTimeout(() => {
      if (mediaType === "drive" || mediaType === "telegram") {
        const audio = audioRef.current;
        if (!audio) return;
        audio.play().catch(() => {
          confirmPaused();
          toast.error(
            "Falha ao reproduzir. O arquivo pode estar privado ou o navegador bloqueou o autoplay."
          );
        });
      }

      if (mediaType === "youtube") {
        if (ytPlayerRef.current) {
          try { ytPlayerRef.current.playVideo(); } catch { pendingPlay.current = true; }
        } else {
          pendingPlay.current = true;
          if (ytApiReady.current && currentMediaId) {
            buildYTPlayer(currentMediaId, true);
          }
        }
      }
    }, 50);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMediaId, playing, videoMode.kind]);

  // ── 5. Limpa ao desmontar ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 6. triggerPlay ───────────────────────────────────────────────────────
  const triggerPlay = useCallback(() => {
    if (videoMode.kind !== "audio") return;

    if (mediaType === "drive" || mediaType === "telegram") {
      const audio = audioRef.current;
      if (!audio) return;
      audio.play().catch(() => {
        confirmPaused();
        toast.error(
          "Falha ao reproduzir. O arquivo pode estar privado ou o navegador bloqueou o autoplay."
        );
      });
      return;
    }

    if (mediaType === "youtube") {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.playVideo(); } catch { pendingPlay.current = true; }
      } else {
        pendingPlay.current = true;
        if (ytApiReady.current && currentMediaId) {
          buildYTPlayer(currentMediaId, true);
        }
      }
    }
  }, [videoMode.kind, mediaType, audioRef, ytPlayerRef, currentMediaId, buildYTPlayer, confirmPaused]);

  // ── 7. triggerPause ──────────────────────────────────────────────────────
  const triggerPause = useCallback(() => {
    pendingPlay.current = false;
    pause();
  }, [pause]);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (currentIdx === null || queue.length === 0) return null;
  if (!item) return null;

  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < queue.length - 1;
  const isVideoMode = videoMode.kind !== "audio";

  const handlePlayPause = () => {
    if (isVideoMode) return;
    if (playing) {
      triggerPause();
    } else {
      resume();
      triggerPlay();
    }
  };

  return (
    <div
      className={[
        "fixed inset-x-0 z-40 bg-card border-t border-white/10 shadow-2xl transition-all duration-300",
        isVideoMode && videoExpanded ? "bottom-0" : "bottom-16",
      ].join(" ")}
    >
      {/* ── Painel de vídeo (iframe, <video> nativo ou Telegram fetch) ── */}
      <VideoPanel mode={videoMode} expanded={videoExpanded} />

      {/* Container do YouTube INVISÍVEL */}
      {videoMode.kind === "audio" && mediaType === "youtube" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
            overflow: "hidden",
          }}
          aria-hidden="true"
        >
          <div ref={ytContainerRef} />
        </div>
      )}

      {/* ── Barra de controles ── */}
      <div className="mx-auto max-w-2xl px-4 py-2 flex items-center gap-3">
        {/* Capa */}
        <div className="size-10 rounded-lg overflow-hidden bg-primary/10 flex-shrink-0">
          {item.capa ? (
            <img
              src={driveImg(item.capa, 80)}
              alt={item.titulo}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full grid place-items-center">
              <Music className="size-4 text-primary" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black truncate uppercase tracking-tight">
            {item.titulo}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {item.artista}
            {isVideoMode && (
              <span className="ml-1 text-primary opacity-70">
                ·{" "}
                {videoMode.kind === "telegram-fetch"
                  ? "Telegram"
                  : videoMode.kind === "native-video"
                  ? "MP4"
                  : videoMode.kind === "youtube-iframe"
                  ? "YouTube"
                  : "Drive"}
              </span>
            )}
          </p>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isVideoMode && (
            <button
              onClick={() => setVideoExpanded((v) => !v)}
              className="size-8 grid place-items-center text-muted-foreground hover:text-foreground transition-opacity"
              aria-label={videoExpanded ? "Recolher vídeo" : "Expandir vídeo"}
            >
              {videoExpanded ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </button>
          )}

          <button
            onClick={() => { prev(); }}
            disabled={!hasPrev}
            className="size-8 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity"
            aria-label="Anterior"
          >
            <ChevronLeft className="size-4" />
          </button>

          {!isVideoMode && (
            <button
              onClick={handlePlayPause}
              className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center hover:scale-105 transition-transform"
              aria-label={playing ? "Pausar" : "Reproduzir"}
            >
              {playing ? (
                <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>
          )}

          <button
            onClick={() => { next(); }}
            disabled={!hasNext}
            className="size-8 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity"
            aria-label="Próxima"
          >
            <ChevronRight className="size-4" />
          </button>

          <button
            onClick={close}
            className="size-8 grid place-items-center text-muted-foreground hover:text-foreground ml-1"
            aria-label="Fechar player"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
