/**
 * catalogo.$id.tsx
 * ─────────────────────────────────────────────────────────────
 * Página de detalhes de uma obra do catálogo Empire RPG.
 *
 * Regras de fallback aplicadas (REGRA RÍGIDA):
 *  • Título:  nome_da_musica || nome_do_video || nome || titulo
 *  • Artista: nome_do_criador || artista
 *  • Capa:    capa_da_musica || capa || thumb || thumbnail_url
 *
 *  A URL de fetch busca categorias individualmente via:
 *    GET {GAS_URL}?action=nome_da_categoria
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
// GAS URL — variável de ambiente com fallback para URL fixa
// ─────────────────────────────────────────────────────────────

const GAS_URL: string =
  (import.meta as any).env?.VITE_GAS_URL ??
  'https://script.google.com/macros/s/AKfycby7Epe3MHPMvje5OKtSlNn-tSWpowLPOJ7DVflFJqgZNOKCnN9IcGwWYL1QSeRtgJrQ7w/exec';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

/**
 * Interface da Obra — aceita propriedades dinâmicas snake_case
 * geradas pelo backend GAS a partir dos cabeçalhos do Google Sheets.
 * A assinatura de índice [key: string] garante compatibilidade total.
 */
export interface Obra {
  id_do_topico: string;
  // Título (fallback em cascata — mais específico primeiro)
  nome_da_musica?: string;
  nome_do_video?: string;
  nome?: string;
  titulo?: string;
  // Artista / Criador (fallback em cascata)
  nome_do_criador?: string;
  artista?: string;
  id_do_criador?: string;
  // Capa (fallback em cascata — mais específico primeiro)
  capa_da_musica?: string;
  capa?: string;
  thumb?: string;
  thumbnail_url?: string;
  // Outros campos comuns
  letra?: string;
  tipo?: string;
  telegram_file_id?: string;
  // Aceita qualquer chave snake_case extra sem quebrar TypeScript
  [key: string]: unknown;
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
// Helpers de fallback — REGRA RÍGIDA conforme especificação
// ─────────────────────────────────────────────────────────────

/** Título: nome_da_musica → nome_do_video → nome → titulo */
function resolverTitulo(obra: Obra): string {
  return (
    (obra.nome_da_musica as string | undefined) ||
    (obra.nome_do_video  as string | undefined) ||
    (obra.nome           as string | undefined) ||
    (obra.titulo         as string | undefined) ||
    'Sem título'
  );
}

/** Artista: nome_do_criador → artista */
function resolverArtista(obra: Obra): string {
  return (
    (obra.nome_do_criador as string | undefined) ||
    (obra.artista         as string | undefined) ||
    (obra.id_do_criador   as string | undefined) ||
    'Artista desconhecido'
  );
}

/** Capa: capa_da_musica → capa → thumb → thumbnail_url */
function resolverCapa(obra: Obra): string | undefined {
  return (
    (obra.capa_da_musica as string | undefined) ||
    (obra.capa          as string | undefined) ||
    (obra.thumb         as string | undefined) ||
    (obra.thumbnail_url as string | undefined) ||
    undefined
  );
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
      className={`flex gap-2 items-end mb-1.5 ${
        isMeu ? 'flex-row-reverse' : 'flex-row'
      }`}
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

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────

export default function CatalogoObraPage() {
  const { id } = useParams({ from: '/catalogo/$id' });
  const router = useRouter();

  // ── Estado da obra ──────────────────────────────────────────
  const [obra,       setObra      ] = useState<Obra | null>(null);
  const [loadingObra,setLoadingObra] = useState(true);
  const [erroObra,   setErroObra  ] = useState<string | null>(null);

  // ── Estado do fórum ─────────────────────────────────────────
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loadingForum,setLoadingForum] = useState(false);
  const [texto,        setTexto      ] = useState('');
  const [enviando,     setEnviando   ] = useState(false);
  const [forumAberto,  setForumAberto] = useState(false);

  // ── MiniPlayer Telegram ──────────────────────────────────────
  const [videoUrl,     setVideoUrl    ] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo ] = useState(false);
  const [playerAberto, setPlayerAberto ] = useState(false);

  const endRef    = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const tgUser    = getTelegramUser();

  // ──────────────────────────────────────────────────────────────
  // Busca a obra pelo id_do_topico
  // Estratégia: tenta todas as categorias até encontrar a obra
  // ──────────────────────────────────────────────────────────────
  const CATEGORIAS = ['musicas', 'albuns', 'music_videos', 'videos', 'top50spotify'];

  const buscarObra = useCallback(async () => {
    setLoadingObra(true);
    setErroObra(null);

    for (const categoria of CATEGORIAS) {
      try {
        // Busca a categoria individualmente via ?action=nome_da_categoria
        const res = await fetch(`${GAS_URL}?action=${categoria}`);
        if (!res.ok) continue;

        const json = await res.json();
        const items: Obra[] = Array.isArray(json) ? json : (json?.data ?? []);
        const encontrada = items.find((o) => o.id_do_topico === id);

        if (encontrada) {
          setObra(encontrada);
          setLoadingObra(false);
          return;
        }
      } catch {
        // Ignora erros por categoria e tenta a próxima
        continue;
      }
    }

    setErroObra('Obra não encontrada.');
    setLoadingObra(false);
  }, [id]);

