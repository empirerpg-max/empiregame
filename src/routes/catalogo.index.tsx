import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// O frontend NÃO chama o GAS diretamente. Todas as requisições passam pelo
// Cloudflare Worker em /api/catalogo, que faz o proxy para o GAS.
// ──────────────────────────────────────────────────────────────────────────────
export const Route = createFileRoute('/catalogo/')({ component: CatalogoPage });

const MENUS = [
  { label: 'Início',  action: 'top50spotify', isForum: false },
  { label: 'Músicas', action: 'musicas',       isForum: false },
  { label: 'Álbuns',  action: 'albuns',        isForum: false },
  { label: 'Clipes',  action: 'music_videos',  isForum: false },
  { label: 'Vídeos',  action: 'videos',        isForum: false },
  { label: 'Fórum',   action: 'forum',         isForum: true  },
];

const FORUM_SUBMENUS = [
  { label: 'Músicas', action: 'musicas'      },
  { label: 'Álbuns',  action: 'albuns'       },
  { label: 'Clipes',  action: 'music_videos' },
  { label: 'Vídeos',  action: 'videos'       },
];

export default function CatalogoPage() {
  const [obras, setObras]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [abaAtiva, setAbaAtiva] = useState(MENUS[0]);
  const [forumSub, setForumSub] = useState(FORUM_SUBMENUS[0]);

  const tgUser   = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  const userName = tgUser?.first_name || 'Jogador';

  // Determina qual action usar: se for fórum usa o submenu, senão usa a aba principal
  const fetchAction = abaAtiva.isForum ? forumSub.action : abaAtiva.action;

  useEffect(() => {
    (window as any).Telegram?.WebApp?.ready();
    setLoading(true);
    setObras([]);

    // ✅ Chama o WORKER, não o GAS diretamente → evita CORS
    fetch(`/api/catalogo?action=${fetchAction}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setObras(data);
        else setObras([]);
      })
      .catch((err) => console.error('[Catálogo] Erro no fetch:', err))
      .finally(() => setLoading(false));
  }, [fetchAction]);

  return (
    <div className="p-4 bg-[#0f172a] text-white min-h-screen pb-24">
      <h1 className="text-2xl font-bold mb-2">Empire Play</h1>
      <p className="text-sm text-gray-400 mb-6">Olá, {userName}!</p>

      {/* ── Menu Principal ── */}
      <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
        {MENUS.map((menu) => (
          <button
            key={menu.label}
            onClick={() => setAbaAtiva(menu)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              abaAtiva.label === menu.label
                ? 'bg-[#2AABEE] text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            {menu.label}
          </button>
        ))}
      </div>

      {/* ── Submenu do Fórum ── */}
      {abaAtiva.isForum && (
        <div className="flex gap-2 overflow-x-auto pb-4 mt-3 scrollbar-hide">
          {FORUM_SUBMENUS.map((sub) => (
            <button
              key={sub.label}
              onClick={() => setForumSub(sub)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                forumSub.action === sub.action
                  ? 'border-[#2AABEE] text-[#2AABEE]'
                  : 'border-white/20 text-white/50 hover:border-white/40'
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Grid de Cards ── */}
      {loading ? (
        <div className="text-center mt-10 text-gray-400">Carregando catálogo...</div>
      ) : obras.length === 0 ? (
        <div className="text-center mt-10 text-gray-400">Nenhum conteúdo encontrado.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {obras.map((obra, i) => {
            // ── Mapeamento robusto com fallbacks (chaves variam por aba) ──────
            const id      = obra.id_do_topico || obra.telegram_topic_id || String(i);
            const titulo  = obra.nome_da_musica || obra.nome_do_video || obra.nome || obra.titulo || 'Sem Título';
            const artista = obra.nome_do_criador || obra.artista || obra.id_do_criador || 'Desconhecido';
            const capa    = obra.capa_da_musica || obra.capa || obra.thumb || obra.thumbnail_url;

            return (
              <Link
                key={`${id}-${i}`}
                to={`/catalogo/${id}`}
                className="group relative bg-[#1e2736] rounded-xl overflow-hidden shadow-lg hover:scale-105 transition-transform flex flex-col"
              >
                {capa ? (
                  <img
                    src={capa}
                    alt={titulo}
                    className="w-full aspect-square object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full aspect-square bg-gray-800 flex items-center justify-center text-4xl">
                    🎵
                  </div>
                )}
                <div className="p-3">
                  <h3 className="font-bold text-sm truncate">{titulo}</h3>
                  <p className="text-xs text-gray-400 truncate mt-1">{artista}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
