import { createFileRoute, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from '@tanstack/react-router';
import ForumObra from '../pages/ForumObra';
import type { Obra } from '../pages/ForumObra';

export const Route = createFileRoute('/catalogo/$id')({
  component: CatalogoObraPage,
});

export default function CatalogoObraPage() {
  const { id } = useParams({ from: '/catalogo/$id' });
  const router = useRouter();
  const [obra, setObra] = useState<Obra | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    fetch(`/api/catalogo/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((data: Obra) => setObra(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1923] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#2AABEE] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !obra) {
    return (
      <div className="min-h-screen bg-[#0f1923] flex flex-col items-center justify-center gap-4">
        <p className="text-white/50 text-sm">Obra não encontrada.</p>
        <button
          onClick={() => router.history.back()}
          className="text-[#2AABEE] text-sm underline"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0f1923]">
      <button
        onClick={() => router.history.back()}
        className="absolute top-3 left-3 z-30 bg-black/50 backdrop-blur-sm rounded-full p-2 text-white hover:bg-black/70 transition"
        aria-label="Voltar"
      >
        <ArrowLeft size={18} />
      </button>

      <ForumObra obra={obra} />
    </div>
  );
}
