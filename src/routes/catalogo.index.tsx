// src/routes/catalogo.index.tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Home, Music, Disc3, Clapperboard, Video, MessagesSquare } from 'lucide-react';

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export const Route = createFileRoute('/catalogo/')({ component: CatalogoPage });

// ---------------------------------------------------------------------------
// Telegram silent auth
// ---------------------------------------------------------------------------
function useTelegramUser() {
  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  return { id: tgUser?.id ?? 0, name: tgUser?.first_name ?? 'Anônimo' };
}

// ---------------------------------------------------------------------------
// Interface — reflete as chaves snake_case da API do Google Apps Script
// ---------------------------------------------------------------------------
export interface ObraAPI {
  // Chave primária — OBRIGATÓRIA para o clique
  id_do_topico: string;

  // Título (fallbacks lógicos)
  nome?: string;
  titulo?: string;

  // Artista / Criador (fallbacks lógicos)
  nome_do_criador?: string;
  artista?: string;

  // Capa (fallbacks lógicos)
  capa?: string;
  thumb?: string;
  thumbnail_url?: string;

  // Campos extras (não obrigatórios no catálogo)
  streams?: number;
  tipo?: string;
  [key: string]: unknown; // tolera campos extras sem quebrar a tipagem
}

// ---------------------------------------------------------------------------
// Helpers para extrair os campos com fallback lógico
// ---------------------------------------------------------------------------
const getTitle  = (item: ObraAPI) => item.nome || item.titulo || 'Sem Título';
const getArtist = (item: ObraAPI) => item.nome_do_criador || item.artista || 'Desconhecido';
const getCover  = (item: ObraAPI) =>
  item.capa || item.thumb || item.thumbnail_url || '';

// ---------------------------------------------------------------------------
// Abas do menu superior
// ---------------------------------------------------------------------------
type Tab = 'inicio' | 'musicas' | 'albuns' | 'clipes' | 'videos' | 'forum';

interface TabConfig {
  id: Tab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  action: string; // parâmetro enviado à API: ?action=<action>
}

const TABS: TabConfig[] = [
  { id: 'inicio',  label: 'Início',  icon: Home,           action: 'inicio'  },
  { id: 'musicas', label: 'Músicas', icon: Music,          action: 'musicas' },
  { id: 'albuns',  label: 'Álbuns',  icon: Disc3,          action: 'albuns'  },
  { id: 'clipes',  label: 'Clipes',  icon: Clapperboard,   action: 'clipes'  },
  { id: 'videos',  label: 'Vídeos',  icon: Video,          action: 'videos'  },
  { id: 'forum',   label: 'Fórum',   icon: MessagesSquare, action: 'forum'   },
];

// ---------------------------------------------------------------------------
// URL base da API do Google Apps Script
// Defina VITE_GAS_API_URL no seu .env com a URL do Web App publicado.
// ---------------------------------------------------------------------------
const GAS_BASE_URL =
  (import.meta.env.VITE_GAS_API_URL as string | undefined) ??
  'https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec';

// ---------------------------------------------------------------------------
// Cache em memória (Map<action, ObraAPI[]>)
// Evita re-fetch enquanto a página estiver montada.
// Se SWR já estiver instalado, substitua pelo hook:
//   const { data, isLoading } = useSWR(`${GAS_BASE_URL}?action=${activeTab}`, fetcher);
// ---------------------------------------------------------------------------
const memoryCache = new Map<string, ObraAPI[]>();

