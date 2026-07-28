// src/routes/catalogo.index.tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Music, Disc3, Clapperboard, Video } from 'lucide-react';

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export const Route = createFileRoute('/catalogo/')({ component: CatalogoPage });

// ---------------------------------------------------------------------------
// GAS URL fixo — backend Google Apps Script
// ---------------------------------------------------------------------------
const GAS_URL =
  'https://script.google.com/macros/s/AKfycby7Epe3MHPMvje5OKtSlNn-tSWpowLPOJ7DVflFJqgZNOKCnN9IcGwWYL1QSeRtgJrQ7w/exec';

// ---------------------------------------------------------------------------
// Interface — propriedades exatas que o backend converte da planilha
// ---------------------------------------------------------------------------
export interface Obra {
  id_do_topico: string;
  nome?: string;
  titulo?: string;
  nome_do_criador?: string;
  artista?: string;
  capa?: string;
  thumb?: string;
  thumbnail_url?: string;
  telegram_file_id?: string;
}

// ---------------------------------------------------------------------------
// Abas correspondentes às planilhas do backend
// ---------------------------------------------------------------------------
type Tab = 'musicas' | 'albuns' | 'music_videos' | 'videos';

interface TabConfig {
  id: Tab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const TABS: TabConfig[] = [
  { id: 'musicas',      label: 'Músicas',      icon: Music        },
  { id: 'albuns',       label: 'Álbuns',       icon: Disc3        },
  { id: 'music_videos', label: 'Music Videos', icon: Clapperboard },
  { id: 'videos',       label: 'Vídeos',       icon: Video        },
];

// ---------------------------------------------------------------------------
// Cache em memória por aba
// ---------------------------------------------------------------------------
const memoryCache = new Map<Tab, Obra[]>();

async function fetchObras(aba: Tab): Promise<Obra[]> {
  if (memoryCache.has(aba)) return memoryCache.get(aba)!;

  const res = await fetch(GAS_URL + '?action=' + aba);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  const items: Obra[] = Array.isArray(json) ? json : (json?.data ?? []);
  memoryCache.set(aba, items);
  return items;
}

// ---------------------------------------------------------------------------
// Skeleton Card
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div className="bg-[#1e2736] rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-white/10" />
      <div className="p-2 space-y-1.5">
        <div className="h-3 bg-white/10 rounded-full w-4/5" />
        <div className="h-2.5 bg-white/10 rounded-full w-3/5" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Obra Card — com fallbacks para título, artista e imagem
// ---------------------------------------------------------------------------
function ObraCard({ obra }: { obra: Obra }) {
  const titulo  = obra.nome || obra.titulo;
  const artista = obra.nome_do_criador || obra.artista;
  const imagem  = obra.capa || obra.thumb || obra.thumbnail_url;

  return (
    <Link
      to="/catalogo/$id"
      params={{ id: obra.id_do_topico }}
      className="group relative bg-[#1e2736] rounded-2xl overflow-hidden shadow-lg
                 hover:scale-[1.02] active:scale-[0.98] transition-transform"
    >
      {/* Capa */}
      <div className="aspect-square relative overflow-hidden bg-white/5">
        {imagem ? (
          <img
            src={imagem}
            alt={titulo ?? 'Capa'}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={32} className="text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Info — só renderiza se houver valor */}
      <div className="p-2">
        {titulo  && <p className="text-white text-xs font-semibold truncate">{titulo}</p>}
        {artista && <p className="text-white/50 text-[11px] truncate">{artista}</p>}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-3">
      <Disc3 size={40} className="text-white/20" />
      <p className="text-white/40 text-sm">
        Nenhum conteúdo encontrado em{' '}
        <span className="text-white/60 font-medium">{label}</span>.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function CatalogoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('musicas');
  const [obras, setObras]         = useState<Obra[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Dispara fetch ao trocar de aba
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchObras(activeTab)
      .then((data) => {
        setObras(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Erro ao carregar. Tente novamente.');
        setLoading(false);
      });
  }, [activeTab]);

  const activeTabConfig = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-[#0f1923] text-white pb-24">

      {/* ------------------------------------------------------------------ */}
      {/* Header sticky com menu de abas                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="sticky top-0 z-10 bg-[#0f1923]/95 backdrop-blur-sm border-b border-white/10">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-lg font-bold leading-tight">Catálogo</h1>
        </div>

        <div
          className="flex overflow-x-auto scrollbar-none gap-1 px-3 pb-3"
          role="tablist"
          aria-label="Categorias do catálogo"
        >
          {TABS.map((tab) => {
            const Icon     = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full
                  text-xs font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-[#2AABEE] text-white shadow-lg shadow-[#2AABEE]/25'
                    : 'bg-white/8 text-white/55 hover:bg-white/15 hover:text-white/80'
                  }
                `}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Conteúdo                                                             */}
      {/* ------------------------------------------------------------------ */}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 gap-3 px-4 pt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Erro */}
      {!loading && error && (
        <div className="text-center py-16 px-8">
          <p className="text-white/40 text-sm mb-4">{error}</p>
          <button
            onClick={() => {
              memoryCache.delete(activeTab);
              setActiveTab((prev) => prev); // re-trigger useEffect
              setError(null);
              setLoading(true);
              fetchObras(activeTab)
                .then(setObras)
                .catch(() => setError('Erro ao carregar. Tente novamente.'))
                .finally(() => setLoading(false));
            }}
            className="text-[#2AABEE] text-sm underline underline-offset-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Vazio */}
      {!loading && !error && obras.length === 0 && (
        <EmptyState label={activeTabConfig.label} />
      )}

      {/* Grid de obras */}
      {!loading && !error && obras.length > 0 && (
        <div className="grid grid-cols-2 gap-3 px-4 pt-4">
          {obras.map((obra) => (
            <ObraCard key={obra.id_do_topico} obra={obra} />
          ))}
        </div>
      )}
    </div>
  );
}
