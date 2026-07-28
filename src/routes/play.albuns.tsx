import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ContentGrid } from './play.index';

export const Route = createFileRoute('/play/albuns')({ component: PlayAlbuns });

export default function PlayAlbuns() {
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/catalogo?action=albuns')
      .then((r) => r.json())
      .then((data) => setObras(Array.isArray(data) ? data : []))
      .catch((err) => console.error('[Play/Albuns] Erro:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 pb-24">
      <h2 className="text-xl font-bold mb-4">💿 Álbuns</h2>
      <ContentGrid obras={obras} loading={loading} emptyLabel="Nenhum álbum encontrado." />
    </div>
  );
}
