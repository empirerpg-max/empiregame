import { useState } from "react";
import { X, Tv, Sparkles, AlertCircle } from "lucide-react";
import { driveImg } from "@/lib/api";
import { TelegramWidget } from "./TelegramWidget";

export interface PlayableVideo {
  id?: string;
  titulo: string;
  artista: string;
  tipo_video?: string;
  descricao?: string;
  capa_url?: string;
  poster_url?: string;
  youtube_url?: string;
  link?: string;
  fonte?: "youtube" | "drive" | "telegram" | string;
  metodo_exibicao?: "telegram_widget" | "iframe_drive" | "iframe_youtube" | string;
  url_final_player?: string;
}

interface VideoPlayerProps {
  video: PlayableVideo | null;
  onClose: () => void;
}

export function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  const [streamError, setStreamError] = useState(false);

  if (!video) return null;

  const rawLink =
    video.url_final_player || video.link || (video as any).videoUrl || video.youtube_url || "";

  // 1. Telegram — link público (t.me/canal/id) usa o widget oficial; qualquer outro
  // valor vindo de fonte "telegram" (ex: file_id do bot) precisa passar pelo proxy
  // /api/stream/:id (backend -> telegram-bot-api local na VPS). A API oficial
  // (api.telegram.org / empire-media-api) recusa arquivos acima de ~20MB, então
  // não serve para os vídeos grandes do catálogo — só o bot-api local remove
  // esse limite.
  const isPublicTelegramLink = /^(https?:\/\/)?t\.me\//i.test(rawLink.trim());
  const isTelegramSource =
    video.metodo_exibicao === "telegram_widget" ||
    video.fonte === "telegram" ||
    isPublicTelegramLink;
  const isTelegramWidget = isTelegramSource && isPublicTelegramLink;
  const isTelegramStream = isTelegramSource && !isPublicTelegramLink && !!rawLink;
  const isTelegram = isTelegramWidget || isTelegramStream;
  // O card já vem da listagem com o campo resolvido (telegram_file_id /
  // ref_telegram_id) e a fonte normalizada, então o backend não precisa mais
  // consultar a planilha antes de começar o streaming.
  const streamUrl = isTelegramStream
    ? `/api/stream/${encodeURIComponent(rawLink.trim())}?fonte=telegram`
    : rawLink;

  // 2. YouTube
  const isYouTubeUrl = (url?: string) => {
    if (!url) return false;
    return /youtube\.com|youtu\.be/i.test(url);
  };

  const getYouTubeEmbedUrl = (url: string) => {
    let videoId = "";
    if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1]?.split("?")[0] || "";
    } else if (url.includes("v=")) {
      videoId = url.split("v=")[1]?.split("&")[0] || "";
    } else if (url.includes("embed/")) {
      videoId = url.split("embed/")[1]?.split("?")[0] || "";
    } else if (url.includes("shorts/")) {
      videoId = url.split("shorts/")[1]?.split("?")[0] || "";
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : url;
  };

  // 3. Google Drive
  const isDriveUrl = (url?: string) => {
    if (!url) return false;
    if (/drive\.google\.com|googleusercontent\.com/i.test(url)) return true;
    return /^[-\w]{25,}$/.test(url.trim());
  };

  const getDriveEmbedUrl = (url: string) => {
    const match = url.match(/[-\w]{25,}/);
    return match ? `https://drive.google.com/file/d/${match[0]}/preview` : url;
  };

  const isYt = !isTelegram && (video.metodo_exibicao === "iframe_youtube" || isYouTubeUrl(rawLink));
  const isDrive =
    !isTelegram && !isYt && (video.metodo_exibicao === "iframe_drive" || isDriveUrl(rawLink));

  const poster =
    video.poster_url || video.capa_url
      ? driveImg(video.poster_url || video.capa_url, 800)
      : undefined;

  return (
    <div className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-2xl flex flex-col justify-between animate-in fade-in duration-300 overflow-y-auto">
      {/* Top Header */}
      <div className="p-4 sm:p-6 flex items-center justify-between border-b border-white/10 bg-neutral-950/80 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-xl bg-red-600/20 border border-red-500/30 grid place-items-center flex-shrink-0 text-red-500">
            <Tv className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-red-500 block">
              {video.tipo_video || "Video Streaming"}
            </span>
            <h2 className="text-sm sm:text-base font-black text-white truncate">{video.titulo}</h2>
          </div>
        </div>

        <button
          onClick={onClose}
          className="size-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 grid place-items-center text-white active:scale-90 transition-all ml-4 flex-shrink-0"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Área Central do Player */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-5xl mx-auto w-full">
        <div className="w-full min-h-[300px] rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.9)] relative group flex items-center justify-center">
          {isTelegramWidget ? (
            <TelegramWidget postUrl={rawLink} />
          ) : isTelegramStream ? (
            <>
              <video
                src={streamUrl}
                controls
                autoPlay
                poster={poster}
                onError={() => setStreamError(true)}
                className="w-full aspect-video object-contain bg-black"
              >
                Seu navegador não suporta reprodução de vídeo nativa.
              </video>

              {streamError && (
                <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center p-6 text-center">
                  <AlertCircle className="size-12 text-red-500 mb-3 animate-bounce" />
                  <h3 className="text-base font-black text-white uppercase tracking-tight mb-1">
                    Não foi possível carregar o vídeo
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-md mb-4">
                    O servidor de mídia do Telegram pode estar indisponível no momento. Tente
                    novamente em instantes.
                  </p>
                </div>
              )}
            </>
          ) : isYt ? (
            <iframe
              src={getYouTubeEmbedUrl(rawLink)}
              title={video.titulo}
              className="w-full aspect-video border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : isDrive ? (
            <iframe
              src={getDriveEmbedUrl(rawLink)}
              title={video.titulo}
              className="w-full aspect-video border-0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          ) : (
            <>
              <video
                src={rawLink}
                controls
                autoPlay
                poster={poster}
                onError={() => setStreamError(true)}
                className="w-full aspect-video object-contain bg-black"
              >
                Seu navegador não suporta reprodução de vídeo nativa.
              </video>

              {streamError && (
                <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center p-6 text-center">
                  <AlertCircle className="size-12 text-red-500 mb-3 animate-bounce" />
                  <h3 className="text-base font-black text-white uppercase tracking-tight mb-1">
                    Não foi possível carregar o vídeo
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-md mb-4">
                    Verifique se o link informado é um vídeo válido do Telegram, YouTube ou Google
                    Drive com permissão pública.
                  </p>
                  {rawLink && (
                    <a
                      href={rawLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20"
                    >
                      Abrir link original
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Detalhes do Vídeo */}
        <div className="w-full mt-6 bg-neutral-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
            <div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                {video.titulo}
              </h1>
              <p className="text-sm font-bold text-red-400 mt-0.5">{video.artista}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-red-500" />
                {isTelegram
                  ? "Telegram Channel Video"
                  : isDrive
                    ? "Google Drive HD"
                    : isYt
                      ? "YouTube HD"
                      : "Direct Stream"}
              </span>
            </div>
          </div>

          {video.descricao && (
            <div className="text-neutral-300 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
              {video.descricao}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
        Empire Play • Media Streaming Engine
      </div>
    </div>
  );
}
