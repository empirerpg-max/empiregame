import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ContentGrid } from './play.index';

export const Route = createFileRoute('/play/forum')({ component: PlayForum });

const FORUM_TABS = [
  { label: 'Músicas',       action: 'musicas'      },
  { label: 'Álbuns',        action: 'albuns'       },
  { label: 'Music Videos',  action: 'music_videos' },
  { label: 'Vídeos',        action: 'videos'       },
];

export default function PlayForum() {
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(FORUM_TABS[0]);

  useEffect(() => {
    setLoading(true);
    setObras([]);
    fetch(`/api/catalogo?action=${tab.action}`)
      .then((r) => r.json())
      .then((data) => setObras(Array.isArray(data) ? data : []))
      .catch((err) => console.error('[Play/Forum] Erro:', err))
      .finally(() => setLoading(false));
  }, [tab.action]);

  return (
    <div className="p-4 pb-24">
      <h2 className="text-xl font-bold mb-4">💬 Fórum</h2>

      {/* Sub-tabs do Fórum */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {FORUM_TABS.map((t) => (
          <button
            key={t.action}
            onClick={() => setTab(t)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              tab.action === t.action
                ? 'bg-[#2AABEE] border-[#2AABEE] text-white'
                : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ContentGrid obras={obras} loading={loading} emptyLabel="Nenhum tópico no fórum encontrado." />
    </div>
  );
}
