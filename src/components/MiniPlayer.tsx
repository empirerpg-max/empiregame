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
 * │ • Usa react-youtube. O <iframe> NUNCA tem display:none nem size 0.        │
 * │ • Container com position:absolute, opacity:0, pointerEvents:none,        │
 * │   width:1px, height:1px, zIndex:-1 — invisível mas presente no DOM.      │
 * │ • playerVars: { autoplay: 1, controls: 0 }.                              │
 * │ • .playVideo() chamado no onClick (user-gesture) ou no onReady.          │
 * │ • Estado visual muda para "tocando" APENAS no evento onPlay.             │
 * │ • Erro → reverte para pause + toast.                                     │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

import { useEffect, useRef, useCallback, useState } from "react";
import YouTube, { type YouTubeEvent, type YouTubePlayer } from "react-youtube";
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

  // Flag: o usuário pediu play antes do player YT estar pronto
  const pendingYTPlay = useRef(false);
  // Mantém o videoId montado no <YouTube> component para forçar remount na troca
  const [ytVideoId, setYtVideoId] = useState<string | null>(null);

  // ── 1. Cria o <audio> nativo uma única vez ──────────────────────────────
  useEffect(() => {
    if (audioRef.current) return;

    const audio = new Audio();
    audio.preload = "none";
    // crossOrigin="anonymous" é obrigatório para o proxy responder sem erro CORB
    audio.crossOrigin = "anonymous";

    // Estado visual confirmado pelos eventos nativos — nunca pelo onClick
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

  // ── 2. Reage à troca de faixa ──────────────────────────────────────────
  useEffect(() => {
    if (!currentMediaId) return;

    if (mediaType === "drive") {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      // Proxy Cloudflare em vez da URL do Drive diretamente
      audio.src = driveProxyUrl(currentMediaId);
      audio.load();
      // NÃO chama .play() aqui — será feito no onClick (user-gesture)
    }

    if (mediaType === "youtube") {
      // Atualiza o videoId que alimenta o componente <YouTube>
      // O react-youtube faz remount automático ao trocar videoId
      const id = extractYouTubeId(currentMediaId) ?? currentMediaId;
      setYtVideoId(id);
      pendingYTPlay.current = false; // reseta flag na troca de faixa
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMediaId, mediaType]);

  // ── 3. Limpa ao desmontar ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 4. Handlers do react-youtube ───────────────────────────────────────

  /** Chamado pelo react-youtube quando o player está pronto para receber comandos */
  const handleYTReady = useCallback(
    (e: YouTubeEvent) => {
      const player: YouTubePlayer = e.target;
      ytPlayerRef.current = player;

      // Se o usuário clicou em Play antes do player terminar de carregar
      if (pendingYTPlay.current) {
        pendingYTPlay.current = false;
        try {
          player.playVideo();
        } catch {
          confirmPaused();
          toast.error("Não foi possível iniciar o vídeo do YouTube.");
        }
      }
    },
    [ytPlayerRef, confirmPaused]
  );

  /**
   * onPlay do react-youtube — único lugar que define playing=true para YT.
   * Equivale ao evento 'play' do <audio>.
   */
  const handleYTPlay = useCallback(
    (_e: YouTubeEvent) => {
      confirmPlaying();
    },
    [confirmPlaying]
  );

  const handleYTPause = useCallback(
    (_e: YouTubeEvent) => {
      confirmPaused();
    },
    [confirmPaused]
  );

  const handleYTEnd = useCallback(
    (_e: YouTubeEvent) => {
      onEnded();
    },
    [onEnded]
  );

  const handleYTError = useCallback(
    (_e: YouTubeEvent) => {
      confirmPaused();
      toast.error("Erro ao carregar o vídeo do YouTube.");
    },
    [confirmPaused]
  );

  // ── 5. triggerPlay — disparado DENTRO do onClick (user-gesture) ─────────
  const triggerPlay = useCallback(() => {
    if (mediaType === "drive") {
      const audio = audioRef.current;
      if (!audio) return;

      try {
        audio
          .play()
          .then(() => {
            // confirmPlaying é chamado pelo evento 'play' do audio — não aqui
          })
          .catch((err: unknown) => {
            confirmPaused();
            const msg =
              err instanceof Error ? err.message : String(err);
            toast.error(
              `Falha ao reproduzir: ${msg}. O arquivo pode estar privado ou o autoplay foi bloqueado.`
            );
          });
      } catch (err: unknown) {
        confirmPaused();
        toast.error(`Erro inesperado: ${String(err)}`);
      }
      return;
    }

    if (mediaType === "youtube") {
      const player = ytPlayerRef.current;
      if (!player) {
        // Player ainda não carregou — flag para disparar no onReady
        pendingYTPlay.current = true;
        return;
      }
      try {
        player.playVideo();
        // confirmPlaying será chamado pelo evento onPlay do react-youtube
      } catch (err: unknown) {
        pendingYTPlay.current = true; // tenta novamente no onReady
        toast.error(`Não foi possível iniciar o vídeo: ${String(err)}`);
      }
    }
  }, [mediaType, audioRef, ytPlayerRef, confirmPaused]);

  // ── 6. triggerPause — disparado DENTRO do onClick ──────────────────────
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
       * Container do react-youtube.
       *
       * REGRA CRÍTICA: o <iframe> NUNCA pode ter display:none nem 0x0.
       * A API do YouTube suspende a reprodução em elementos não visíveis.
       * Usamos position:absolute + opacity:0 + zIndex:-1 para
       * manter o iframe no layout sem exibi-lo ao usuário.
       */}
      {mediaType === "youtube" && ytVideoId && (
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
          <YouTube
            videoId={ytVideoId}
            opts={{
              width: "1",
              height: "1",
              playerVars: {
                autoplay: 1,    // sinaliza intenção — .playVideo() no onClick garante
                controls: 0,
                disablekb: 1,
                rel: 0,
                modestbranding: 1,
                playsinline: 1,
              },
            }}
            onReady={handleYTReady}
            onPlay={handleYTPlay}
            onPause={handleYTPause}
            onEnd={handleYTEnd}
            onError={handleYTError}
          />
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
