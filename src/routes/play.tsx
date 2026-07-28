import { createFileRoute, Outlet, Link, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/play')({ component: PlayLayout });

const NAV_ITEMS = [
  { label: 'Início',        to: '/play'         },
  { label: 'Músicas',       to: '/play/musicas'  },
  { label: 'Vídeos',        to: '/play/videos'   },
  { label: 'Music Videos',  to: '/play/mvs'      },
  { label: 'Álbuns',        to: '/play/albuns'   },
  { label: 'Fórum',         to: '/play/forum'    },
];

export default function PlayLayout() {
  const [userName, setUserName] = useState<string>('Jogador');
  const { location } = useRouterState();
  const currentPath = location.pathname;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const name =
          session.user.user_metadata?.name ||
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          'Jogador';
        setUserName(name);
      }
    });
  }, []);

  const isActive = (to: string) => {
    if (to === '/play') return currentPath === '/play' || currentPath === '/play/';
    return currentPath.startsWith(to);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0f172a] text-white">
      {/* ── Navbar Superior estilo Spotify ── */}
      <header className="sticky top-0 z-50 bg-[#0a0f1e]/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[#2AABEE] text-xl">▶</span>
            <span className="font-bold text-base tracking-tight">Empire Play</span>
          </div>

          {/* Menu de navegação */}
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  isActive(item.to)
                    ? 'bg-[#2AABEE] text-white shadow-md'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Avatar / Nome do jogador */}
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <div className="w-7 h-7 rounded-full bg-[#2AABEE]/20 border border-[#2AABEE]/40 flex items-center justify-center text-xs font-bold text-[#2AABEE]">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-white/70 hidden sm:block max-w-[100px] truncate">{userName}</span>
          </div>
        </div>
      </header>

      {/* ── Conteúdo da sub-rota ── */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
