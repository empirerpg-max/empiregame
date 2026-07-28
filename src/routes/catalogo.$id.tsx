import { createFileRoute, useParams, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

const GAS_URL = 'https://script.google.com/macros/s/AKfycby7Epe3MHPMvje5OKtSlNn-tSWpowLPOJ7DVflFJqgZNOKCnN9IcGwWYL1QSeRtgJrQ7w/exec';

export const Route = createFileRoute('/catalogo/$id')({ component: CatalogoObraPage });

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
  telegram_file_id?: string;
}

interface Comentario {
  id_do_topico?: string | number;
  id_usuario?: string | number;
  nome_usuario?: string;
  nome_do_jogador?: string;
  texto?: string;
  comentario?: string;
  data?: string;
}

function CatalogoObraPage() {
  const { id } = useParams({ from: '/catalogo/$id' });
  const router = useRouter();

  const [obra, setObra] = useState<Obra | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoComentario, setNovoComentario] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loadingVideo, setLoadingVideo] = useState(false);

  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
  const userName = tgUser?.first_name || 'Anônimo';

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${GAS_URL}?action=getObra&id=${id}`).then((r) => r.json()),
      fetch(`${GAS_URL}?action=getComentarios&id=${id}`).then((r) => r.json()),
    ])
      .then(([obraData, comentsData]) => {
        setObra(obraData && !obraData.error ? obraData : null);
        setComentarios(Array.isArray(comentsData) ? comentsData : []);
      })
      .catch((err) => {
        console.error(err);
        setObra(null);
        setComentarios([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePlayVideo = async () => {
    if (!obra?.telegram_file_id) return;
    setLoadingVideo(true);
    try {
      const res = await fetch(
        `${GAS_URL}?action=getVideoUrl&file_id=${obra.telegram_file_id}`,
      );
      const data = await res.json();
      if (data?.url) setVideoUrl(data.url);
      else alert('Não foi possível carregar o vídeo.');
    } catch (e) {
      console.error(e);
      alert('Erro ao carregar o vídeo.');
    } finally {
      setLoadingVideo(false);
    }
  };

  const enviarComentario = () => {
    const texto = novoComentario.trim();
    if (!texto) return;

    const commentObj: Comentario = {
      id_do_topico: id,
      id_usuario: tgUser?.id || '0',
      nome_usuario: userName,
      texto,
      data: new Date().toISOString(),
    };

    // Optimistic UI
    setComentarios((prev) => [...prev, commentObj]);
    setNovoComentario('');

    fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'adicionarComentario', ...commentObj }),
    }).catch((err) => console.error('Erro ao enviar comentário:', err));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Carregando obra...</p>
        </div>
      </div>
    );
  }

  if (!obra) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] text-white flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-white/70 text-lg">Obra não encontrada.</p>
        <button
          onClick={() => router.history.back()}
          className="px-5 py-2 rounded-full bg-white text-black font-semibold text-sm"
        >
          ← Voltar
        </button>
      </div>
    );
  }

  const titulo =
    obra.nome_da_musica ||
    obra.nome_do_video ||
    obra.nome ||
    obra.titulo ||
    'Sem Título';
  const artista =
    obra.nome_do_criador ||
    obra.artista ||
    obra.id_do_criador ||
    'Desconhecido';
  const capa =
    obra.capa_da_musica || obra.capa || obra.thumb || obra.thumbnail_url;

  const listaComentarios: Comentario[] = Array.isArray(comentarios)
    ? comentarios
    : [];

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white pb-32 relative">
      {/* Botão Voltar */}
      <button
        onClick={() => router.history.back()}
        className="fixed top-4 left-4 z-40 bg-black/60 backdrop-blur-md hover:bg-black/80 p-2.5 rounded-full border border-white/10 transition-colors"
        aria-label="Voltar"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Player flutuante fixo no topo */}
      {videoUrl && (
        <div className="sticky top-0 z-50 w-full aspect-video bg-black shadow-2xl">
          <video src={videoUrl} controls autoPlay className="w-full h-full" />
          <button
            onClick={() => setVideoUrl('')}
            className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600 px-3 py-1 rounded-full text-xs font-semibold"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Header da obra */}
      <div className="relative w-full h-80 md:h-96">
        {capa ? (
          <img src={capa} alt={titulo} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/0" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1c] via-[#0a0f1c]/60 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 max-w-4xl mx-auto">
          <p className="text-xs uppercase tracking-widest text-white/50 mb-2">{artista}</p>
          <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">{titulo}</h1>

          {obra.telegram_file_id && !videoUrl && (
            <button
              onClick={handlePlayVideo}
              disabled={loadingVideo}
              className="inline-flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full font-bold text-sm hover:bg-white/90 transition-colors disabled:opacity-60"
            >
              {loadingVideo ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Assistir
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Fórum */}
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <span>Comunidade</span>
          <span className="text-xs font-normal text-white/40">
            {listaComentarios.length} {listaComentarios.length === 1 ? 'comentário' : 'comentários'}
          </span>
        </h3>

        <div className="space-y-3 mb-6">
          {listaComentarios.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8">
              Seja o primeiro a comentar nesta obra.
            </p>
          ) : (
            listaComentarios.map((c, i) => {
              const mine = String(c.id_usuario) === String(tgUser?.id);
              return (
                <div
                  key={i}
                  className={`flex flex-col p-3 rounded-2xl max-w-[85%] ${
                    mine
                      ? 'bg-blue-500 self-end ml-auto rounded-br-sm'
                      : 'bg-white/10 self-start rounded-bl-sm'
                  }`}
                >
                  <span className="text-[11px] opacity-70 mb-0.5 font-semibold">
                    {c.nome_usuario || c.nome_do_jogador || 'Anônimo'}
                  </span>
                  <p className="text-sm leading-snug">{c.texto || c.comentario}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Input fixado */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/10 p-3 z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={novoComentario}
            onChange={(e) => setNovoComentario(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enviarComentario()}
            placeholder="Deixe um comentário..."
            className="flex-1 bg-white/10 rounded-full px-4 py-2.5 outline-none text-sm placeholder:text-white/40 border border-white/10 focus:border-white/30 transition-colors"
          />
          <button
            onClick={enviarComentario}
            disabled={!novoComentario.trim()}
            className="bg-white text-black px-5 py-2.5 rounded-full font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/90 transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
