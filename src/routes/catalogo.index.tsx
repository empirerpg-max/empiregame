import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

// COLE A NOVA URL AQUI EMBAIXO:
const GAS_URL = 'https://script.google.com/macros/s/AKfycby7Epe3MHPMvje5OKtSlNn-tSWpowLPOJ7DVflFJqgZNOKCnN9IcGwWYL1QSeRtgJrQ7w/exec';

export const Route = createFileRoute('/catalogo/')({ component: CatalogoPage });

const MENUS = [
  { label: 'Início', action: 'top50spotify' },
  { label: 'Músicas', action: 'musicas' },
  { label: 'Álbuns', action: 'albuns' },
  { label: 'Clipes', action: 'music_videos' },
  { label: 'Vídeos', action: 'videos' }
];

export default function CatalogoPage() {
  const [obras, setObras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState(MENUS);
  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  const userName = tgUser?.first_name || 'Jogador';

  useEffect(() => {
    (window as any).Telegram?.WebApp?.ready();
    setLoading(true);
    setObras([]);
    
    fetch(`${GAS_URL}?action=${abaAtiva.action}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setObras(data);
        else setObras([]);
      })
      .catch((err) => {
        console.error(err);
        setObras([]);
      })
      .finally(() => setLoading(false));
  }, [abaAtiva]);

  return (
    <div className="p-4 text-white min-h-screen pb-24">
      <h1 className="text-2xl font-bold mb-4">Empire Play</h1>
      <p className="text-sm text-gray-400 mb-6">Olá, {userName}!</p>

      {/* Navegação de Abas */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
        {MENUS.map((menu) => (
          <button
            key={menu.label}
            onClick={() => setAbaAtiva(menu)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              abaAtiva.action === menu.action ? 'bg-[#2AABEE] text-white' : 'bg-white/10 text-white/60'
            }`}
          >
            {menu.label}
          </button>
        ))}
      </div>

      {/* Grid de Cards */}
      {loading ? (
        <div className="text-center mt-10 text-gray-400">Carregando catálogo...</div>
      ) : obras.length === 0 ? (
        <div className="text-center mt-10 text-gray-400">Nenhum conteúdo encontrado.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {obras.map((obra, i) => {
            const id = obra.id_do_topico || obra.telegram_topic_id || i;
            const titulo = obra.nome_da_musica || obra.nome_do_video || obra.nome || obra.titulo || 'Sem Título';
            const artista = obra.nome_do_criador || obra.artista || obra.id_do_criador || 'Desconhecido';
            const capa = obra.capa_da_musica || obra.capa || obra.thumb || obra.thumbnail_url;

            return (
              <Link
                key={id}
                to={`/catalogo/${id}`}
                className="group relative bg-[#1e2736] rounded-xl overflow-hidden shadow-lg hover:scale-105 transition-transform flex flex-col"
              >
                {capa ? (
                  <img src={capa} alt={titulo} className="w-full aspect-square object-cover" loading="lazy" />
                ) : (
                  <div className="w-full aspect-square bg-gray-800 flex items-center justify-center text-xs text-gray-500">Sem Capa</div>
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
