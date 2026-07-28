import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlay } from './play';

export const Route = createFileRoute('/play/albuns')({ component: PlayAlbuns });

interface AlbumItem {
  id: string | number;
  titulo: string;
  artista?: string;
  capa?: string;
  audioUrl?: string;
}

export default function PlayAlbuns() {
  const [items, setItems]   = useState<AlbumItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const { setNowPlaying }   = usePlay();

  useEffect(() => {
    console.log('[Play/Albuns] Iniciando busca no Supabase…');

    supabase
      .from('Albuns')
      .select('*')
      .then(({ data, error: sbError }) => {
        if (sbError) {
          console.error('[Play/Albuns] Erro Supabase:', sbError);
          setError(`Erro ao carregar álbuns: ${sbError.message}`);
          return;
        }

        if (!data || data.length === 0) {
          console.warn(
            '[Play/Albuns] Supabase retornou array vazio. ' +
              'Verifique RLS na tabela Albuns ou se há registros cadastrados.'
          );
          setItems([]);
          return;
        }

        console.log(`[Play/Albuns] ${data.length} registros recebidos:`, data);

        const mapped: AlbumItem[] = data.map((row: any) => ({
          id: row.id ?? row.telegram_topic_id ?? String(Math.random()),
          titulo:
            row['Nome do Album'] ||
            row.nome_do_album ||
            row['Nome'] ||
            row.nome ||
            row.titulo ||
            'Sem Título',
          artista:
            row['Nome do Artista'] ||
            row.artista ||
            row.nome_do_artista ||
            '',
          capa:
            row['Capa do Album'] ||
            row['Capa da Musica'] ||
            row.capa_do_album ||
            row.capa ||
            row.Capa ||
            '',
          audioUrl:
            row['Link do audio'] ||
            row.link_do_audio ||
            '',
        }));

        console.log('[Play/Albuns] Items mapeados:', mapped);
        setItems(mapped);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="p-4 pb-32">
        <h2 className="text-xl font-bold mb-4">💿 Álbuns</h2>
        <div className="text-center mt-10 text-gray-400">Carregando álbuns…</div>
      </div>
    );

  if (error)
    return (
      <div className="p-4 pb-32">
        <h2 className="text-xl font-bold mb-4">💿 Álbuns</h2>
        <div className="text-center mt-10 text-red-400">{error}</div>
      </div>
    );

  if (items.length === 0)
    return (
      <div className="p-4 pb-32">
        <h2 className="text-xl font-bold mb-4">💿 Álbuns</h2>
        <div className="text-center mt-10 text-gray-400">
          Nenhum álbum encontrado.
          <br />
          <span className="text-xs text-gray-500">
            (Verifique RLS na tabela <code>Albuns</code> no Supabase)
          </span>
        </div>
      </div>
    );

  return (
    <div className="p-4 pb-32">
      <h2 className="text-xl font-bold mb-4">💿 Álbuns</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            className="group bg-[#1e2736] rounded-xl overflow-hidden shadow flex flex-col"
          >
            {item.capa ? (
              <img
                src={item.capa}
                alt={item.titulo}
                className="w-full aspect-square object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full aspect-square bg-gray-800 flex items-center justify-center text-4xl">
                💿
              </div>
            )}
            <div className="p-3 flex flex-col gap-2 flex-1">
              <h3 className="font-bold text-sm truncate">{item.titulo}</h3>
              {item.artista && (
                <p className="text-xs text-gray-400 truncate">{item.artista}</p>
              )}
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