async function fetchByAction(action: string): Promise<ObraAPI[]> {
  if (memoryCache.has(action)) return memoryCache.get(action)!;

  const res = await fetch(`${GAS_BASE_URL}?action=${action}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  // A API pode retornar { data: [...] } ou diretamente um array
  const items: ObraAPI[] = Array.isArray(json) ? json : (json?.data ?? []);
  memoryCache.set(action, items);
  return items;
}

// ---------------------------------------------------------------------------
// Skeleton Card (estado de carregamento)
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
// Obra Card
// ---------------------------------------------------------------------------
function ObraCard({ obra }: { obra: ObraAPI }) {
  const title  = getTitle(obra);
  const artist = getArtist(obra);
  const cover  = getCover(obra);

  return (
    <Link
      to="/catalogo/$id"
      params={{ id: obra.id_do_topico }}
      className="group relative bg-[#1e2736] rounded-2xl overflow-hidden shadow-lg
                 hover:scale-[1.02] active:scale-[0.98] transition-transform"
    >
      {/* Capa */}
      <div className="aspect-square relative overflow-hidden bg-white/5">
        {cover ? (
          <img
            src={cover}
            alt={title}
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
        <p className="text-white text-xs font-semibold truncate">{title}</p>
        <p className="text-white/50 text-[11px] truncate">{artist}</p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ tab }: { tab: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-3">
      <Disc3 size={40} className="text-white/20" />
      <p className="text-white/40 text-sm">
        Nenhum conteúdo encontrado em{' '}
        <span className="text-white/60 font-medium">{tab}</span>.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function CatalogoPage() {
  const user = useTelegramUser();
  const [activeTab, setActiveTab] = useState<Tab>('inicio');
  const [obras, setObras] = useState<ObraAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Referência para abortar fetch anterior se o usuário trocar de aba rápido
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    (window as any).Telegram?.WebApp?.ready();
  }, []);

  // Dispara fetch ao trocar de aba
  useEffect(() => {
    const tabConfig = TABS.find((t) => t.id === activeTab)!;

    // Fórum não exige listagem de obras — renderiza tela diferente
    if (activeTab === 'forum') {
      setObras([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Cancela fetch anterior se ainda estiver em voo
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    fetchByAction(tabConfig.action)
      .then((data) => {
        setObras(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
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

        {/* Linha do usuário */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h1 className="text-lg font-bold leading-tight">Catálogo</h1>
            <p className="text-white/40 text-[11px]">Olá, {user.name} 👋</p>
          </div>
        </div>

        {/* Menu de abas */}
        <div
          className="flex overflow-x-auto scrollbar-none gap-1 px-3 pb-3"
          role="tablist"
          aria-label="Categorias do catálogo"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
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
      {/* Conteúdo da aba                                                      */}
      {/* ------------------------------------------------------------------ */}

      {/* Aba Fórum — renderização especial */}
      {activeTab === 'forum' && (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-4">
          <MessagesSquare size={48} className="text-[#2AABEE]/60" />
          <div>
            <p className="text-white font-semibold text-base">Fórum da Comunidade</p>
            <p className="text-white/40 text-sm mt-1">
              Selecione uma obra no catálogo para acessar o fórum dela.
            </p>
          </div>
        </div>
      )}

      {/* Demais abas */}
      {activeTab !== 'forum' && (
        <>
          {/* Loading: skeletons */}
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
                  // Limpa o cache da aba atual para forçar novo fetch
                  const tabConfig = TABS.find((t) => t.id === activeTab)!;
                  memoryCache.delete(tabConfig.action);
                  setActiveTab((prev) => {
                    // Força re-trigger do useEffect mantendo a aba atual
                    setError(null);
                    setLoading(true);
                    fetchByAction(tabConfig.action)
                      .then(setObras)
                      .catch(() => setError('Erro ao carregar. Tente novamente.'))
                      .finally(() => setLoading(false));
                    return prev;
                  });
                }}
                className="text-[#2AABEE] text-sm underline underline-offset-2"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Vazio */}
          {!loading && !error && obras.length === 0 && (
            <EmptyState tab={activeTabConfig.label} />
          )}

          {/* Grid de obras */}
          {!loading && !error && obras.length > 0 && (
            <div className="grid grid-cols-2 gap-3 px-4 pt-4">
              {obras.map((obra) => (
                <ObraCard key={obra.id_do_topico} obra={obra} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
