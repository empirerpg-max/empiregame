import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

const GAS_URL =
  'https://script.google.com/macros/s/AKfycby7Epe3MHPMvje5OKtSlNn-tSWpowLPOJ7DVflFJqgZNOKCnN9IcGwWYL1QSeRtgJrQ7w/exec';

export const Route = createFileRoute('/catalogo/')({ component: CatalogoPage });

// ─── Tipagem exata dos campos retornados pela API (snake_case do GAS) ──────────
interface Obra {
  // IDs de navegação
  id_do_topico?: string | number;
  telegram_topic_id?: string | number;
  // Título – fallbacks em ordem de prioridade
  nome_da_musica?: string;
  nome_do_video?: string;
  nome?: string;
  titulo?: string;
  // Artista / criador – fallbacks em ordem de prioridade
  nome_do_criador?: string;
  artista?: string;
  id_do_criador?: string;
  // Capa – fallbacks em ordem de prioridade
  capa_da_musica?: string;
  capa?: string;
  thumb?: string;
  thumbnail_url?: string;
}

// ─── Menu de abas conforme especificação ──────────────────────────────────────
type MenuItem = { label: string; action: string };

const MENUS: MenuItem[] = [
  { label: 'Início',   action: 'top50spotify' },
  { label: 'Músicas',  action: 'musicas'       },
  { label: 'Álbuns',   action: 'albuns'        },
  { label: 'Clipes',   action: 'music_videos'  },
  { label: 'Vídeos',   action: 'videos'        },
];

// ─── Helpers de mapeamento (fallbacks obrigatórios) ───────────────────────────
function getTitulo(o: Obra): string {
  return o.nome_da_musica || o.nome_do_video || o.nome || o.titulo || 'Sem Título';
}

function getArtista(o: Obra): string {
  return o.nome_do_criador || o.artista || o.id_do_criador || 'Desconhecido';
}

function getCapa(o: Obra): string | undefined {
  return o.capa_da_musica || o.capa || o.thumb || o.thumbnail_url;
}

function getRedirectId(o: Obra, fallbackIndex: number): string {
  return String(o.id_do_topico || o.telegram_topic_id || fallbackIndex);
}

// ─── Componente principal ─────────────────────────────────────────────────────
function CatalogoPage() {
  const [obras, setObras]       = useState<Obra[]>([]);
  const [loading, setLoading]   = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<MenuItem>(MENUS[0]);

  // Nome do usuário Telegram (MiniApp)
  const tgUser   = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  const userName = tgUser?.first_name || 'Jogador';

  // Busca dados da API GAS sempre que a aba muda
  useEffect(() => {
    (window as any).Telegram?.WebApp?.ready?.();

    setLoading(true);
    setObras([]);

    fetch(`${GAS_URL}?action=${abaAtiva.action}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        setObras(Array.isArray(data) ? (data as Obra[]) : []);
      })
      .catch((err: unknown) => {
        console.error('[Catálogo] Erro ao buscar dados:', err);
        setObras([]);
      })
      .finally(() => setLoading(false));
  }, [abaAtiva.action]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1c] via-[#0f172a] to-[#0a0f1c] text-white pb-24">

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-6 pb-4 max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Empire Play
          </h1>
          <span className="text-xs text-white/50">Olá, {userName}</span>
        </div>
        <p className="text-sm text-white/40 mt-1">
          Descubra músicas, álbuns e vídeos da comunidade.
        </p>
      </div>

      {/* ── Menu de abas ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-[#0a0f1c]/70 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {MENUS.map((menu) => {
            const active = abaAtiva.action === menu.action;
            return (
              <button
                key={menu.action}
                onClick={() => setAbaAtiva(menu)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  active
                    ? 'bg-white text-black shadow-lg shadow-white/10'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                }`}
              >
                {menu.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Conteúdo ──────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 pt-6">

        {/* Estado: carregando */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* Estado: vazio */}
        {!loading && obras.length === 0 && (
          <div className="text-center py-20 text-white/40">
            <p className="text-lg">Nenhum conteúdo encontrado</p>
            <p className="text-sm mt-1">Tente outra aba</p>
          </div>
        )}

        {/* Estado: grid de cards */}
        {!loading && obras.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {obras.map((obra, i) => {
              const id     = getRedirectId(obra, i);
              const titulo = getTitulo(obra);
              const artista = getArtista(obra);
              const capa   = getCapa(obra);

              return (
                <Link
                  key={`${id}-${i}`}
                  to="/catalogo/$id"
                  params={{ id }}
                  className="group relative rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/30 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50"
                >
                  {/* Capa */}
                  <div className="relative aspect-square overflow-hidden">
                    {capa ? (
                      <img
                        src={capa}
                        alt={titulo}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/0 flex items-center justify-center text-white/30 text-xs">
                        Sem Capa
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="font-bold text-sm truncate">{titulo}</h3>
                    <p className="text-xs text-white/50 truncate mt-0.5">{artista}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
