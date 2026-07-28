import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

const GAS_URL = 'https://script.google.com/macros/s/AKfycby7Epe3MHPMvje5OKtSlNn-tSWpowLPOJ7DVflFJqgZNOKCnN9IcGwWYL1QSeRtgJrQ7w/exec';

export const Route = createFileRoute('/catalogo/')({ component: CatalogoPage });

interface Obra {
  id_do_topico?: string | number;
  telegram_topic_id?: string | number;
  nome_da_musica?: string;
  nome_do_video?: string;
  nome?: string;
  titulo?: string;
  nome_do_criador?: string;
  artista?: string;
  id_do_criador?: string;
  capa_da_musica?: string;
  capa?: string;
  thumb?: string;
  thumbnail_url?: string;
}

type MenuItem = { label: string; action: string; isForum?: boolean };

const MENUS: MenuItem[] = [
  { label: 'Início', action: 'top50spotify' },
  { label: 'Músicas', action: 'musicas' },
  { label: 'Álbuns', action: 'albuns' },
  { label: 'Clipes', action: 'music_videos' },
  { label: 'Vídeos', action: 'videos' },
  { label: 'Fórum', action: '__forum__', isForum: true },
];

const FORUM_SUBS: MenuItem[] = [
  { label: 'Músicas', action: 'musicas' },
  { label: 'Álbuns', action: 'albuns' },
  { label: 'Clipes', action: 'music_videos' },
  { label: 'Vídeos', action: 'videos' },
];

function getTitulo(o: Obra) {
  return o.nome_da_musica || o.nome_do_video || o.nome || o.titulo || 'Sem Título';
}
function getArtista(o: Obra) {
  return o.nome_do_criador || o.artista || o.id_do_criador || 'Desconhecido';
}
function getCapa(o: Obra) {
  return o.capa_da_musica || o.capa || o.thumb || o.thumbnail_url;
}
function getId(o: Obra, i: number) {
  return String(o.id_do_topico || o.telegram_topic_id || i);
}

function CatalogoPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<MenuItem>(MENUS[0]);
  const [forumSub, setForumSub] = useState<MenuItem>(FORUM_SUBS[0]);

  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  const userName = tgUser?.first_name || 'Jogador';

  const isForumMode = abaAtiva.isForum;
  const activeAction = isForumMode ? forumSub.action : abaAtiva.action;

  useEffect(() => {
    (window as any).Telegram?.WebApp?.ready?.();
    setLoading(true);
    setObras([]);

    fetch(`${GAS_URL}?action=${activeAction}`)
      .then((r) => r.json())
      .then((data) => {
        setObras(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error(err);
        setObras([]);
      })
      .finally(() => setLoading(false));
  }, [activeAction]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1c] via-[#0f172a] to-[#0a0f1c] text-white pb-24">
      <div className="px-4 pt-6 pb-4 max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Empire Play
          </h1>
          <span className="text-xs text-white/50">Olá, {userName}</span>
        </div>
        <p className="text-sm text-white/40 mt-1">
          {isForumMode
            ? 'Entre nas discussões da comunidade.'
            : 'Descubra músicas, álbuns e vídeos da comunidade.'}
        </p>
      </div>

      {/* Menu principal */}
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

        {/* Sub-menu do Fórum */}
        {isForumMode && (
          <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide border-t border-white/5 pt-3">
            <span className="flex-shrink-0 text-xs uppercase tracking-widest text-white/40 self-center mr-2">
              Categoria:
            </span>
            {FORUM_SUBS.map((sub) => {
              const active = forumSub.action === sub.action;
              return (
                <button
                  key={sub.action}
                  onClick={() => setForumSub(sub)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    active
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6">
        {loading ? (
          isForumMode ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          )
        ) : obras.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <p className="text-lg">Nenhum conteúdo encontrado</p>
            <p className="text-sm mt-1">Tente outra aba</p>
          </div>
        ) : isForumMode ? (
          // ===== VISUAL DE TÓPICOS DE DISCUSSÃO =====
          <div className="space-y-3">
            {obras.map((obra, i) => {
              const id = getId(obra, i);
              const titulo = getTitulo(obra);
              const artista = getArtista(obra);
              const capa = getCapa(obra);
              return (
                <Link
                  key={id + i}
                  to="/catalogo/$id"
                  params={{ id }}
                  className="group flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-400/50 hover:bg-white/10 transition-all"
                >
                  <div className="relative w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded-xl overflow-hidden bg-white/5">
                    {capa ? (
                      <img
                        src={capa}
                        alt={titulo}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px]">
                        Sem Capa
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-widest text-white/40 mb-0.5">
                      {artista}
                    </p>
                    <h3 className="font-bold text-base md:text-lg truncate">{titulo}</h3>
                    <p className="text-xs text-white/40 mt-0.5">Discussão aberta</p>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-blue-500 text-white text-xs font-bold group-hover:bg-blue-400 transition-colors">
                    Entrar
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          // ===== GRID DE CATÁLOGO =====
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {obras.map((obra, i) => {
              const id = getId(obra, i);
              const titulo = getTitulo(obra);
              const artista = getArtista(obra);
              const capa = getCapa(obra);

              return (
                <Link
                  key={id + i}
                  to="/catalogo/$id"
                  params={{ id }}
                  className="group relative rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/30 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50"
                >
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