  useEffect(() => {
    buscarObra();
  }, [buscarObra]);

  // ──────────────────────────────────────────────────────────────
  // Comentários — polling a cada 15s
  // ──────────────────────────────────────────────────────────────
  const fetchComentarios = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${GAS_URL}?action=get_comments&topico_id=${id}`);
      if (!res.ok) return;
      const json = await res.json();
      const lista = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
          ? json.data
          : [];
      setComentarios(
        lista.filter((c: Comentario) => !c.otimista),
      );
    } catch {
      // Silencia erros de polling
    }
  }, [id]);

  useEffect(() => {
    if (!forumAberto) return;
    fetchComentarios();
    const interval = setInterval(fetchComentarios, 15_000);
    return () => clearInterval(interval);
  }, [forumAberto, fetchComentarios]);

  // Scroll automático ao abrir fórum
  useEffect(() => {
    if (forumAberto) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [forumAberto, comentarios.length]);

  // ──────────────────────────────────────────────────────────────
  // Envio de comentário (Optimistic UI)
  // ──────────────────────────────────────────────────────────────
  const enviarComentario = async () => {
    const textoCortado = texto.trim();
    if (!textoCortado || !tgUser || enviando) return;

    const otimista: Comentario = {
      id:           gerarIdOtimista(),
      usuario_id:   String(tgUser.id),
      usuario_nome: `${tgUser.first_name}${tgUser.last_name ? ` ${tgUser.last_name}` : ''}`,
      usuario_foto: tgUser.photo_url,
      texto:        textoCortado,
      criado_em:    new Date().toISOString(),
      otimista:     true,
    };

    setComentarios((prev) => [...prev, otimista]);
    setTexto('');
    setEnviando(true);

    try {
      await fetch(GAS_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:       'add_comment',
          topico_id:    id,
          usuario_id:   String(tgUser.id),
          usuario_nome: otimista.usuario_nome,
          usuario_foto: tgUser.photo_url ?? '',
          texto:        textoCortado,
        }),
      });
      await fetchComentarios();
    } catch {
      // Mantém o otimista visível; próximo polling corrigirá
    } finally {
      setEnviando(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // MiniPlayer — busca URL temporária do Telegram
  // ──────────────────────────────────────────────────────────────
  const abrirPlayer = async () => {
    if (!obra?.telegram_file_id) return;
    setLoadingVideo(true);
    try {
      const res = await fetch(
        `${GAS_URL}?action=get_video_url&file_id=${obra.telegram_file_id}`,
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      const url: string = json?.url ?? json?.data?.url ?? '';
      if (!url) throw new Error();
      setVideoUrl(url);
      setPlayerAberto(true);
    } catch {
      alert('Não foi possível carregar o vídeo. Tente novamente.');
    } finally {
      setLoadingVideo(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Agrupamento de comentários por data
  // ──────────────────────────────────────────────────────────────
  function agruparPorData(lista: Comentario[]) {
    const grupos = new Map<string, Comentario[]>();
    for (const c of lista) {
      const chave = formatData(c.criado_em);
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(c);
    }
    return grupos;
  }

  const gruposComentarios = agruparPorData(comentarios);

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  if (loadingObra) {
    return (
      <div className="min-h-screen bg-[#0f1923] flex items-center justify-center">
        <Loader2 size={32} className="text-[#2AABEE] animate-spin" />
      </div>
    );
  }

  if (erroObra || !obra) {
    return (
      <div className="min-h-screen bg-[#0f1923] flex flex-col items-center justify-center gap-4 px-8 text-center">
        <ImageOff size={40} className="text-white/20" />
        <p className="text-white/50 text-sm">{erroObra ?? 'Obra não encontrada.'}</p>
        <button
          onClick={() => router.history.back()}
          className="px-4 py-2 rounded-full bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-colors"
        >
          Voltar
        </button>
      </div>
    );
  }

  // Aplica fallbacks conforme REGRA RÍGIDA
  const titulo  = resolverTitulo(obra);
  const artista = resolverArtista(obra);
  const capa    = resolverCapa(obra);

  return (
    <div className="min-h-screen bg-[#0f1923] text-white pb-24">

      {/* ── Back button ── */}
      <div className="sticky top-0 z-10 bg-[#0f1923]/90 backdrop-blur-sm px-4 py-3 flex items-center gap-3 border-b border-white/10">
        <button
          onClick={() => router.history.back()}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} className="text-white/80" />
        </button>
        <span className="text-sm font-semibold text-white/80 truncate">{titulo}</span>
      </div>

      {/* ── Hero ── */}
      <div className="relative">
        {/* Capa de fundo (blur) */}
        {capa && (
          <div
            className="absolute inset-0 bg-cover bg-center blur-2xl opacity-20 scale-110"
            style={{ backgroundImage: `url(${capa})` }}
            aria-hidden
          />
        )}

        <div className="relative z-[1] flex flex-col items-center pt-8 pb-6 px-4 gap-4">
          {/* Capa principal */}
          <div className="w-44 h-44 rounded-2xl overflow-hidden shadow-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
            {capa ? (
              <img
                src={capa}
                alt={titulo}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <Music2 size={48} className="text-white/20" />
            )}
          </div>

          {/* Título e artista com fallbacks */}
          <div className="text-center">
            <h1 className="text-xl font-bold leading-tight">{titulo}</h1>
            <p className="text-white/55 text-sm mt-0.5">{artista}</p>
          </div>

          {/* Botão Assistir — aparece quando telegram_file_id existe */}
          {obra.telegram_file_id && (
            <button
              onClick={abrirPlayer}
              disabled={loadingVideo}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#2AABEE]
                         text-white text-sm font-semibold shadow-lg shadow-[#2AABEE]/30
                         hover:bg-[#1a9bde] active:scale-95 transition-all disabled:opacity-60"
            >
              {loadingVideo
                ? <Loader2 size={16} className="animate-spin" />
                : <Play size={16} fill="white" />}
              {loadingVideo ? 'Carregando…' : 'Assistir'}
            </button>
          )}
        </div>
      </div>

      {/* ── Letra (se houver) ── */}
      {obra.letra && (
        <div className="mx-4 mt-2 bg-[#1a2535] rounded-2xl p-4">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Mic2 size={12} /> Letra
          </h2>
          <pre className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap font-sans">
            {obra.letra as string}
          </pre>
        </div>
      )}

      {/* ── Fórum (toggle) ── */}
      <div className="mx-4 mt-4">
        <button
          onClick={() => setForumAberto((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3
                     bg-[#1a2535] rounded-2xl text-sm font-semibold
                     hover:bg-[#1e2c40] transition-colors"
        >
          <span className="flex items-center gap-2">
            <MessageCircle size={15} className="text-[#2AABEE]" />
            Fórum · {comentarios.length}
          </span>
          {forumAberto
            ? <ChevronUp size={16} className="text-white/40" />
            : <ChevronDown size={16} className="text-white/40" />}
        </button>

        {forumAberto && (
          <div className="mt-2 bg-[#111c2a] rounded-2xl overflow-hidden">
            {/* Lista de comentários */}
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {loadingForum && comentarios.length === 0 && (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="text-[#2AABEE] animate-spin" />
                </div>
              )}

              {!loadingForum && comentarios.length === 0 && (
                <div className="text-center py-10">
                  <MessageCircle size={32} className="text-white/10 mx-auto mb-2" />
                  <p className="text-white/30 text-xs">Seja o primeiro a comentar</p>
                </div>
              )}

              {Array.from(gruposComentarios.entries()).map(([data, lista]) => (
                <div key={data}>
                  <DateDivider data={data} />
                  {lista.map((c) => (
                    <Balao
                      key={c.id}
                      comentario={c}
                      isMeu={String(tgUser?.id) === c.usuario_id}
                    />
                  ))}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Input de envio */}
            {tgUser ? (
              <div className="flex items-end gap-2 p-3 border-t border-white/10">
                <Avatar nome={`${tgUser.first_name}`} foto={tgUser.photo_url} size={28} />
                <textarea
                  ref={inputRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      enviarComentario();
                    }
                  }}
                  placeholder="Escreva um comentário…"
                  rows={1}
                  className="flex-1 resize-none bg-[#1a2a3a] rounded-2xl px-3 py-2
                             text-sm text-white placeholder-white/30 border border-white/[0.07]
                             focus:outline-none focus:border-[#2AABEE]/50
                             max-h-28 overflow-y-auto"
                  style={{ lineHeight: '1.4' }}
                />
                <button
                  onClick={enviarComentario}
                  disabled={!texto.trim() || enviando}
                  className="p-2 rounded-full bg-[#2AABEE] text-white
                             hover:bg-[#1a9bde] active:scale-95 transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Enviar comentário"
                >
                  {enviando
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Send size={16} />}
                </button>
              </div>
            ) : (
              <div className="text-center py-4 border-t border-white/10">
                <p className="text-white/30 text-xs">Abra pelo Telegram para comentar</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MiniPlayer de Vídeo ── */}
      {playerAberto && videoUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-sm">
            <button
              onClick={() => { setPlayerAberto(false); setVideoUrl(null); }}
              className="absolute -top-3 -right-3 z-10 p-1.5 rounded-full bg-[#1e2736]
                         border border-white/20 hover:bg-white/20 transition-colors"
              aria-label="Fechar player"
            >
              <X size={16} />
            </button>
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full rounded-2xl shadow-2xl"
            />
            <p className="text-center text-white/60 text-xs mt-3 truncate px-2">{titulo}</p>
          </div>
        </div>
      )}
    </div>
  );
}
