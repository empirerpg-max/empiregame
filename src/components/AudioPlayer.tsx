import { useEffect, useRef } from 'react';

export interface NowPlaying {
  titulo: string;
  artista?: string;
  capa?: string;
  audioUrl: string;
}

interface AudioPlayerProps {
  track: NowPlaying | null;
  onClose: () => void;
}

export default function AudioPlayer({ track, onClose }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && track) {
      audioRef.current.load();
      audioRef.current.play().catch(() => null);
    }
  }, [track?.audioUrl]);

  if (!track) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0f1e]/95 backdrop-blur border-t border-white/10 px-4 py-2 flex items-center gap-4 shadow-2xl">
      {/* Capa */}
      {track.capa ? (
        <img src={track.capa} alt={track.titulo} className="w-12 h-12 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center text-2xl shrink-0">🎵</div>
      )}

      {/* Título e artista */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate text-white">{track.titulo}</p>
        {track.artista && (
          <p className="text-xs text-gray-400 truncate">{track.artista}</p>
        )}
      </div>

      {/* Player HTML5 */}
      <audio
        ref={audioRef}
        controls
        autoPlay
        className="h-8 max-w-[260px] sm:max-w-sm accent-[#2AABEE]"
      >
        <source src={track.audioUrl} />
        Seu navegador não suporta áudio.
      </audio>

      {/* Fechar */}
      <button
        onClick={onClose}
        className="ml-2 text-white/50 hover:text-white text-xl leading-none shrink-0"
        aria-label="Fechar player"
      >
        ✕
      </button>
    </div>
  );
}
