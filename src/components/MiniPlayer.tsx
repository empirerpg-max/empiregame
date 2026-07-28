/**
 * MiniPlayer.tsx
 * Player de vídeo flutuante universal.
 * Faz fetch da URL .mp4 via API usando o telegram_file_id e
 * exibe um <video> nativo enquanto o usuário continua navegando.
 */

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';

// ────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────

type PlayerState = 'loading' | 'ready' | 'error';

interface MiniPlayerProps {
  /** O telegram_file_id longo e opaco vindo dos dados da obra */
  telegramFileId: string;
  /** Título exibido na barra do player (ex: nome da obra) */
  title?: string;
  /** URL base da API para obter a URL pública do vídeo */
  apiBaseUrl: string;
  /** Callback chamado quando o usuário fecha o player */
  onClose: () => void;
}

interface VideoUrlResponse {
  url: string;
}

// ────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────

export default function MiniPlayer({
  telegramFileId,
  title = 'Reproduzindo',
  apiBaseUrl,
  onClose,
}: MiniPlayerProps) {
  const [state, setState] = useState<PlayerState>('loading');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Busca a URL fresca do Telegram via API ────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchVideoUrl() {
      setState('loading');
      setVideoUrl(null);
      setErrorMsg('');

      try {
        const endpoint = `${apiBaseUrl}?action=getVideoUrl&file_id=${encodeURIComponent(telegramFileId)}`;
        const res = await fetch(endpoint);

        if (!res.ok) {
          throw new Error(`API retornou status ${res.status}`);
        }

        const data: VideoUrlResponse = await res.json();

        if (!data?.url) {
          throw new Error('A API não retornou uma URL válida.');
        }

        if (!cancelled) {
          setVideoUrl(data.url);
          setState('ready');
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Erro desconhecido';
          setErrorMsg(msg);
          setState('error');
        }
      }
    }

    fetchVideoUrl();

    return () => {
      cancelled = true;
    };
  }, [telegramFileId, apiBaseUrl, retryKey]);

  // ── Tamanho do player (compacto vs expandido) ─────────────
  const playerWidth = isExpanded ? 'min(96vw, 720px)' : 'min(90vw, 400px)';

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Overlay de fundo – clique fora fecha o player */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Player flutuante */}
      <div
        role="dialog"
        aria-label={`Player: ${title}`}
        aria-modal="true"
        className="fixed bottom-6 right-4 z-50 bg-[#0a1520] rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col transition-all duration-300 ease-in-out"
        style={{ width: playerWidth, aspectRatio: '16/9' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Barra de título ── */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#0f1923]/90 border-b border-white/10 flex-shrink-0">
          <span className="text-xs font-semibold text-white/80 truncate max-w-[70%]">
            {title}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded((v) => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
              aria-label={isExpanded ? 'Minimizar player' : 'Expandir player'}
            >
              {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
              aria-label="Fechar player"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Área de conteúdo ── */}
        <div className="relative flex-1 bg-black flex items-center justify-center">
          {/* Estado: Carregando */}
          {state === 'loading' && (
            <div className="flex flex-col items-center gap-3 text-white/60">
              <Loader2 size={32} className="animate-spin text-[#2AABEE]" />
              <span className="text-xs">Carregando vídeo…</span>
            </div>
          )}

          {/* Estado: Erro */}
          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 text-white/60 px-6 text-center">
              <AlertCircle size={32} className="text-red-400" />
              <span className="text-xs text-red-300">Falha ao carregar</span>
              <span className="text-[10px] text-white/30 break-all">{errorMsg}</span>
              <button
                onClick={() => setRetryKey((k) => k + 1)}
                className="mt-1 text-[11px] text-[#2AABEE] underline hover:text-white transition"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Estado: Pronto – vídeo nativo */}
          {state === 'ready' && videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
              aria-label={`Vídeo: ${title}`}
            >
              <p className="text-xs text-white/40 p-4">
                Seu navegador não suporta reprodução de vídeo.
              </p>
            </video>
          )}
        </div>
      </div>
    </>
  );
}
