import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ContentGrid } from './play.index';
import { usePlay } from './play';

export const Route = createFileRoute('/play/mvs')({ component: PlayMVs });

export default function PlayMVs() {
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { setNowPlaying } = usePlay();

  useEffect(() => {
    supabase
      .from('Music Videos')
      .select('*')
      .then(({ data, error }) => {
        if (error) console.error('[Play/MVs]', error);
        setObras(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 pb-32">
      <h2 className="text-xl font-bold mb-4">🎥 Music Videos</h2>
      <ContentGrid
        obras={obras}
        loading={loading}
        emptyLabel="Nenhum Music Video encontrado."
        onPlay={setNowPlaying}
      />
    </div>
  );
}
