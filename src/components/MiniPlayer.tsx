/**
 * MiniPlayer — player de áudio/vídeo de background.
 *
 * ┌─ Google Drive ────────────────────────────────────────────────────────────┐
 * │ • URL roteada pelo proxy Cloudflare (evita CORS/CORB do Drive direto).    │
 * │ • Elemento <audio> nativo com crossOrigin="anonymous".                    │
 * │ • .play() disparado DENTRO do onClick (user-gesture).                    │
 * │ • Estado visual muda para "tocando" APENAS após a Promise resolver.       │
 * │ • Erro (rede/bloqueio) → reverte para pause + toast.                     │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ YouTube ─────────────────────────────────────────────────────────────────┐
 * │ • Usa a YouTube IFrame API nativa (sem react-youtube).                    │
 * │ • <div> container com position:absolute, opacity:0, pointerEvents:none,  │
 * │   width:1px, height:1px, zIndex:-1 — invisível mas presente no DOM.      │
 * │   NUNCA usar display:none — a API para de funcionar.                      │
 * │ • .playVideo() chamado no onClick (user-gesture) ou no onReady.           │
 * │ • Estado visual muda para "tocando" APENAS no evento onStateChange(1).   │
 * │ • Erro → reverte para pause + toast.                                     │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import {
  usePlay,
  driveProxyUrl,
  detectMediaType,
  extractYouTubeId,
  extractDriveId,
} from "@/lib/playContext";
import { ChevronLeft, ChevronRight, X, Music } from "lucide-react";
import { driveImg } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Declaração do namespace global da YouTube IFrame API
// ─────────────────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        config: {
          videoId?: string;
          width?: number | string;
          height?: number | string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { target: YTPlayer; data: number }) => void;
            onError?: (e: { target: YTPlayer; data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
  interface YTPlayer {
    playVideo: () => void;
    pauseVideo: () => void;
    stopVideo: () => void;
    loadVideoById: (videoId: string) => void;
    cueVideoById: (videoId: string) => void;
    destroy: () => void;
    getPlayerState: () => number;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: carrega o script da YouTube IFrame API uma única vez por página
// ─────────────────────────────────────────────────────────────────────────────
let ytApiPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<void>((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
  return ytApiPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// MiniPlayer
// ─────────────────────────────────────────────────────────────────────────────
export function MiniPlayer() {
  const {
    state,
    pause,
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

  // Ref para o <div> onde o YT.Player injeta o <iframe>
  const ytContainerRef = useRef<HTMLDivElement>(null);
  // Flag: o usuário pediu play antes do player YT estar pronto
  const pendingYTPlay = useRef(false);
  // Guarda o videoId que está montado no player YT para evitar re-criações desnecessárias
  const [ytReady, setYtReady] = useState(false);

  // ── 1. Cria o <audio> nativo uma única vez ──────────────────────────────
  useEffect(() => {
    if (audioRef.current) return;

    const audio = new Audio();
    audio.preload = "none";
    audio.crossOrigin = "anonymous";

    audio.addEventListener("play", confirmPlaying);
    audio.addEventListener("pause", confirmPaused);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", () => {
      confirmPaused();
      toast.error(
        "Falha ao reproduzir. Verifique as permissões do arquivo no Google Drive."
      );
    });

    audioRef.current = audio;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Instancia o YT.Player quando o container estiver no DOM ──────────
  useEffect(() => {
    if (mediaType !== "youtube" || !currentMediaId) return;
    if (!ytContainerRef.current) return;

    const videoId =
      extractYouTubeId(currentMediaId) ?? currentMediaId;
    if (!videoId) return;

    // Destrói player anterior se existir
    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current.destroy();
      } catch {
        /* ignora */
      }
      ytPlayerRef.current = null;
      setYtReady(false);
    }

    pendingYTPlay.current = false;

    loadYouTubeAPI().then(() => {
      if (!ytContainerRef.current) return;

      const player = new window.YT.Player(ytContainerRef.current, {
        videoId,
        width: 1,
        height: 1,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (e) => {
            ytPlayerRef.current = e.target;
            setYtReady(true);
            if (pendingYTPlay.current) {
              pendingYTPlay.current = false;
              try {
                e.target.playVideo();
              } catch {
                confirmPaused();
                toast.error("Não foi possível iniciar o vídeo do YouTube.");
              }
            }
          },
          onStateChange: (e) => {
            const s = window.YT.PlayerState;
            if (e.data === s.PLAYING) confirmPlaying();
            else if (e.data === s.PAUSED) confirmPaused();
            else if (e.data === s.ENDED) onEnded();
          },
          onError: () => {
            confirmPaused();
            toast.error("Erro ao carregar o vídeo do YouTube.");
          },
        },
      });

      ytPlayerRef.current = player as unknown as YTPlayer;
    });

    return () => {
      // não destrói aqui pois o <div> pode ser reutilizado — destrói na próxima troca
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMediaId, mediaType]);

  // ── 3. Reage à troca de faixa (Drive) ──────────────────────────────────
  useEffect(() => {
    if (!currentMediaId || mediaType !== "drive") return;

    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = driveProxyUrl(currentMediaId);
    audio.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMediaId, mediaType]);

  // ── 4. Limpa ao desmontar ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      try {
        ytPlayerRef.current?.destroy();
      } catch {
        /* ignora */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 5. triggerPlay — disparado DENTRO do onClick (user-gesture) ─────────
  const triggerPlay = useCallback(() => {
    if (mediaType === "drive") {
      const audio = audioRef.current;
      if (!audio) return;
      audio
        .play()
        .catch((err: unknown) => {
          confirmPaused();
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(
            `Falha ao reproduzir: ${msg}. O arquivo pode estar privado ou o autoplay foi bloqueado.`
          );
        });
      return;
    }

    if (mediaType === "youtube") {
      const player = ytPlayerRef.current;
      if (!player) {
        pendingYTPlay.current = true;
        return;
      }
      try {
        player.playVideo();
      } catch (err: unknown) {
        pendingYTPlay.current = true;
        toast.error(`Não foi possível iniciar o vídeo: ${String(err)}`);
      }
    }
  }, [mediaType, audioRef, ytPlayerRef, confirmPaused]);

  // ── 6. triggerPause ────────────────────────────────────────────────────
  const triggerPause = useCallback(() => {
    pendingYTPlay.current = false;
    pause();
  }, [pause]);

  // ── Guard ───────────────────────────────────────────────────────────────
  if (currentIdx === null || queue.length === 0) return null;

  const item = queue[currentIdx];
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < queue.length - 1;

  return (
    <div className="fixed bottom-16 inset-x-0 z-40 bg-card border-t border-white/10 shadow-2xl">
      {/*
       * Container do YT.Player.
       *
       * REGRA CRÍTICA: NUNCA usar display:none nem 0x0 no container.
       * A API do YouTube suspende a reprodução em elementos não visíveis.
       * Usamos position:absolute + opacity:0 + zIndex:-1 para
       * manter o iframe no layout sem exibi-lo ao usuário.
       */}
      {mediaType === "youtube" && currentMediaId && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1px",
            height: "1px",
            opacity: 0,
            pointerEvents: "none",
            overflow: "hidden",
            zIndex: -1,
          }}
          aria-hidden="true"
        >
          <div ref={ytContainerRef} />
        </div>
      )}

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
          </p>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={prev}
            disabled={!hasPrev}
            className="size-8 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity"
            aria-label="Anterior"
          >
            <ChevronLeft className="size-4" />
          </button>

          {/*
           * Botão Play/Pause — ÚNICO ponto onde .play()/.playVideo() é chamado.
           * Manter dentro do onClick preserva o user-gesture exigido
           * pelas políticas de Autoplay dos navegadores modernos.
           */}
          <button
            onClick={playing ? triggerPause : triggerPlay}
            className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center hover:scale-105 transition-transform"
            aria-label={playing ? "Pausar" : "Reproduzir"}
          >
            {playing ? (
              <svg
                className="size-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg
                className="size-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          <button
            onClick={next}
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
