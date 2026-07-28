import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveTelegramFileUrls } from '@/services/telegram';
import { usePlay } from './play';

export const Route = createFileRoute('/play/mvs')({ component: PlayMVs });

interface MVItem {
  id: string | number;
  titulo: string;
  artista?: string;
  capa?: string;
  streamUrl?: string;
  audioUrl?: string;
  telegramFileId?: string;
}

export default function PlayMVs() {
  const [items, setItems] = useState<MVItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setNowPlaying } = usePlay();

  useEffect(() => {
    async function load() {
      console.log('[Play/MVs] Iniciando busca no Supabase…');
      setLoading(true);
      setError(null);

      const { data, error: sbError } = await supabase
        .from('Music Videos')
        .select('*');

      if (sbError) {
        console.error('[Play/MVs] Erro Supabase:', sbError);
        setError(`Erro ao carregar Music Videos: ${sbError.message}`);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        console.warn(
          '[Play/MVs] Supabase retornou array vazio. ' +
            'Verifique RLS na tabela "Music Videos" ou se há registros cadastrados.'
        );
        setItems([]);
        setLoading(false);
        return;
      }

      console.log(`[Play/MVs] ${data.length} registros recebidos do Supabase:`, data);

      const fileIds = data
        .map((row: any) => row.telegram_file_id || '')
        .filter(Boolean) as string[];

      console.log(`[Play/MVs] Resolvendo ${fileIds.length} telegram_file_ids…`);
      const urlMap = fileIds.length > 0
        ? await resolveTelegramFileUrls(fileIds)
        : new Map<string, string | null>();

      const mapped: MVItem[] = data.map((row: any) => {
        const fileId = row.telegram_file_id || '';
        const streamUrl = fileId ? (urlMap.get(fileId) ?? undefined) : undefined;
        return {
          id: row.id ?? row.telegram_topic_id ?? String(Math.random()),
          titulo:
            row['Nome do video'] ||
            row.nome_do_video ||
            row.titulo ||
            row.Nome ||
            'Sem Título',
          artista:
            row['Nome do Artista'] ||
            row['Nome do Criador'] ||
            row.artista ||
            row.nome_do_criador ||
            '',
          capa:
            row['Capa da Musica'] ||
            row.Thumb ||
            row.thumb ||
            row.capa ||
            row.thumbnail_url ||
            '',
          telegramFileId: fileId || undefined,
          streamUrl,
          audioUrl: row['Link do audio'] || row.link_do_audio || '',
        };
      });

      console.log('[Play/MVs] Items mapeados (com streamUrls):', mapped);
      setItems(mapped);
      setLoading(false);
    }

    load();
  }, []);

  if (loading)
    return (
      <div className="p-4 pb-32">
        <h2 className="text-xl font-bold mb-4">🎥 Music Videos</h2>
        <div className="text-center mt-10 text-gray-400">Carregando Music Videos…</div>
      </div>
    );

  if (error)
    return (
      <div className="p-4 pb-32">
        <h2 className="text-xl font-bold mb-4">🎥 Music Videos</h2>
        <div className="text-center mt-10 text-red-400">{error}</div>
      </div>
    );

  if (items.length === 0)
    return (
      <div className="p-4 pb-32">
        <h2 className="text-xl font-bold mb-4">🎥 Music Videos</h2>
        <div className="text-center mt-10 text-gray-400">
          Nenhum Music Video encontrado.
          <br />
          <span className="text-xs text-gray-500">
            (Verifique RLS na tabela <code>Music Videos</code> no Supabase)
          </span>
        </div>
      </div>
    );

  return (
    <div className="p-4 pb-32">
      <h2 className="text-xl font-bold mb-4">🎥 Music Videos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            className="bg-[#1e2736] rounded-xl overflow-hidden shadow flex flex-col"
          >
            {item.streamUrl ? (
              <video
                src={item.streamUrl}
                controls
                preload="metadata"
                poster={item.capa || undefined}
                className="w-full aspect-video bg-black"
                onError={(e) =>
                  console.error('[Play/MVs] Erro ao reproduzir MV:', item.titulo, e)
                }
              />
            ) : item.capa ? (
              <img
                src={item.capa}
                alt={item.titulo}
                className="w-full aspect-video object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full aspect-video bg-gray-800 flex items-center justify-center text-4xl">
                🎥
              </div>
            )}

            <div className="p-3 flex flex-col gap-1">
              <h3 className="font-bold text-sm truncate">{item.titulo}</h3>
              {item.artista && (
                <p className="text-xs text-gray-400 truncate">{item.artista}</p>
              )}
              {!item.streamUrl && (
                <p className="text-[10px] text-yellow-500/70 mt-1">
                  {item.telegramFileId
                    ? '⚠ Streaming indisponível (verifique VITE_TELEGRAM_BOT_TOKEN)'
                    : '⚠ Sem link de mídia cadastrado'}
                </p>
              )}
              {item.audioUrl && (
                <button
                  onClick={() =>
                    setNowPlaying({
                      titulo: item.titulo,
                      artista: item.artista,
                      capa: item.capa,
                      audioUrl: item.audioUrl!,
                    })
                  }
                  className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-full bg-[#2AABEE] text-white hover:bg-[#2AABEE]/80 cursor-pointer transition-all"
                >
                  ▶ Tocar áudio
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
