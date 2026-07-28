import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ContentGrid } from './play.index';

export const Route = createFileRoute('/play/mvs')({ component: PlayMVs });

export default function PlayMVs() {
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/catalogo?action=music_videos')
      .then((r) => r.json())
      .then((data) => setObras(Array.isArray(data) ? data : []))
      .catch((err) => console.error('[Play/MVs] Erro:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 pb-24">
      <h2 className="text-xl font-bold mb-4">🎥 Music Videos</h2>
      <ContentGrid obras={obras} loading={loading} emptyLabel="Nenhum Music Video encontrado." />
    </div>
  );
}
