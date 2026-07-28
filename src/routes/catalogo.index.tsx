import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Search, Music, Film, TrendingUp, Star } from 'lucide-react';
import type { Obra } from '../pages/ForumObra';

export const Route = createFileRoute('/catalogo/')({ component: CatalogoPage });

// Telegram silent auth
function useTelegramUser() {
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  return { id: tgUser?.id ?? 0, name: tgUser?.first_name ?? 'Anônimo' };
}

const FILTERS = ['Todos', 'Músicas', 'Vídeos', 'Em Alta'] as const;
type Filter = (typeof FILTERS)[number];

const SORT_OPTIONS = [
  { label: 'Mais Tocadas', value: 'streams' },
  { label: 'Mais Recentes', value: 'recent' },
  { label: 'A–Z', value: 'az' },
] as const;

export default function CatalogoPage() {
  const user = useTelegramUser();
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('Todos');
  const [sort, setSort] = useState<string>('streams');

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    fetch('/api/catalogo')
      .then((r) => r.json())
      .then((data: Obra[]) => setObras(data))
      .catch(() => setObras([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = obras
    .filter((o) => {
      const matchesQuery = o.title.toLowerCase().includes(query.toLowerCase()) ||
        o.artist.toLowerCase().includes(query.toLowerCase());
      const matchesFilter =
        filter === 'Todos' ||
        (filter === 'Músicas' && o.type === 'music') ||
        (filter === 'Vídeos' && o.type === 'video') ||
        (filter === 'Em Alta' && o.streams > 100000);
      return matchesQuery && matchesFilter;
    })
    .sort((a, b) => {
      if (sort === 'streams') return b.streams - a.streams;
      if (sort === 'az') return a.title.localeCompare(b.title);
      return 0; // recent handled by API order
    });

  return (
    <div className="min-h-screen bg-[#0f1923] text-white pb-24">
      {/* Top Header */}
      <div className="sticky top-0 z-10 bg-[#0f1923]/95 backdrop-blur-sm border-b border-white/10 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold">Catálogo</h1>
            <p className="text-white/40 text-xs">Olá, {user.name} 👋</p>
          </div>
          <TrendingUp size={20} className="text-[#2AABEE]" />
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-[#1e2736] rounded-full px-4 py-2 mb-3">
          <Search size={15} className="text-white/40" />
          <input
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            placeholder="Buscar músicas, artistas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-[#2AABEE] text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Sort Row */}
      <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto scrollbar-none">
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSort(s.value)}
            className={`flex-shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${
              sort === s.value
                ? 'border-[#2AABEE] text-[#2AABEE]'
                : 'border-white/10 text-white/40'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#2AABEE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-white/30 py-20 text-sm">Nenhuma obra encontrada.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pt-2">
          {filtered.map((obra) => (
            <Link
              key={obra.id}
              to="/catalogo/$id"
              params={{ id: obra.id }}
              className="group relative bg-[#1e2736] rounded-2xl overflow-hidden shadow-lg hover:scale-[1.02] transition-transform"
            >
              {/* Cover */}
              <div className="aspect-square relative overflow-hidden">
                <img
                  src={obra.cover}
                  alt={obra.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                {/* Type badge */}
                <span className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm rounded-full p-1">
                  {obra.type === 'music'
                    ? <Music size={11} className="text-[#2AABEE]" />
                    : <Film size={11} className="text-purple-400" />}
                </span>
                {/* Streams badge */}
                <span className="absolute bottom-2 right-2 bg-black/60 text-white/70 text-[10px] rounded-full px-2 py-0.5 flex items-center gap-1">
                  <Star size={9} className="fill-yellow-400 text-yellow-400" />
                  {obra.streams > 1000000
                    ? `${(obra.streams / 1000000).toFixed(1)}M`
                    : obra.streams > 1000
                    ? `${(obra.streams / 1000).toFixed(0)}K`
                    : obra.streams}
                </span>
              </div>
              {/* Info */}
              <div className="p-2">
                <p className="text-white text-xs font-semibold truncate">{obra.title}</p>
                <p className="text-white/50 text-[11px] truncate">{obra.artist}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
