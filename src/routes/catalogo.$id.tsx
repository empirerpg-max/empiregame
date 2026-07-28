/**
 * catalogo.$id.tsx
 * ─────────────────────────────────────────────────────────────
 * Página de detalhes de uma obra do catálogo Empire RPG.
 *
 * Funcionalidades:
 *  • Hero com capa, título e artista (com fallbacks multi-campo)
 *  • Telegram Mini Player: busca URL temporária e renderiza <video> flutuante
 *  • Fórum com polling em tempo real, agrupado por data
 *  • Login silencioso via window.Telegram.WebApp.initDataUnsafe.user
 *  • Envio com Optimistic UI — atualiza o estado imediatamente, POST em background
 *  • Input com suporte a emoji nativo (sem biblioteca externa)
 *
 * CORREÇÕES APLICADAS:
 *  1. Proteção Anti-Quebra (TypeError): Array.isArray() antes de iterar comentários
 *  2. Mapeamento do Header: fallbacks multi-campo (nome_da_musica || nome, etc.)
 *  3. MiniPlayer de Vídeo: botão Assistir aparece sempre que telegram_file_id existir
 */

import { createFileRoute, useParams } from '@tanstack/react-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Play,
  X,
  Music2,
  ImageOff,
  MessageCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Mic2,
} from 'lucide-react';
import { useRouter } from '@tanstack/react-router';

// ─────────────────────────────────────────────────────────────
// Rota TanStack
// ─────────────────────────────────────────────────────────────

export const Route = createFileRoute('/catalogo/$id')({
  component: CatalogoObraPage,
});

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────

const GAS_URL =
  'https://script.google.com/macros/s/AKfycby7Epe3MHPMvje5OKtSlNn-tSWpowLPOJ7DVflFJqgZNOKCnN9IcGwWYL1QSeRtgJrQ7w/exec';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

/**
 * Interface da Obra: aceita múltiplos formatos de campo
 * para garantir compatibilidade com diferentes versões da API.
 */
interface Obra {
  id_do_topico: string;
  // Título — múltiplos campos possíveis (fallback em cascata)
  nome?: string;
  nome_da_musica?: string;
  titulo?: string;
  name?: string;
  // Artista — múltiplos campos possíveis
  artista?: string;
  artista_nome?: string;
  artist?: string;
  // Capa — múltiplos campos possíveis
  capa?: string;
  cover?: string;
  imagem?: string;
  foto?: string;
  thumbnail?: string;
  // Outros
  letra?: string;
  tipo?: string;
  telegram_file_id?: string;
}

