/**
 * MiniPlayer — player de áudio/vídeo background.
 *
 * Estratégia de reprodução:
 * ─ Google Drive → <audio> nativo com crossOrigin="anonymous".
 *   O .play() é disparado DENTRO do onClick (user-gesture).
 *   O estado visual só muda para "tocando" após a promise resolver.
 *   Em caso de erro (CORS/CORB), reverte para pause + toast.
 *
 * ─ YouTube → YT.Player injetado em um <div> de 1×1 px invisível
 *   (opacity:0, position:absolute, zIndex:-1, pointerEvents:none).
 *   NÃO usa display:none nem width/height 0 — a API para de funcionar.
 *   O .playVideo() é chamado DENTRO do onClick ou no onReady se
 *   a faixa já estava marcada para tocar.
 *   Estado visual sincronizado via onStateChange (PLAYING/PAUSED).
 */

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  usePlay,
  driveStreamUrl,
  detectMediaType,
  extractYouTubeId,
  extractDriveId,
} from "@/lib/playContext";
import { ChevronLeft, ChevronRight, X, Music } from "lucide-react";
import { driveImg } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// YT API type shim — remova se @types/youtube estiver instalado
// ─────────────────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: garante que a YT IFrame API é carregada uma única vez
// ─────────────────────────────────────────────────────────────────────────────
function useLoadYTApi(onReady: () => void) {
  const cbRef = useRef(onReady);
  cbRef.current = onReady; // sempre atualizado sem re-executar o effect

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
  }, []); // roda só na montagem
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

  // Ref para o <div> onde a YT API injeta o <iframe>
  const ytContainerRef = useRef<HTMLDivElement>(null);
  // Flag: API do YT já carregada
  const ytApiReady = useRef(false);
  // Guarda o videoId do player YT ativo para evitar recriação desnecessária
  const ytActiveId = useRef<string | null>(null);
  // Flag: a faixa atual está aguardando play (para disparar no onReady do YT)
  const pendingPlay = useRef(false);

  // ── 1. Cria o elemento <audio> nativo (uma única vez) ───────────────────
  useEffect(() => {
    if (audioRef.current) return;
    const audio = new Audio();
    audio.preload = "none"; // não baixa nada até o usuário clicar
    audio.crossOrigin = "anonymous"; // necessário para contornar CORB

    audio.addEventListener("play", confirmPlaying);
    audio.addEventListener("pause", confirmPaused);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", () => {
      confirmPaused();
      toast.error("Não foi possível reproduzir o arquivo. Verifique as permissões do Google Drive.");
    });

    audioRef.current = audio;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Cria / recria o YT.Player ────────────────────────────────────────
  const buildYTPlayer = useCallback(
    (videoId: string, autoStart: boolean) => {
      if (!ytContainerRef.current) return;

      // Destrói instância anterior
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
          autoplay: 1,   // sinaliza intenção; .playVideo() garante dentro do click
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady(e: YT.PlayerEvent) {
            // Só chama playVideo se o usuário já clicou em Play
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

  // Callback chamado quando a API do YT estiver pronta
  const onYTApiReady = useCallback(() => {
    ytApiReady.current = true;
    // Se já havia uma faixa YT esperando, cria o player agora
    if (
      mediaType === "youtube" &&
      currentMediaId &&
      ytActiveId.current !== currentMediaId
    ) {
      buildYTPlayer(currentMediaId, pendingPlay.current);
    }
  }, [mediaType, currentMediaId, buildYTPlayer]);

  useLoadYTApi(onYTApiReady);

  // ── 3. Reage à troca de faixa ────────────────────────────────────────────
  useEffect(() => {
    if (!currentMediaId) return;

    if (mediaType === "drive") {
      const audio = audioRef.current;
      if (!audio) return;
      // Troca a src e reseta; o play real acontece no onClick
      audio.pause();
      audio.src = driveStreamUrl(currentMediaId);
      audio.load();
    }

    if (mediaType === "youtube") {
      if (!ytApiReady.current) return; // buildYTPlayer será chamado no onYTApiReady
      if (ytActiveId.current !== currentMediaId) {
        buildYTPlayer(currentMediaId, pendingPlay.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMediaId, mediaType]);

  // ── 4. Limpa ao desmontar ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 5. triggerPlay: dispara a reprodução dentro do user-gesture ──────────
  const triggerPlay = useCallback(() => {
    if (mediaType === "drive") {
      const audio = audioRef.current;
      if (!audio) return;
      audio
        .play()
        .then(() => {
          // confirmPlaying é chamado pelo evento 'play' do próprio audio
        })
        .catch(() => {
          confirmPaused();
          toast.error(
            "Falha ao reproduzir. O arquivo pode estar privado ou o navegador bloqueou o autoplay."
          );
        });
      return;
    }

    if (mediaType === "youtube") {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.playVideo();
          // confirmPlaying será chamado pelo onStateChange PLAYING
        } catch {
          // player ainda não pronto — flag para disparar no onReady
          pendingPlay.current = true;
        }
      } else {
        // API ainda carregando — flag para disparar no onReady/buildYTPlayer
        pendingPlay.current = true;
        if (ytApiReady.current && currentMediaId) {
          buildYTPlayer(currentMediaId, true);
        }
      }
    }
  }, [mediaType, audioRef, ytPlayerRef, currentMediaId, buildYTPlayer, confirmPaused]);

  // ── 6. triggerPause: pausa dentro do user-gesture ────────────────────────
  const triggerPause = useCallback(() => {
    pendingPlay.current = false;
    pause(); // pause() no context já chama .pause() e .pauseVideo()
  }, [pause]);

  // ── Guard: nada a renderizar ─────────────────────────────────────────────
  if (currentIdx === null || queue.length === 0) return null;

  const item = queue[currentIdx];
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < queue.length - 1;

  return (
    <div className="fixed bottom-16 inset-x-0 z-40 bg-card border-t border-white/10 shadow-2xl">
      {/*
       * Container do YouTube — NUNCA display:none nem size 0.
       * A API precisa de um elemento visível no DOM (mesmo que 1px).
       * Escondemos via opacity/position/z-index.
       */}
      {mediaType === "youtube" && (
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
            onClick={() => { prev(); /* onEnded / next disparam o play via pendingPlay */ }}
            disabled={!hasPrev}
            className="size-8 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity"
            aria-label="Anterior"
          >
            <ChevronLeft className="size-4" />
          </button>

          {/*
           * Botão Play/Pause — ÚNICO ponto de disparo de reprodução.
           * triggerPlay e triggerPause são chamados diretamente no onClick,
           * mantendo o user-gesture exigido pelas políticas de autoplay.
           */}
          <button
            onClick={playing ? triggerPause : triggerPlay}
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
