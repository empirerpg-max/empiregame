/**
 * ForumObra.tsx
 * Central de discussões de uma obra do catálogo.
 * Design: capa + metadados em destaque, letra expansível, fórum estilo Orkut/Telegram.
 * Login: silencioso via window.Telegram.WebApp.initDataUnsafe.user
 * Comentários: lidos da API com ?id_do_topico=, enviados com Optimistic UI.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, ChevronDown, ChevronUp, Mic2, Music2, ImageOff, Play } from 'lucide-react';
import MiniPlayer from '../components/MiniPlayer';

// ────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────

const API_BASE_URL =
  'https://script.google.com/macros/s/AKfycby7Epe3MHPMvje5OKtSlNn-tSWpowLPOJ7DVflFJqgZNOKCnN9IcGwWYL1QSeRtgJrQ7w/exec';

// ────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────

export interface Obra {
  id_do_topico: string;
  nome: string;
  artista: string;
  capa?: string;
  letra?: string;
  tipo?: string; // ex: 'musica' | 'album' | 'ep'
  telegram_file_id?: string; // código longo do arquivo de vídeo no Telegram
}

export interface Comentario {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  usuario_foto?: string;
  texto: string;
  criado_em: string; // ISO string
  otimista?: boolean; // flag interna para UI otimista
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

// ────────────────────────────────────────────────────────────
// Utilitários
// ────────────────────────────────────────────────────────────

function getTelegramUser(): TelegramUser | null {
  try {
    return (
      (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user ?? null
    );
  } catch {
    return null;
  }
}

function formatHora(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatData(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function gerarIdOtimista(): string {
  return `otimista_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ────────────────────────────────────────────────────────────
// Subcomponentes
// ────────────────────────────────────────────────────────────

/** Avatar com fallback por inicial */
function Avatar({
  nome,
  foto,
  size = 36,
}: {
  nome: string;
  foto?: string;
  size?: number;
}) {
  const [imgErr, setImgErr] = useState(false);
  const inicial = nome?.trim()?.[0]?.toUpperCase() ?? '?';
  const cor = stringToColor(nome);

  if (foto && !imgErr) {
    return (
      <img
        src={foto}
        alt={nome}
        width={size}
        height={size}
        onError={() => setImgErr(true)}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
      style={{
        width: size,
        height: size,
        background: cor,
        fontSize: size * 0.4,
      }}
    >
      {inicial}
    </div>
  );
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 42%)`;
}

/** Separador de data entre mensagens (estilo Telegram) */
function DateDivider({ data }: { data: string }) {
  return (
    <div className="flex items-center gap-3 my-4 px-2">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[11px] text-white/30 font-medium tracking-wide uppercase">
        {data}
      </span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

/** Balão de mensagem estilo Telegram com contexto Orkut */
function Balao({
  comentario,
  isMeu,
}: {
  comentario: Comentario;
  isMeu: boolean;
}) {
  return (
    <div
      className={`flex gap-2 items-end mb-1 ${
        isMeu ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar apenas para mensagens de outros */}
      {!isMeu && (
        <Avatar
          nome={comentario.usuario_nome}
          foto={comentario.usuario_foto}
          size={32}
        />
      )}

      <div
        className={`flex flex-col gap-0.5 max-w-[78%] ${
          isMeu ? 'items-end' : 'items-start'
        }`}
      >
        {/* Nome do usuário (apenas para outros) */}
        {!isMeu && (
          <span
            className="text-[11px] font-semibold px-1"
            style={{ color: stringToColor(comentario.usuario_nome) }}
          >
            {comentario.usuario_nome}
          </span>
        )}

        {/* Balão */}
        <div
          className={`
            relative px-3 py-2 text-sm leading-relaxed
            ${
              isMeu
                ? 'bg-[#2AABEE] text-white rounded-2xl rounded-br-sm'
                : 'bg-[#1e2d3d] text-white/90 rounded-2xl rounded-bl-sm'
            }
            ${
              comentario.otimista ? 'opacity-70' : 'opacity-100'
            }
            transition-opacity duration-300
          `}
        >
          {/* Texto com suporte a emojis e quebras de linha */}
          <p className="whitespace-pre-wrap break-words">{comentario.texto}</p>

          {/* Horário + status de envio */}
          <div
            className={`flex items-center gap-1 mt-1 ${
              isMeu ? 'justify-end' : 'justify-start'
            }`}
          >
            <span className="text-[10px] opacity-60">
              {formatHora(comentario.criado_em)}
            </span>
            {isMeu && (
              <span className="text-[10px] opacity-60">
                {comentario.otimista ? '🕐' : '✓✓'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Área expansível da letra da música */
function LetraExpansivel({ letra }: { letra: string }) {
  const [aberta, setAberta] = useState(false);

  return (
    <div className="mx-4 mb-6 rounded-2xl overflow-hidden border border-white/10 bg-[#111c27]">
      <button
        onClick={() => setAberta((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-white/80 hover:text-white transition"
      >
        <div className="flex items-center gap-2">
          <Mic2 size={15} className="text-[#2AABEE]" />
          <span className="text-sm font-medium">Letra</span>
        </div>
        {aberta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      <div
        className="overflow-hidden transition-all duration-500 ease-in-out"
        style={{ maxHeight: aberta ? '600px' : '0px' }}
      >
        <div className="px-4 pb-5">
          <div className="h-px bg-white/10 mb-4" />
          <pre className="text-sm text-white/75 whitespace-pre-wrap font-sans leading-loose">
            {letra.trim()}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────

export default function ForumObra({ obra }: { obra: Obra }) {
  const telegramUser = getTelegramUser();
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loadingComentarios, setLoadingComentarios] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [capaErro, setCapaErro] = useState(false);
  const [playerAberto, setPlayerAberto] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Fetch comentários ──────────────────────────────────────
  const carregarComentarios = useCallback(async () => {
    if (!obra.id_do_topico) return;
    try {
      const res = await fetch(
        `/api/forum/comentarios?id_do_topico=${encodeURIComponent(obra.id_do_topico)}`
      );
      if (!res.ok) throw new Error('erro ao carregar');
      const data: Comentario[] = await res.json();
      setComentarios(data);
    } catch {
      // falha silenciosa – mantém o estado anterior
    } finally {
      setLoadingComentarios(false);
    }
  }, [obra.id_do_topico]);

  useEffect(() => {
    carregarComentarios();
    // Polling a cada 15s para simular tempo real sem WebSocket
    const intervalo = setInterval(carregarComentarios, 15_000);
    return () => clearInterval(intervalo);
  }, [carregarComentarios]);

  // ── Auto-scroll ao fim ────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comentarios.length]);

  // ── Envio com Optimistic UI ───────────────────────────────
  async function enviarComentario() {
    const textoLimpo = texto.trim();
    if (!textoLimpo || enviando) return;

    const nomeUsuario =
      telegramUser
        ? `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`
        : 'Anônimo';

    const comentarioOtimista: Comentario = {
      id: gerarIdOtimista(),
      usuario_id: String(telegramUser?.id ?? 'anonimo'),
      usuario_nome: nomeUsuario,
      usuario_foto: telegramUser?.photo_url,
      texto: textoLimpo,
      criado_em: new Date().toISOString(),
      otimista: true,
    };

    // 1) Exibe imediatamente na tela
    setComentarios((prev) => [...prev, comentarioOtimista]);
    setTexto('');
    setEnviando(true);

    try {
      const res = await fetch('/api/forum/comentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_do_topico: obra.id_do_topico,
          usuario_id: comentarioOtimista.usuario_id,
          usuario_nome: nomeUsuario,
          usuario_foto: telegramUser?.photo_url ?? '',
          texto: textoLimpo,
        }),
      });

      if (!res.ok) throw new Error('falha no POST');

      // 2) Substitui o otimista pelo real retornado pela API
      const real: Comentario = await res.json();
      setComentarios((prev) =>
        prev.map((c) => (c.id === comentarioOtimista.id ? { ...real, otimista: false } : c))
      );
    } catch {
      // 3) Em caso de falha: marca como erro (mantém visível mas acinzentado)
      setComentarios((prev) =>
        prev.map((c) =>
          c.id === comentarioOtimista.id
            ? { ...c, texto: c.texto + ' ⚠️ (falha ao enviar)', otimista: false }
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

  // ── Agrupamento de mensagens por data ─────────────────────
  const comentariosComDatas = (() => {
    const resultado: Array<{ tipo: 'data' | 'msg'; data?: string; comentario?: Comentario }> = [];
    let ultimaData = '';
    for (const c of comentarios) {
      const dataStr = formatData(c.criado_em);
      if (dataStr !== ultimaData) {
        resultado.push({ tipo: 'data', data: dataStr });
        ultimaData = dataStr;
      }
      resultado.push({ tipo: 'msg', comentario: c });
    }
    return resultado;
  })();

  const meuId = String(telegramUser?.id ?? '');

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-[#0f1923] text-white">
      {/* ─────────────────── HERO DA OBRA ─────────────────── */}
      <div className="relative">
        {/* Capa com blur de fundo */}
        {obra.capa && !capaErro && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${obra.capa})`,
              filter: 'blur(28px) brightness(0.35) saturate(1.3)',
              transform: 'scale(1.1)',
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f1923]/30 via-transparent to-[#0f1923]" />

        {/* Conteúdo do hero */}
        <div className="relative z-10 flex flex-col items-center pt-14 pb-6 px-4">
          {/* Capa */}
          <div className="w-44 h-44 rounded-2xl overflow-hidden shadow-2xl mb-4 flex-shrink-0 bg-[#1e2d3d] flex items-center justify-center">
            {obra.capa && !capaErro ? (
              <img
                src={obra.capa}
                alt={`Capa de ${obra.nome}`}
                width={176}
                height={176}
                onError={() => setCapaErro(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageOff size={40} className="text-white/20" />
            )}
          </div>

          {/* Tipo da obra */}
          {obra.tipo && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#2AABEE]/80 mb-1">
              {obra.tipo}
            </span>
          )}

          {/* Nome */}
          <h1 className="text-2xl font-bold text-center leading-tight mb-1 px-4">
            {obra.nome}
          </h1>

          {/* Artista */}
          <div className="flex items-center gap-1.5 text-white/60 text-sm">
            <Music2 size={13} />
            <span>{obra.artista}</span>
          </div>

          {/* ── Botão Assistir (apenas se houver telegram_file_id) ── */}
          {obra.telegram_file_id && (
            <button
              onClick={() => setPlayerAberto(true)}
              className="
                mt-4 flex items-center gap-2 px-5 py-2.5
                bg-[#2AABEE] hover:bg-[#1d97d4] active:scale-95
                text-white font-semibold text-sm rounded-full
                shadow-lg shadow-[#2AABEE]/30
                transition-all duration-150
              "
              aria-label={`Assistir ${obra.nome}`}
            >
              <Play size={15} fill="white" />
              Assistir
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────── LETRA (SE HOUVER) ────────────── */}
      {obra.letra && <LetraExpansivel letra={obra.letra} />}

      {/* ─────────────────── FÓRUM ───────────────────────── */}
      <div className="flex flex-col flex-1 bg-[#0f1923] border-t border-white/10">
        {/* Cabeçalho do fórum */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between sticky top-0 z-20 bg-[#0f1923]/95 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#2AABEE] animate-pulse" />
            <span className="text-sm font-semibold text-white/80">Discussão</span>
          </div>
          <span className="text-xs text-white/30">
            {comentarios.length} {comentarios.length === 1 ? 'comentário' : 'comentários'}
          </span>
        </div>

        {/* Lista de mensagens */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {loadingComentarios ? (
            // Skeleton loader
            <div className="flex flex-col gap-3 px-1">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className={`flex gap-2 items-end ${
                    i % 2 === 0 ? '' : 'flex-row-reverse'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
                  <div
                    className="h-10 rounded-2xl bg-white/10 animate-pulse"
                    style={{ width: `${45 + (i % 3) * 20}%` }}
                  />
                </div>
              ))}
            </div>
          ) : comentarios.length === 0 ? (
            // Estado vazio
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="text-4xl">💬</div>
              <p className="text-white/40 text-sm max-w-[22ch]">
                Seja o primeiro a comentar sobre esta obra!
              </p>
            </div>
          ) : (
            // Mensagens agrupadas por data
            comentariosComDatas.map((item, i) =>
              item.tipo === 'data' ? (
                <DateDivider key={`data-${i}`} data={item.data!} />
              ) : (
                <Balao
                  key={item.comentario!.id}
                  comentario={item.comentario!}
                  isMeu={item.comentario!.usuario_id === meuId}
                />
              )
            )
          )}
          <div ref={endRef} />
        </div>

        {/* ──── Campo de entrada ──── */}
        <div className="sticky bottom-0 z-20 bg-[#0f1923]/98 backdrop-blur-sm border-t border-white/10">
          {/* Identidade do usuário logado */}
          {telegramUser && (
            <div className="flex items-center gap-2 px-4 pt-2 pb-0">
              <Avatar
                nome={`${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`}
                foto={telegramUser.photo_url}
                size={18}
              />
              <span className="text-[11px] text-white/40">
                Comentando como{' '}
                <span className="text-white/60 font-medium">
                  {telegramUser.first_name}
                </span>
              </span>
            </div>
          )}

          <div className="flex items-end gap-2 px-3 py-2">
            <textarea
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escreva um comentário… (Enter para enviar)"
              rows={1}
              className="
                flex-1 bg-[#1e2d3d] text-white/90 placeholder-white/30
                rounded-2xl px-4 py-2.5 text-sm resize-none outline-none
                border border-white/10 focus:border-[#2AABEE]/50
                transition-colors duration-200
                min-h-[40px] max-h-[120px] overflow-y-auto
              "
              style={{ lineHeight: '1.5' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={enviarComentario}
              disabled={!texto.trim() || enviando}
              className="
                w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                bg-[#2AABEE] text-white
                disabled:opacity-30 disabled:cursor-not-allowed
                hover:bg-[#1d97d4] active:scale-95
                transition-all duration-150
              "
              aria-label="Enviar comentário"
            >
              {enviando ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────── MINI PLAYER FLUTUANTE ──────────── */}
      {playerAberto && obra.telegram_file_id && (
        <MiniPlayer
          telegramFileId={obra.telegram_file_id}
          title={obra.nome}
          apiBaseUrl={API_BASE_URL}
          onClose={() => setPlayerAberto(false)}
        />
      )}
    </div>
  );
}