interface Comentario {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  usuario_foto?: string;
  texto: string;
  criado_em: string;
  otimista?: boolean;
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

// ─────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────

function getTelegramUser(): TelegramUser | null {
  try {
    return (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user ?? null;
  } catch {
    return null;
  }
}

function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function gerarIdOtimista(): string {
  return `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function stringToHsl(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 55%, 48%)`;
}

/**
 * CORREÇÃO 2 — Extrai o título da obra com fallbacks multi-campo,
 * espelhando a mesma lógica usada no catálogo.index.tsx.
 */
function resolverTitulo(obra: Obra): string {
  return (
    obra.nome_da_musica ||
    obra.nome ||
    obra.titulo ||
    obra.name ||
    'Sem título'
  );
}

/**
 * CORREÇÃO 2 — Extrai o artista da obra com fallbacks multi-campo.
 */
function resolverArtista(obra: Obra): string {
  return obra.artista || obra.artista_nome || obra.artist || 'Artista desconhecido';
}

/**
 * CORREÇÃO 2 — Extrai a URL da capa com fallbacks multi-campo.
 */
function resolverCapa(obra: Obra): string | undefined {
  return (
    obra.capa ||
    obra.cover ||
    obra.imagem ||
    obra.foto ||
    obra.thumbnail ||
    undefined
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────

/** Avatar com inicial como fallback */
function Avatar({
  nome,
  foto,
  size = 36,
}: {
  nome: string;
  foto?: string;
  size?: number;
}) {
  const [err, setErr] = useState(false);
  const inicial = nome?.trim()?.[0]?.toUpperCase() ?? '?';

  if (foto && !err) {
    return (
      <img
        src={foto}
        alt={nome}
        width={size}
        height={size}
        onError={() => setErr(true)}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white select-none"
      style={{
        width: size,
        height: size,
        background: stringToHsl(nome),
        fontSize: size * 0.42,
      }}
    >
      {inicial}
    </div>
  );
}

/** Separador de data estilo Telegram */
function DateDivider({ data }: { data: string }) {
  return (
    <div className="flex items-center gap-3 my-4 px-2">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[10px] text-white/30 font-semibold tracking-widest uppercase">
        {data}
      </span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

/** Balão de mensagem */
function Balao({
  comentario,
  isMeu,
}: {
  comentario: Comentario;
  isMeu: boolean;
}) {
  return (
    <div
      className={`flex gap-2 items-end mb-1.5 ${isMeu ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {!isMeu && (
        <Avatar
          nome={comentario.usuario_nome}
          foto={comentario.usuario_foto}
          size={30}
        />
      )}

      <div
        className={`flex flex-col gap-0.5 max-w-[80%] ${
          isMeu ? 'items-end' : 'items-start'
        }`}
      >
        {!isMeu && (
          <span
            className="text-[11px] font-semibold px-1 leading-none"
            style={{ color: stringToHsl(comentario.usuario_nome) }}
          >
            {comentario.usuario_nome}
          </span>
        )}

        <div
          className={`
            px-3.5 py-2 text-sm leading-relaxed
            transition-opacity duration-300
            ${comentario.otimista ? 'opacity-60' : 'opacity-100'}
            ${
              isMeu
                ? 'bg-[#2AABEE] text-white rounded-[18px] rounded-br-[4px]'
                : 'bg-[#1a2a3a] text-white/90 rounded-[18px] rounded-bl-[4px] border border-white/[0.07]'
            }
          `}
        >
          <p className="whitespace-pre-wrap break-words">{comentario.texto}</p>
          <div
            className={`flex items-center gap-1 mt-1 ${
              isMeu ? 'justify-end' : 'justify-start'
            }`}
          >
            <span className="text-[10px] opacity-50">
              {formatHora(comentario.criado_em)}
            </span>
            {isMeu && (
              <span className="text-[10px] opacity-50">
                {comentario.otimista ? '🕐' : '✓✓'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Letra expansível */
function LetraExpansivel({ letra }: { letra: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-4 mb-5 rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d1822]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-white/70 hover:text-white active:scale-[0.99] transition-all duration-150"
      >
        <div className="flex items-center gap-2">
          <Mic2 size={14} className="text-[#2AABEE]" />
          <span className="text-sm font-medium">Letra</span>
        </div>
        {open ? (
          <ChevronUp size={15} className="text-white/40" />
        ) : (
          <ChevronDown size={15} className="text-white/40" />
        )}
      </button>
      <div
        className="overflow-hidden transition-[max-height] duration-500 ease-in-out"
        style={{ maxHeight: open ? '600px' : '0px' }}
      >
        <div className="px-4 pb-5">
          <div className="h-px bg-white/10 mb-4" />
          <pre className="text-sm text-white/70 whitespace-pre-wrap font-sans leading-loose">
            {letra.trim()}
          </pre>
        </div>
      </div>
    </div>
  );
}

/**
 * CORREÇÃO 3 — Player flutuante nativo HTML5.
 * Só é montado quando obra.telegram_file_id existe.
 * Busca a URL temporária em ?action=getVideoUrl&file_id=XYZ
 * e renderiza <video> com controls + autoPlay + playsInline.
 * Inclui retry manual em caso de falha.
 */
function VideoPlayer({
  telegramFileId,
  title,
  onClose,
}: {
  telegramFileId: string;
  title: string;
  onClose: () => void;
}) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  const buscarUrl = useCallback(() => {
    if (!telegramFileId) return;
    setLoading(true);
    setErro(false);
    setVideoUrl(null);
    fetch(
      `${GAS_URL}?action=getVideoUrl&file_id=${encodeURIComponent(telegramFileId)}`
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        // Aceita diferentes chaves de resposta da API
        const url =
          data?.url ??
          data?.videoUrl ??
          data?.mp4Url ??
          data?.video_url ??
          null;
        if (!url || typeof url !== 'string') {
          throw new Error('URL não encontrada na resposta da API');
        }
        setVideoUrl(url);
      })
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  }, [telegramFileId]);

  useEffect(() => {
    buscarUrl();
  }, [buscarUrl]);

  return (
    /* Overlay escuro — clique fora fecha */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-lg mx-2 mb-4 sm:mb-0 rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: '#0b141d',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[#2AABEE] animate-pulse" />
            <span className="text-sm font-semibold text-white/90 truncate max-w-[220px]">
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 active:scale-90 transition-all duration-150"
            aria-label="Fechar player"
          >
            <X size={16} />
          </button>
        </div>

        {/* Área do vídeo — aspect-ratio 16/9 */}
        <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
          {/* Estado: carregando */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="text-[#2AABEE] animate-spin" />
              <span className="text-xs text-white/40">Carregando vídeo…</span>
            </div>
          )}

          {/* Estado: erro */}
          {erro && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="text-3xl">⚠️</span>
              <p className="text-sm text-white/50">
                Não foi possível carregar o vídeo.
                <br />
                Tente novamente em instantes.
              </p>
              <button
                onClick={buscarUrl}
                className="mt-1 px-4 py-1.5 rounded-full bg-[#2AABEE]/20 text-[#2AABEE] text-xs font-semibold hover:bg-[#2AABEE]/30 transition"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Estado: vídeo pronto */}
          {videoUrl && !loading && !erro && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
              style={{ display: 'block' }}
            />
          )}
        </div>

        {/* Rodapé do player */}
        <div className="px-4 py-2.5 flex items-center gap-2">
          <span className="text-[10px] text-white/25 font-medium">
            URL temporária · Empire RPG
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────

export default function CatalogoObraPage() {
  const { id } = useParams({ from: '/catalogo/$id' });
  const router = useRouter();

  // ── Estado da obra ─────────────────────────────────────────
  const [obra, setObra] = useState<Obra | null>(null);
  const [loadingObra, setLoadingObra] = useState(true);
  const [erroObra, setErroObra] = useState(false);
  const [capaErro, setCapaErro] = useState(false);

  // ── Estado do player ───────────────────────────────────────
  const [playerAberto, setPlayerAberto] = useState(false);

  // ── Estado do fórum ────────────────────────────────────────
  /**
   * CORREÇÃO 1 — Inicialização explícita com array vazio garante
   * que comentarios nunca seja null/undefined.
   */
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loadingForum, setLoadingForum] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const telegramUser = getTelegramUser();

  // ── Inicialização do Telegram WebApp ───────────────────────
  useEffect(() => {
    try {
      (window as any).Telegram?.WebApp?.ready();
    } catch {
      // fora do contexto Telegram — ignora
    }
  }, []);

  // ── Fetch da obra ──────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoadingObra(true);
    fetch(`${GAS_URL}?action=getObra&id_do_topico=${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((data: Obra) => setObra(data))
      .catch(() => setErroObra(true))
      .finally(() => setLoadingObra(false));
  }, [id]);

  // ── Fetch de comentários + polling 15s ─────────────────────
  const carregarComentarios = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(
        `${GAS_URL}?action=getComentarios&id_do_topico=${encodeURIComponent(id)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      /**
       * CORREÇÃO 1 — Proteção Anti-Quebra (TypeError: comentarios is not iterable)
       * A API pode retornar null, undefined, um objeto { comentarios: [...] },
       * ou um array diretamente. Normalizamos aqui antes de setar o estado.
       * O loop em comentariosAgrupados e o .map() do render só veem a listaComentarios.
       */
      const listaComentarios: Comentario[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.comentarios)
          ? data.comentarios
          : Array.isArray(data?.data)
            ? data.data
            : [];

      setComentarios(listaComentarios);
    } catch {
      // Falha silenciosa — mantém estado anterior (que já é array vazio ou válido)
    } finally {
      setLoadingForum(false);
    }
  }, [id]);

  useEffect(() => {
    carregarComentarios();
    const intervalo = setInterval(carregarComentarios, 15_000);
    return () => clearInterval(intervalo);
  }, [carregarComentarios]);

  // ── Auto-scroll para o fim do fórum ───────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comentarios.length]);

  // ── Envio com Optimistic UI ────────────────────────────────
  async function enviarComentario() {
    const textoLimpo = texto.trim();
    if (!textoLimpo || enviando || !obra) return;

    const nomeUsuario = telegramUser
      ? `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`
      : 'Anônimo';

    const otimista: Comentario = {
      id: gerarIdOtimista(),
      usuario_id: String(telegramUser?.id ?? 'anonimo'),
      usuario_nome: nomeUsuario,
      usuario_foto: telegramUser?.photo_url,
      texto: textoLimpo,
      criado_em: new Date().toISOString(),
      otimista: true,
    };

    // 1) Exibe instantaneamente
    setComentarios((prev) => [...prev, otimista]);
    setTexto('');
    setEnviando(true);

    // Reset altura do textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await fetch(`${GAS_URL}?action=postComentario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_do_topico: obra.id_do_topico,
          usuario_id: otimista.usuario_id,
          usuario_nome: nomeUsuario,
          usuario_foto: telegramUser?.photo_url ?? '',
          texto: textoLimpo,
        }),
      });

      if (!res.ok) throw new Error('falha POST');

      const real: Comentario = await res.json();
      setComentarios((prev) =>
        prev.map((c) => (c.id === otimista.id ? { ...real, otimista: false } : c))
      );
    } catch {
      // Marca visualmente como falha
      setComentarios((prev) =>
        prev.map((c) =>
          c.id === otimista.id
            ? { ...c, texto: c.texto + ' ⚠️', otimista: false }
            : c
        )
      );
    } finally {
      setEnviando(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarComentario();
    }
  }

  // ── Agrupamento por data ────────────────────────────────────
  /**
   * CORREÇÃO 1 — Usa listaComentarios (garantidamente array)
   * ao invés de iterar diretamente sobre `comentarios`.
   */
  const comentariosAgrupados = (() => {
    const listaComentarios = Array.isArray(comentarios) ? comentarios : [];
    const lista: Array<
      | { tipo: 'data'; data: string }
      | { tipo: 'msg'; comentario: Comentario }
    > = [];
    let ultimaData = '';
    for (const c of listaComentarios) {
      const d = formatData(c.criado_em);
      if (d !== ultimaData) {
        lista.push({ tipo: 'data', data: d });
        ultimaData = d;
      }
      lista.push({ tipo: 'msg', comentario: c });
    }
    return lista;
  })();

  const meuId = String(telegramUser?.id ?? '');

  // CORREÇÃO 2 — Campos resolvidos via helpers de fallback
  const titulo = obra ? resolverTitulo(obra) : '';
  const artista = obra ? resolverArtista(obra) : '';
  const capaUrl = obra ? resolverCapa(obra) : undefined;

  // CORREÇÃO 3 — Flag explícita para exibir o botão Assistir
  const temVideo =
    obra?.telegram_file_id != null && obra.telegram_file_id.trim() !== '';

  // ─────────────────────────────────────────────────────────────
  // Estados de carregamento / erro
  // ─────────────────────────────────────────────────────────────

  if (loadingObra) {
    return (
      <div className="min-h-screen bg-[#0b141d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#2AABEE] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-white/30">Carregando obra…</span>
        </div>
      </div>
    );
  }

  if (erroObra || !obra) {
    return (
      <div className="min-h-screen bg-[#0b141d] flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="text-5xl">🎵</div>
        <p className="text-white/50 text-sm max-w-[26ch]">
          Esta obra não foi encontrada ou está indisponível.
        </p>
        <button
          onClick={() => router.history.back()}
          className="px-5 py-2.5 rounded-full bg-[#2AABEE]/15 text-[#2AABEE] text-sm font-semibold hover:bg-[#2AABEE]/25 active:scale-95 transition-all"
        >
          ← Voltar
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render principal
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-[#0b141d] text-white">

      {/* ───────────────── BOTÃO VOLTAR ───────────────── */}
      <button
        onClick={() => router.history.back()}
        className="fixed top-3 left-3 z-40 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md text-white/80 hover:text-white hover:bg-black/80 active:scale-90 transition-all duration-150 border border-white/[0.08]"
        aria-label="Voltar"
      >
        <ArrowLeft size={16} />
      </button>

      {/* ───────────────── HERO DA OBRA ───────────────── */}
      <div className="relative overflow-hidden">
        {/* Fundo com blur da capa */}
        {capaUrl && !capaErro && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${capaUrl})`,
              filter: 'blur(32px) brightness(0.3) saturate(1.4)',
              transform: 'scale(1.15)',
            }}
          />
        )}

        {/* Gradiente sobre o fundo */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(11,20,29,0.2) 0%, transparent 50%, #0b141d 100%)',
          }}
        />

        {/* Conteúdo do hero */}
        <div className="relative z-10 flex flex-col items-center pt-16 pb-7 px-5">
          {/* Capa */}
          <div
            className="w-[156px] h-[156px] rounded-[22px] overflow-hidden flex-shrink-0 flex items-center justify-center mb-4"
            style={{
              background: '#1a2a3a',
              boxShadow:
                '0 24px 56px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            {capaUrl && !capaErro ? (
              <img
                src={capaUrl}
                alt={`Capa de ${titulo}`}
                width={156}
                height={156}
                onError={() => setCapaErro(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageOff size={36} className="text-white/20" />
            )}
          </div>

          {/* Badge do tipo */}
          {obra.tipo && (
            <span
              className="text-[9px] font-black uppercase tracking-[0.18em] mb-2 px-2.5 py-1 rounded-full"
              style={{
                background: 'rgba(42,171,238,0.15)',
                color: '#2AABEE',
                border: '1px solid rgba(42,171,238,0.25)',
              }}
            >
              {obra.tipo}
            </span>
          )}

          {/*
           * CORREÇÃO 2 — Título e artista usando helpers com fallbacks.
           * Antes: obra.nome / obra.artista (quebravam se o campo não existisse).
           * Agora: resolverTitulo() / resolverArtista() cobrem todos os formatos.
           */}
          <h1 className="text-[1.45rem] font-extrabold text-center leading-tight mb-1.5 px-3 tracking-tight">
            {titulo}
          </h1>

          <div className="flex items-center gap-1.5 text-white/50 text-sm">
            <Music2 size={12} />
            <span className="font-medium">{artista}</span>
          </div>

          {/*
           * CORREÇÃO 3 — Botão Assistir aparece OBRIGATORIAMENTE quando
           * obra.telegram_file_id existe (verificado pela flag `temVideo`).
           * O clique abre o VideoPlayer que faz GET ?action=getVideoUrl&file_id=XYZ.
           */}
          {temVideo && (
            <button
              onClick={() => setPlayerAberto(true)}
              className="mt-5 flex items-center gap-2.5 px-6 py-2.5 rounded-full font-bold text-sm text-white active:scale-95 transition-all duration-150"
              style={{
                background: 'linear-gradient(135deg, #2AABEE 0%, #1a8dcc 100%)',
                boxShadow: '0 8px 24px rgba(42,171,238,0.4)',
              }}
              aria-label={`Assistir ${titulo}`}
            >
              <Play size={14} fill="white" strokeWidth={0} />
              Assistir Vídeo
            </button>
          )}
        </div>
      </div>

      {/* ───────────────── LETRA ──────────────────────── */}
      {obra.letra && <LetraExpansivel letra={obra.letra} />}

      {/* ───────────────── FÓRUM ──────────────────────── */}
      <div
        className="flex flex-col flex-1"
        style={{
          background: '#0b141d',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Header do fórum */}
        <div
          className="px-4 py-3 flex items-center justify-between sticky top-0 z-20"
          style={{
            background: 'rgba(11,20,29,0.97)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <MessageCircle size={15} className="text-[#2AABEE]" />
            <span className="text-sm font-semibold text-white/80">Discussão</span>
            <div
              className="w-1.5 h-1.5 rounded-full bg-[#2AABEE] animate-pulse"
              title="Ao vivo"
            />
          </div>
          {/* CORREÇÃO 1 — comentarios é sempre array aqui */}
          <span className="text-[11px] text-white/30 tabular-nums">
            {comentarios.length}{' '}
            {comentarios.length === 1 ? 'comentário' : 'comentários'}
          </span>
        </div>

        {/* Lista de mensagens */}
        <div className="flex-1 overflow-y-auto px-3 py-4" style={{ minHeight: 200 }}>
          {loadingForum ? (
            // Skeleton
            <div className="flex flex-col gap-3 px-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`flex gap-2 items-end ${
                    i % 2 === 0 ? '' : 'flex-row-reverse'
                  }`}
                >
                  <div
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: 30,
                      height: 30,
                      background: 'rgba(255,255,255,0.07)',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                  <div
                    className="h-10 rounded-2xl"
                    style={{
                      width: `${40 + (i % 3) * 18}%`,
                      background: 'rgba(255,255,255,0.07)',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                </div>
              ))}
            </div>
          ) : comentarios.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <div className="text-4xl leading-none select-none">💬</div>
              <p className="text-white/35 text-sm max-w-[24ch] leading-relaxed">
                Seja o primeiro a comentar sobre esta obra!
              </p>
            </div>
          ) : (
            // CORREÇÃO 1 — Loop sobre comentariosAgrupados (derivado de listaComentarios)
            comentariosAgrupados.map((item, i) =>
              item.tipo === 'data' ? (
                <DateDivider key={`d-${i}`} data={item.data} />
              ) : (
                <Balao
                  key={item.comentario.id}
                  comentario={item.comentario}
                  isMeu={item.comentario.usuario_id === meuId}
                />
              )
            )
          )}
          <div ref={endRef} />
        </div>

        {/* ── Campo de entrada ── */}
        <div
          className="sticky bottom-0 z-20"
          style={{
            background: 'rgba(11,20,29,0.98)',
            backdropFilter: 'blur(16px)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Identidade */}
          {telegramUser && (
            <div className="flex items-center gap-2 px-4 pt-2.5 pb-0">
              <Avatar
                nome={`${telegramUser.first_name}${
                  telegramUser.last_name ? ' ' + telegramUser.last_name : ''
                }`}
                foto={telegramUser.photo_url}
                size={16}
              />
              <span className="text-[11px] text-white/35">
                Comentando como{' '}
                <span className="text-white/55 font-semibold">
                  {telegramUser.first_name}
                </span>
              </span>
            </div>
          )}

          <div className="flex items-end gap-2 px-3 py-2.5">
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escreva um comentário… (Enter para enviar)"
              rows={1}
              inputMode="text"
              className="flex-1 text-white/90 placeholder-white/25 text-sm resize-none outline-none rounded-[18px] px-4 py-2.5 transition-colors duration-200"
              style={{
                background: '#1a2a3a',
                border: '1px solid rgba(255,255,255,0.08)',
                lineHeight: 1.5,
                minHeight: 40,
                maxHeight: 120,
                overflowY: 'auto',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(42,171,238,0.45)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={enviarComentario}
              disabled={!texto.trim() || enviando}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white active:scale-90 transition-all duration-150"
              style={{
                background:
                  texto.trim() && !enviando
                    ? 'linear-gradient(135deg, #2AABEE 0%, #1a8dcc 100%)'
                    : 'rgba(42,171,238,0.2)',
                cursor: texto.trim() && !enviando ? 'pointer' : 'not-allowed',
              }}
              aria-label="Enviar comentário"
            >
              {enviando ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={15} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────── VIDEO PLAYER FLUTUANTE ─────── */}
      {/*
       * CORREÇÃO 3 — Só monta o player quando `temVideo` é true
       * E o playerAberto foi ativado pelo clique no botão Assistir.
       */}
      {playerAberto && temVideo && (
        <VideoPlayer
          telegramFileId={obra.telegram_file_id!}
          title={titulo}
          onClose={() => setPlayerAberto(false)}
        />
      )}
    </div>
  );
}
