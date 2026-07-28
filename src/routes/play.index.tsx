import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/play/')({ component: PlayHome });

export default function PlayHome() {
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/catalogo?action=top50spotify')
      .then((r) => r.json())
      .then((data) => setObras(Array.isArray(data) ? data : []))
      .catch((err) => console.error('[Play] Erro:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 pb-24">
      <h2 className="text-xl font-bold mb-4">Destaques</h2>
      <ContentGrid obras={obras} loading={loading} emptyLabel="Nenhum destaque encontrado." />
    </div>
  );
}

// ── Grid reutilizável ────────────────────────────────────────────────────────
export function ContentGrid({
  obras,
  loading,
  emptyLabel = 'Nenhum conteúdo encontrado.',
}: {
  obras: any[];
  loading: boolean;
  emptyLabel?: string;
}) {
  if (loading)
    return <div className="text-center mt-10 text-gray-400">Carregando...</div>;
  if (obras.length === 0)
    return <div className="text-center mt-10 text-gray-400">{emptyLabel}</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {obras.map((obra, i) => {
        const id     = obra.id_do_topico || obra.telegram_topic_id || String(i);
        const titulo = obra.nome_da_musica || obra.nome_do_video || obra.nome || obra.titulo || 'Sem Título';
        const artista = obra.nome_do_criador || obra.artista || obra.id_do_criador || 'Desconhecido';
        const capa   = obra.capa_da_musica || obra.capa || obra.thumb || obra.thumbnail_url;

        return (
          <a
            key={`${id}-${i}`}
            href={`/catalogo/${id}`}
            className="group bg-[#1e2736] rounded-xl overflow-hidden shadow hover:scale-105 transition-transform flex flex-col"
          >
            {capa ? (
              <img src={capa} alt={titulo} className="w-full aspect-square object-cover" loading="lazy" />
            ) : (
              <div className="w-full aspect-square bg-gray-800 flex items-center justify-center text-4xl">🎵</div>
            )}
            <div className="p-3">
              <h3 className="font-bold text-sm truncate">{titulo}</h3>
              <p className="text-xs text-gray-400 truncate mt-1">{artista}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
