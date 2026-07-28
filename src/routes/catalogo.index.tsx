// src/routes/catalogo.index.tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { Music, Disc3, Clapperboard, Video, Home } from 'lucide-react';

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export const Route = createFileRoute('/catalogo/')({ component: CatalogoPage });

// ---------------------------------------------------------------------------
// GAS URL — variável de ambiente com fallback para URL fixa
// ---------------------------------------------------------------------------
const GAS_URL: string =
  (import.meta as any).env?.VITE_GAS_URL ??
  'https://script.google.com/macros/s/AKfycby7Epe3MHPMvje5OKtSlNn-tSWpowLPOJ7DVflFJqgZNOKCnN9IcGwWYL1QSeRtgJrQ7w/exec';

// ---------------------------------------------------------------------------
// Interface — aceita chaves snake_case dinâmicas geradas pelo backend GAS
// ---------------------------------------------------------------------------
export interface Obra {
  id_do_topico: string;
  // Título (fallback em cascata — mais específico primeiro)
  nome_da_musica?: string;
  nome_do_video?: string;
  nome?: string;
  titulo?: string;
  // Artista / Criador (fallback em cascata)
  nome_do_criador?: string;
  artista?: string;
  id_do_criador?: string;
  // Imagem (fallback em cascata — mais específico primeiro)
  capa_da_musica?: string;
  capa?: string;
  thumb?: string;
  thumbnail_url?: string;
  // Outros campos do backend
  telegram_file_id?: string;
  tipo?: string;
  // Permite qualquer chave snake_case extra sem quebrar TypeScript
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Abas — cada uma mapeia para um ?action= do GAS
// ---------------------------------------------------------------------------
type Tab = 'inicio' | 'musicas' | 'albuns' | 'music_videos' | 'videos';

interface TabConfig {
  id: Tab;
  label: string;
  action: string; // valor enviado como ?action=<action>
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const TABS: TabConfig[] = [
  { id: 'inicio',       label: 'Início',       action: 'top50spotify', icon: Home        },
  { id: 'musicas',      label: 'Músicas',      action: 'musicas',      icon: Music        },
  { id: 'albuns',       label: 'Álbuns',       action: 'albuns',       icon: Disc3        },
  { id: 'music_videos', label: 'Music Videos', action: 'music_videos', icon: Clapperboard },
  { id: 'videos',       label: 'Vídeos',       action: 'videos',       icon: Video        },
];

// ---------------------------------------------------------------------------
// Cache em memória por aba (chaveado pelo id da tab)
// ---------------------------------------------------------------------------
const memoryCache = new Map<Tab, Obra[]>();

async function fetchObras(tab: TabConfig): Promise<Obra[]> {
  if (memoryCache.has(tab.id)) return memoryCache.get(tab.id)!;

  // Consome a variável da URL do GAS com ?action=nome_da_categoria
  const res = await fetch(`${GAS_URL}?action=${tab.action}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  const items: Obra[] = Array.isArray(json) ? json : (json?.data ?? []);
  memoryCache.set(tab.id, items);
  return items;
}

// ---------------------------------------------------------------------------
// Helpers de fallback — REGRA RÍGIDA conforme especificação
// ---------------------------------------------------------------------------

/** Título: nome_da_musica → nome_do_video → nome → titulo */
export function getTitulo(obra: Obra): string {
  return (
    (obra.nome_da_musica as string | undefined) ||
    (obra.nome_do_video  as string | undefined) ||
    (obra.nome           as string | undefined) ||
    (obra.titulo         as string | undefined) ||
    'Sem Título'
  );
}

/** Artista: nome_do_criador → artista */
export function getArtista(obra: Obra): string {
  return (
    (obra.nome_do_criador as string | undefined) ||
    (obra.artista         as string | undefined) ||
    (obra.id_do_criador   as string | undefined) ||
    'Artista Desconhecido'
  );
}

/** Capa: capa_da_musica → capa → thumb → thumbnail_url */
export function getImagem(obra: Obra): string | undefined {
  return (
    (obra.capa_da_musica as string | undefined) ||
    (obra.capa          as string | undefined) ||
    (obra.thumb         as string | undefined) ||
    (obra.thumbnail_url as string | undefined) ||
    undefined
  );
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
// Obra Card — fallbacks completos + redirect via id_do_topico
// ---------------------------------------------------------------------------
function ObraCard({ obra }: { obra: Obra }) {
  const titulo  = getTitulo(obra);
  const artista = getArtista(obra);
  const imagem  = getImagem(obra);

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
            alt={titulo}
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

      {/* Info */}
      <div className="p-2">
        <p className="text-white text-xs font-semibold truncate">{titulo}</p>
        <p className="text-white/50 text-[11px] truncate">{artista}</p>
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
  const [activeTabId, setActiveTabId] = useState<Tab>('inicio');
  const [obras, setObras]             = useState<Obra[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const activeTab = TABS.find((t) => t.id === activeTabId)!;

  const loadObras = useCallback(
    (tab: TabConfig, bustCache = false) => {
      if (bustCache) memoryCache.delete(tab.id);

      setLoading(true);
      setError(null);

      fetchObras(tab)
        .then((data) => {
          setObras(data);
        })
        .catch(() => {
          setError('Erro ao carregar. Tente novamente.');
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [],
  );

  // Dispara fetch ao trocar de aba
  useEffect(() => {
    loadObras(activeTab);
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#0f1923] text-white pb-24">

      {/* Header sticky com menu de abas */}
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
            const isActive = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTabId(tab.id)}
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
            onClick={() => loadObras(activeTab, true)}
            className="px-4 py-2 rounded-full bg-white/10 text-white/70 text-sm
                       hover:bg-white/20 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Grid de obras */}
      {!loading && !error && obras.length > 0 && (
        <div className="grid grid-cols-2 gap-3 px-4 pt-4">
          {obras.map((obra) => (
            <ObraCard key={obra.id_do_topico} obra={obra} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && obras.length === 0 && (
        <EmptyState label={activeTab.label} />
      )}
    </div>
  );
}
