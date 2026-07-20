import { useEffect, useRef, useCallback } from "react";
import { usePlay, driveStreamUrl, extractYouTubeId } from "@/lib/playContext";
import { ChevronLeft, ChevronRight, X, Music } from "lucide-react";
import { driveImg } from "@/lib/api";

// ─── YouTube Iframe API type shim ─────────────────────────────────────────────
// Se o projeto já tiver @types/youtube instalado, remova esta declaração.
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

// ─── Hook: carrega o script da YouTube IFrame API uma única vez ───────────────
function useYouTubeAPI(onReady: () => void) {
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      onReady();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      onReady();
    };
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    // cleanup: não remove o script pois outros componentes podem usá-lo
  }, [onReady]);
}

// ─── Componente principal ─────────────────────────────────────────────────────
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
    onEnded,
    syncPlaying,
  } = usePlay();

  const { queue, currentIdx, playing } = state;

  // Ref para o container invisível onde o player do YT vai ser injetado
  const ytContainerRef = useRef<HTMLDivElement>(null);
  // Controla se a API do YT já está pronta
  const ytApiReady = useRef(false);

  // ── Garante que o <audio> nativo existe (criado uma única vez) ─────────────
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audio.onended = onEnded;
      audioRef.current = audio;
    }
    return () => {
      // Não destrói o elemento ao desmontar; ele vive enquanto o Provider viver.
    };
  }, [audioRef, onEnded]);

  // ── Callback: cria/recria o YT.Player quando API estiver pronta ───────────
  const createYTPlayer = useCallback(() => {
    ytApiReady.current = true;
    if (mediaType !== "youtube" || !currentMediaId || !ytContainerRef.current) return;

    // Destrói instância anterior se existir
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch { /* */ }
      ytPlayerRef.current = null;
    }

    ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
      videoId: currentMediaId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady(e: YT.PlayerEvent) {
          if (playing) e.target.playVideo();
        },
        onStateChange(e: YT.OnStateChangeEvent) {
          if (e.data === window.YT.PlayerState.ENDED) onEnded();
          if (e.data === window.YT.PlayerState.PLAYING) syncPlaying(true);
          if (e.data === window.YT.PlayerState.PAUSED) syncPlaying(false);
        },
      },
    });
  }, [mediaType, currentMediaId, playing, ytPlayerRef, onEnded, syncPlaying]);

  // Carrega a API do YT (no-op se já estiver carregada)
  useYouTubeAPI(createYTPlayer);

  // ── Recria o player YT quando a faixa muda ───────────────────────────────
  useEffect(() => {
    if (mediaType !== "youtube" || !ytApiReady.current) return;
    createYTPlayer();
  }, [currentMediaId, mediaType, createYTPlayer]);

  // ── Limpa audio ao desmontar (segurança extra) ───────────────────────────
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, [audioRef]);

  if (currentIdx === null || queue.length === 0) return null;

  const item = queue[currentIdx];
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < queue.length - 1;

  return (
    <div className="fixed bottom-16 inset-x-0 z-40 bg-card border-t border-white/10 shadow-2xl">
      {/*
       * ── Player invisível do YouTube ─────────────────────────────────────
       * O container precisa existir no DOM para a YT API injetar o <iframe>.
       * Usamos pointer-events:none + overflow:hidden para escondê-lo por
       * completo sem nunca fazer display:none (a API para de funcionar).
       */}
      {mediaType === "youtube" && (
        <div
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            opacity: 0,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        >
          {/* O YT.Player será injetado aqui via ref */}
          <div ref={ytContainerRef} />
        </div>
      )}

      {/*
       * ── Áudio nativo para Google Drive ──────────────────────────────────
       * O elemento <audio> real fica em memória (criado via new Audio() no
       * useEffect acima). Nenhum elemento de áudio visível é necessário aqui.
       */}

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

          <button
            onClick={playing ? pause : resume}
            className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center hover:scale-105 transition-transform"
            aria-label={playing ? "Pausar" : "Continuar"}
          >
            {playing ? (
              /* Ícone de Pause */
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              /* Ícone de Play */
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
