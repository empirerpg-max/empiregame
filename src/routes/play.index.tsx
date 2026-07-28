import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlay } from './play';

export const Route = createFileRoute('/play/')({ component: PlayHome });

interface ChartItem {
  id: number | string;
  titulo: string;
  artista?: string;
  capa?: string;
  posicao?: number;
  audioUrl?: string;
  source: string;
}

async function fetchCharts(): Promise<ChartItem[]> {
  const results: ChartItem[] = [];

  // Top 50 Spotify
  const { data: spotify } = await supabase
    .from('Top_50_Spotify')
    .select('*')
    .order('Posicao', { ascending: true })
    .limit(50);
  if (spotify) {
    spotify.forEach((row: any) => {
      results.push({
        id: `spotify-${row.id ?? row.Posicao}`,
        titulo: row['Nome da musica'] || row.nome_da_musica || row.Nome || 'Sem título',
        artista: row['Nome do Artista'] || row.artista || '',
        capa: row['Capa da Musica'] || row.capa_da_musica || row.Capa || '',
        posicao: row.Posicao,
        audioUrl: row['Link do audio'] || row.link_do_audio || '',
        source: 'Spotify',
      });
    });
  }

  // Top Songs Apple Music
  const { data: apple } = await supabase
    .from('Top_Songs_Apple_Music')
    .select('*')
    .order('Posicao', { ascending: true })
    .limit(50);
  if (apple) {
    apple.forEach((row: any) => {
      results.push({
        id: `apple-${row.id ?? row.Posicao}`,
        titulo: row['Nome da musica'] || row.nome_da_musica || row.Nome || 'Sem título',
        artista: row['Nome do Artista'] || row.artista || '',
        capa: row['Capa da Musica'] || row.capa_da_musica || row.Capa || '',
        posicao: row.Posicao,
        audioUrl: row['Link do audio'] || row.link_do_audio || '',
        source: 'Apple Music',
      });
    });
  }

  // Top Videos YT
  const { data: yt } = await supabase
    .from('Top_Videos_YT')
    .select('*')
    .order('Posicao', { ascending: true })
    .limit(50);
  if (yt) {
    yt.forEach((row: any) => {
      results.push({
        id: `yt-${row.id ?? row.Posicao}`,
        titulo: row['Nome do video'] || row.nome_do_video || row.Nome || 'Sem título',
        artista: row['Nome do Criador'] || row.nome_do_criador || '',
        capa: row.Thumb || row.thumb || row.thumbnail_url || '',
        posicao: row.Posicao,
        audioUrl: row['Link do audio'] || row.link_do_audio || '',
        source: 'YouTube',
      });
    });
  }

  return results;
}

export default function PlayHome() {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { setNowPlaying } = usePlay();

  useEffect(() => {
    fetchCharts()
      .then(setCharts)
      .catch((err) => console.error('[Play/Home] Erro:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 pb-32">
      <h2 className="text-xl font-bold mb-6">🏆 Top Charts</h2>

      {loading && (
        <div className="text-center mt-10 text-gray-400">Carregando charts...</div>
      )}

      {!loading && charts.length === 0 && (
        <div className="text-center mt-10 text-gray-400">Nenhum destaque encontrado.</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {charts.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            className="group bg-[#1e2736] rounded-xl overflow-hidden shadow flex flex-col"
          >
            <div className="relative">
              {item.capa ? (
                <img src={item.capa} alt={item.titulo} className="w-full aspect-square object-cover" loading="lazy" />
              ) : (
                <div className="w-full aspect-square bg-gray-800 flex items-center justify-center text-4xl">🎵</div>
              )}
              {/* Badge posição */}
              {item.posicao && (
                <span className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  #{item.posicao}
                </span>
              )}
              {/* Badge fonte */}
              <span className="absolute top-2 right-2 bg-black/70 text-[10px] px-1.5 py-0.5 rounded-full text-gray-300">
                {item.source}
              </span>
            </div>

            <div className="p-3 flex flex-col gap-2 flex-1">
              <h3 className="font-bold text-sm truncate">{item.titulo}</h3>
              {item.artista && (
                <p className="text-xs text-gray-400 truncate">{item.artista}</p>
              )}

              {/* Botão Play */}
              <button
                disabled={!item.audioUrl}
                onClick={() =>
                  item.audioUrl &&
                  setNowPlaying({
                    titulo: item.titulo,
                    artista: item.artista,
                    capa: item.capa,
                    audioUrl: item.audioUrl,
                  })
                }
                className={
                  `mt-auto flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-full transition-all ${
                    item.audioUrl
                      ? 'bg-[#2AABEE] text-white hover:bg-[#2AABEE]/80 cursor-pointer'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`
                }
              >
                ▶ {item.audioUrl ? 'Play' : 'Indisponível'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Grid reutilizável para as sub-abas ──────────────────────────────────────
export function ContentGrid({
  obras,
  loading,
  emptyLabel = 'Nenhum conteúdo encontrado.',
  onPlay,
}: {
  obras: any[];
  loading: boolean;
  emptyLabel?: string;
  onPlay?: (track: { titulo: string; artista?: string; capa?: string; audioUrl: string }) => void;
}) {
  if (loading)
    return <div className="text-center mt-10 text-gray-400">Carregando...</div>;
  if (obras.length === 0)
    return <div className="text-center mt-10 text-gray-400">{emptyLabel}</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {obras.map((obra, i) => {
        const id      = obra.id_do_topico || obra.telegram_topic_id || String(i);
        const titulo  = obra['Nome da musica'] || obra['Nome do video'] || obra['Nome'] || obra.nome_da_musica || obra.nome_do_video || obra.nome || obra.titulo || 'Sem Título';
        const artista = obra['Nome do Criador'] || obra['Nome do Artista'] || obra.nome_do_criador || obra.artista || obra.id_do_criador || '';
        const capa    = obra['Capa da Musica'] || obra['Capa'] || obra.Thumb || obra.thumb || obra.capa_da_musica || obra.capa || obra.thumbnail_url || '';
        const audioUrl = obra['Link do audio'] || obra.link_do_audio || '';

        return (
          <div
            key={`${id}-${i}`}
            className="group bg-[#1e2736] rounded-xl overflow-hidden shadow flex flex-col"
          >
            {capa ? (
              <img src={capa} alt={titulo} className="w-full aspect-square object-cover" loading="lazy" />
            ) : (
              <div className="w-full aspect-square bg-gray-800 flex items-center justify-center text-4xl">🎵</div>
            )}
            <div className="p-3 flex flex-col gap-2 flex-1">
              <h3 className="font-bold text-sm truncate">{titulo}</h3>
              {artista && <p className="text-xs text-gray-400 truncate">{artista}</p>}

              {onPlay && (
                <button
                  disabled={!audioUrl}
                  onClick={() =>
                    audioUrl &&
                    onPlay({ titulo, artista, capa, audioUrl })
                  }
                  className={
                    `mt-auto flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-full transition-all ${
                      audioUrl
                        ? 'bg-[#2AABEE] text-white hover:bg-[#2AABEE]/80 cursor-pointer'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`
                  }
                >
                  ▶ {audioUrl ? 'Play' : 'Indisponível'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
