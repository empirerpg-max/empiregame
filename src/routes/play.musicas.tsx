import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ContentGrid } from './play.index';
import { usePlay } from './play';

export const Route = createFileRoute('/play/musicas')({ component: PlayMusicas });

export default function PlayMusicas() {
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { setNowPlaying } = usePlay();

  useEffect(() => {
    supabase
      .from('Musicas')
      .select('*')
      .then(({ data, error }) => {
        if (error) console.error('[Play/Musicas]', error);
        setObras(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 pb-32">
      <h2 className="text-xl font-bold mb-4">🎵 Músicas</h2>
      <ContentGrid
        obras={obras}
        loading={loading}
        emptyLabel="Nenhuma música encontrada."
        onPlay={setNowPlaying}
      />
    </div>
  );
}
