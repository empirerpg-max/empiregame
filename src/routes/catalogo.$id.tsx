import { createFileRoute, useParams, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

// ⚠️ COLE A SUA URL DO GOOGLE APPS SCRIPT AQUI DENTRO DAS ASPAS:
const GAS_URL = 'https://script.google.com/macros/s/AKfycby7Epe3MHPMvje5OKtSlNn-tSWpowLPOJ7DVflFJqgZNOKCnN9IcGwWYL1QSeRtgJrQ7w/exec';

export const Route = createFileRoute('/catalogo/$id')({ component: CatalogoObraPage });

export default function CatalogoObraPage() {
  const { id } = useParams({ from: '/catalogo/$id' });
  const router = useRouter();
  
  const [obra, setObra] = useState<any>(null);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoComentario, setNovoComentario] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loadingVideo, setLoadingVideo] = useState(false);

  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;

  useEffect(() => {
    Promise.all([
      fetch(`${GAS_URL}?action=getObra&id=${id}`).then(r => r.json()),
      fetch(`${GAS_URL}?action=getComentarios&id=${id}`).then(r => r.json())
    ])
    .then(([obraData, comentsData]) => {
      setObra(obraData.error ? null : obraData);
      setComentarios(Array.isArray(comentsData) ? comentsData : []);
    })
    .finally(() => setLoading(false));
  }, [id]);

  const handlePlayVideo = async () => {
    if (!obra?.telegram_file_id) return;
    setLoadingVideo(true);
    try {
      const res = await fetch(`${GAS_URL}?action=getVideoUrl&file_id=${obra.telegram_file_id}`);
      const data = await res.json();
      if (data.url) setVideoUrl(data.url);
    } catch (e) {
      alert("Erro ao carregar o vídeo.");
    } finally {
      setLoadingVideo(false);
    }
  };

  const enviarComentario = () => {
    if (!novoComentario.trim()) return;
    const commentObj = {
      id_do_topico: id,
      id_usuario: tgUser?.id || '0',
      nome_usuario: tgUser?.first_name || 'Anônimo',
      texto: novoComentario,
      data: new Date().toISOString()
    };
    
    // Mutação Otimista
    setComentarios([...comentarios, commentObj]);
    setNovoComentario('');

    fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'adicionarComentario', ...commentObj })
    });
  };

  if (loading) return <div className="p-10 text-white text-center">Carregando a obra...</div>;
  if (!obra) return <div className="p-10 text-white text-center">Obra não encontrada. <button onClick={() => router.history.back()} className="text-blue-400 block mt-4">Voltar</button></div>;

  const titulo = obra.nome_da_musica || obra.nome_do_video || obra.nome || obra.titulo || 'Sem Título';
  const artista = obra.nome_do_criador || obra.artista || obra.id_do_criador || 'Desconhecido';
  const capa = obra.capa_da_musica || obra.capa || obra.thumb || obra.thumbnail_url;

  return (
    <div className="bg-[#0f172a] min-h-screen text-white pb-24 relative">
      <button onClick={() => router.history.back()} className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded-full text-sm">
        ← Voltar
      </button>

      {/* Destaque Superior */}
      <div className="relative w-full h-72 md:h-96">
        {capa ? <img src={capa} className="w-full h-full object-cover opacity-60" /> : <div className="w-full h-full bg-gray-800" />}
        <div className="absolute bottom-0 left-0 p-6 bg-gradient-to-t from-[#0f172a] w-full">
          <h1 className="text-3xl font-bold">{titulo}</h1>
          <p className="text-lg text-gray-300">{artista}</p>
          
          {obra.telegram_file_id && !videoUrl && (
            <button onClick={handlePlayVideo} disabled={loadingVideo} className="mt-4 bg-[#2AABEE] px-6 py-2 rounded-full font-bold">
              {loadingVideo ? 'Carregando Mídia...' : '▶ Assistir'}
            </button>
          )}
        </div>
      </div>

      {/* Player Flutuante do Telegram */}
      {videoUrl && (
        <div className="w-full aspect-video bg-black sticky top-0 z-50 shadow-2xl">
          <video src={videoUrl} controls autoPlay className="w-full h-full" />
          <button onClick={() => setVideoUrl('')} className="absolute top-2 right-2 bg-red-500/80 px-3 py-1 rounded text-sm">Fechar Player</button>
        </div>
      )}

      {/* Fórum (Comunidade) */}
      <div className="p-4 max-w-2xl mx-auto">
        <h3 className="font-bold text-xl mb-4 border-b border-gray-700 pb-2">Comunidade</h3>
        
        <div className="space-y-4 mb-20">
          {comentarios.length === 0 ? <p className="text-gray-500">Seja o primeiro a comentar!</p> :
            comentarios.map((c, i) => (
              <div key={i} className={`flex flex-col p-3 rounded-xl max-w-[85%] ${c.id_usuario === tgUser?.id ? 'bg-[#2AABEE] self-end ml-auto' : 'bg-gray-800 self-start'}`}>
                <span className="text-xs opacity-70 mb-1">{c.nome_usuario || c.nome_do_jogador}</span>
                <p className="text-sm">{c.texto || c.comentario}</p>
              </div>
            ))
          }
        </div>

        {/* Campo de Comentário */}
        <div className="fixed bottom-0 left-0 w-full bg-[#1e2736] p-3 flex items-center gap-2 border-t border-gray-700 z-40">
          <input 
            type="text" 
            value={novoComentario} 
            onChange={(e) => setNovoComentario(e.target.value)}
            placeholder="Deixe um comentário..." 
            className="flex-1 bg-black/40 rounded-full px-4 py-2 outline-none text-sm"
          />
          <button onClick={enviarComentario} className="bg-[#2AABEE] text-white px-4 py-2 rounded-full font-bold">Enviar</button>
        </div>
      </div>
    </div>
  );
}
