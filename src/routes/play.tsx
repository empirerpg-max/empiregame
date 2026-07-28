import { createFileRoute, Outlet, Link, useRouterState } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AudioPlayer, { type NowPlaying } from '@/components/AudioPlayer';
import { ChevronRight } from 'lucide-react';

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
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
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

  // Detecta se a nav tem overflow horizontal e mostra indicador
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const check = () => setShowScrollHint(el.scrollWidth > el.clientWidth + 4);
    check();
    window.addEventListener('resize', check);
    el.addEventListener('scroll', () => {
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      setShowScrollHint(!atEnd);
    });
    return () => window.removeEventListener('resize', check);
  }, []);

  const isActive = (to: string) => {
    if (to === '/play') return currentPath === '/play' || currentPath === '/play/';
    return currentPath.startsWith(to);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0f172a] text-white">
      {/* ── Navbar Superior ── */}
      <header className="sticky top-0 z-50 bg-[#0a0f1e]/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 h-14 gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[#2AABEE] text-xl">▶</span>
            <span className="font-bold text-base tracking-tight">Empire Play</span>
          </div>

          {/* Nav scrollável com indicador de seta */}
          <div className="relative flex-1 min-w-0">
            <div
              ref={navRef}
              className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-1"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
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
            </div>
            {/* Indicador de scroll */}
            {showScrollHint && (
              <div className="absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-[#0a0f1e] to-transparent flex items-center justify-end pointer-events-none">
                <ChevronRight className="size-4 text-white/40 animate-pulse" />
              </div>
            )}
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-[#2AABEE]/20 border border-[#2AABEE]/40 flex items-center justify-center text-xs font-bold text-[#2AABEE]">
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* ── Conteúdo da sub-rota ── */}
      <main className="flex-1">
        <PlayContext.Provider value={{ setNowPlaying }}>
          <Outlet />
        </PlayContext.Provider>
      </main>

      {/* ── Player fixo de rodapé ── */}
      <AudioPlayer track={nowPlaying} onClose={() => setNowPlaying(null)} />
    </div>
  );
}

import { createContext, useContext } from 'react';

interface PlayContextValue {
  setNowPlaying: (track: NowPlaying | null) => void;
}

export const PlayContext = createContext<PlayContextValue>({
  setNowPlaying: () => {},
});

export function usePlay() {
  return useContext(PlayContext);
}
