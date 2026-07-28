import { createFileRoute, useParams, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

const GAS_URL =
  'https://script.google.com/macros/s/AKfycby7Epe3MHPMvje5OKtSlNn-tSWpowLPOJ7DVflFJqgZNOKCnN9IcGwWYL1QSeRtgJrQ7w/exec';

export const Route = createFileRoute('/catalogo/$id')({
  component: CatalogoObraPage,
});

/* ─── Tipos ─────────────────────────────────────────────────────────────── */
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
  _optimistic?: boolean;
}

/* ─── Helpers de UI ──────────────────────────────────────────────────────── */
function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/10 ${className ?? ''}`}
    />
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Voltar"
      className="fixed top-4 left-4 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:bg-black/80 active:scale-95 transition-all"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}

/* ─── Componente Principal ───────────────────────────────────────────────── */
function CatalogoObraPage() {
  const { id } = useParams({ from: '/catalogo/$id' });
  const router = useRouter();

  const [obra, setObra] = useState<Obra | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  const [videoUrl, setVideoUrl] = useState('');
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [erroVideo, setErroVideo] = useState('');
  const videoRef = useRef<HTMLDivElement>(null);

  const [novoComentario, setNovoComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const comentariosEndRef = useRef<HTMLDivElement>(null);

  /* Captura nativa do usuário Telegram */
  const tgUser = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { first_name?: string; id?: number } } } } })
    .Telegram?.WebApp?.initDataUnsafe?.user;
  const userName = tgUser?.first_name || 'Anônimo';

  /* ── Fetch Duplo ─────────────────────────────────────────────────────── */
  useEffect(() => {
    setLoading(true);
    setErro(false);

    Promise.all([
      fetch(`${GAS_URL}?action=getObra&id=${id}`).then((r) => r.json()),
      fetch(`${GAS_URL}?action=getComentarios&id=${id}`).then((r) => r.json()),
    ])
      .then(([obraData, comentsData]) => {
        setObra(obraData && !obraData.error ? obraData : null);
        /* Trava de Segurança Obrigatória */
        const listaComentarios = Array.isArray(comentsData) ? comentsData : [];
        setComentarios(listaComentarios);
      })
      .catch((err) => {
        console.error('[catalogo.$id] fetch error:', err);
        setErro(true);
        setObra(null);
        setComentarios([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  /* ── MiniPlayer: busca URL do vídeo via Telegram file_id ─────────────── */
  const handlePlayVideo = async () => {
    if (!obra?.telegram_file_id) return;
    setLoadingVideo(true);
    setErroVideo('');

    try {
      const res = await fetch(
        `${GAS_URL}?action=getVideoUrl&file_id=${obra.telegram_file_id}`,
      );
      const dados = await res.json();

      if (dados?.url) {
        setVideoUrl(dados.url);
        /* Scroll suave até o player */
        setTimeout(() => {
          videoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        setErroVideo('Não foi possível carregar o vídeo. Tente novamente.');
      }
    } catch (e) {
      console.error('[catalogo.$id] video fetch error:', e);
      setErroVideo('Erro de rede ao carregar o vídeo.');
    } finally {
      setLoadingVideo(false);
    }
  };

  /* ── Enviar Comentário com Mutação Otimista ───────────────────────────── */
  const enviarComentario = () => {
    const texto = novoComentario.trim();
    if (!texto || enviando) return;

    const comentarioOtimista: Comentario = {
      id_do_topico: id,
      id_usuario: tgUser?.id ?? '0',
      nome_usuario: userName,
      texto,
      data: new Date().toISOString(),
      _optimistic: true,
    };

    /* Optimistic UI: adiciona imediatamente */
    setComentarios((prev) => [...prev, comentarioOtimista]);
    setNovoComentario('');
    setEnviando(true);

    /* Scroll para o final */
    setTimeout(() => {
      comentariosEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    /* POST silencioso para o backend */
    fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'adicionarComentario',
        id_do_topico: id,
        id_usuario: tgUser?.id ?? '0',
        nome_usuario: userName,
        texto,
        data: new Date().toISOString(),
      }),
    })
      .catch((err) => console.error('[catalogo.$id] envio de comentário:', err))
      .finally(() => setEnviando(false));
  };

  /* ── Derivação de metadados com fallback rigoroso ────────────────────── */
  const titulo =
    obra?.nome_da_musica ||
    obra?.nome_do_video ||
    obra?.nome ||
    obra?.titulo ||
    'Sem Título';

  const artista =
    obra?.nome_do_criador ||
    obra?.artista ||
    obra?.id_do_criador ||
    'Desconhecido';

  const capa =
    obra?.capa_da_musica ||
    obra?.capa ||
    obra?.thumb ||
    obra?.thumbnail_url;

  /* Trava de Segurança antes do .map() */
  const listaComentarios: Comentario[] = Array.isArray(comentarios)
    ? comentarios
    : [];

  /* ── Estados de Loading / Erro ───────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] text-white pb-32">
        <div className="relative w-full h-80">
          <SkeletonPulse className="w-full h-full rounded-none" />
        </div>
        <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">
          <SkeletonPulse className="h-4 w-24" />
          <SkeletonPulse className="h-8 w-3/4" />
          <SkeletonPulse className="h-10 w-32 rounded-full" />
          <div className="pt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonPulse key={i} className="h-14 w-[70%]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (erro || !obra) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] text-white flex flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-white/40"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-white/70 text-base font-medium">
          {erro ? 'Não foi possível carregar esta obra.' : 'Obra não encontrada.'}
        </p>
        <p className="text-white/40 text-sm max-w-xs">
          Verifique sua conexão ou tente novamente mais tarde.
        </p>
        <button
          onClick={() => router.history.back()}
          className="mt-2 px-6 py-2.5 rounded-full bg-white text-black font-bold text-sm hover:bg-white/90 active:scale-95 transition-all"
        >
          ← Voltar
        </button>
      </div>
    );
  }

  /* ── Render Principal ────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white pb-32 relative">
      <BackButton onClick={() => router.history.back()} />

      {/* ── Player flutuante (sticky no topo quando ativo) ─────────────── */}
      {videoUrl && (
        <div
          ref={videoRef}
          className="sticky top-0 z-50 w-full bg-black shadow-2xl"
        >
          <div className="relative w-full aspect-video">
            {/* tag <video> nativa do HTML5 conforme requisito */}
            <video
              controls
              autoPlay
              src={videoUrl}
              className="w-full h-full object-contain"
            />
            <button
              onClick={() => setVideoUrl('')}
              aria-label="Fechar player"
              className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold border border-white/20 transition-colors"
            >
              ✕ Fechar
            </button>
          </div>
        </div>
      )}

      {/* ── Header da Obra: capa, título e artista ─────────────────────── */}
      <div className="relative w-full" style={{ minHeight: '18rem' }}>
        {/* Capa com blur artístico */}
        {capa ? (
          <>
            {/* Fundo desfocado para preencher largura */}
            <div
              className="absolute inset-0 bg-cover bg-center scale-110"
              style={{
                backgroundImage: `url(${capa})`,
                filter: 'blur(24px) brightness(0.35)',
              }}
            />
            <div className="relative flex justify-center pt-12 pb-6 px-4">
              <img
                src={capa}
                alt={titulo}
                className="w-44 h-44 md:w-56 md:h-56 object-cover rounded-2xl shadow-2xl ring-1 ring-white/10"
              />
            </div>
          </>
        ) : (
          <div className="relative flex justify-center pt-12 pb-6 px-4">
            <div className="w-44 h-44 md:w-56 md:h-56 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center shadow-xl">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-white/30"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          </div>
        )}

        {/* Gradiente de fade para o fundo principal */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0f1c] to-transparent pointer-events-none" />
      </div>

      {/* Título, artista e botão Assistir */}
      <div className="max-w-2xl mx-auto px-4 pt-2 pb-4">
        <p className="text-xs uppercase tracking-widest text-white/50 mb-1.5 font-medium">
          {artista}
        </p>
        <h1 className="text-2xl md:text-3xl font-black leading-tight mb-4">
          {titulo}
        </h1>

        {/* MiniPlayer do Telegram — CRÍTICO */}
        {obra.telegram_file_id && !videoUrl && (
          <div className="flex flex-col gap-2">
            <button
              onClick={handlePlayVideo}
              disabled={loadingVideo}
              className="inline-flex items-center gap-2.5 self-start bg-white text-black px-6 py-2.5 rounded-full font-bold text-sm hover:bg-white/90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingVideo ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Assistir
                </>
              )}
            </button>

            {/* Mensagem de erro do vídeo */}
            {erroVideo && (
              <p className="text-xs text-red-400 mt-1">{erroVideo}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Divisor ──────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="h-px bg-white/10 my-2" />
      </div>

      {/* ── Fórum de Comentários ─────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 pt-5">
        <h2 className="font-bold text-base mb-4 flex items-center gap-2.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-white/60"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Comunidade</span>
          <span className="text-xs font-normal text-white/40">
            {listaComentarios.length}{' '}
            {listaComentarios.length === 1 ? 'comentário' : 'comentários'}
          </span>
        </h2>

        {/* Lista de comentários */}
        <div className="flex flex-col gap-2.5 mb-4">
          {listaComentarios.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center text-center py-12 gap-3">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-white/30"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-white/40 text-sm">
                Seja o primeiro a comentar nesta obra.
              </p>
            </div>
          ) : (
            /* Trava de Segurança Obrigatória: Array.isArray já aplicado acima */
            listaComentarios.map((c, i) => {
              const isMyMessage =
                String(c.id_usuario) === String(tgUser?.id);
              const nomeExibido =
                c.nome_usuario || c.nome_do_jogador || 'Anônimo';
              const textoExibido = c.texto || c.comentario || '';

              return (
                <div
                  key={i}
                  className={`flex flex-col max-w-[82%] ${
                    isMyMessage ? 'self-end items-end' : 'self-start items-start'
                  }`}
                >
                  {/* Nome do remetente (só para mensagens de outros) */}
                  {!isMyMessage && (
                    <span className="text-[11px] text-white/50 mb-0.5 ml-2 font-medium">
                      {nomeExibido}
                    </span>
                  )}

                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-snug relative ${
                      isMyMessage
                        ? 'bg-[#1d6fd8] text-white rounded-br-sm'
                        : 'bg-white/10 text-white/90 rounded-bl-sm'
                    } ${c._optimistic ? 'opacity-70' : ''}`}
                  >
                    {textoExibido}

                    {/* Indicador de envio para mensagens otimistas */}
                    {c._optimistic && (
                      <span className="ml-2 inline-block align-middle">
                        <div className="w-2.5 h-2.5 border border-white/40 border-t-white/80 rounded-full animate-spin inline-block" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sentinela de scroll */}
        <div ref={comentariosEndRef} />
      </div>

      {/* ── Input fixado no rodapé ─────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0f1c]/95 backdrop-blur-xl border-t border-white/10">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-3 py-3">
          {/* Avatar do usuário atual */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">
            {userName.charAt(0).toUpperCase()}
          </div>

          <input
            type="text"
            value={novoComentario}
            onChange={(e) => setNovoComentario(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviarComentario();
              }
            }}
            placeholder={`Comentar como ${userName}…`}
            className="flex-1 bg-white/8 rounded-full px-4 py-2.5 outline-none text-sm placeholder:text-white/30 border border-white/10 focus:border-white/25 transition-colors min-w-0"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          />

          <button
            onClick={enviarComentario}
            disabled={!novoComentario.trim() || enviando}
            aria-label="Enviar comentário"
            className="flex-shrink-0 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/90 active:scale-95 transition-all"
          >
            {enviando ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
