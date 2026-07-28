/**
 * forum.tsx
 * Página de Fórum/Chat por tópicos de vídeos.
 * Fluxo:
 *   1. Lista os tópicos do fórum (cada tópico = um vídeo)
 *   2. Usuário clica num tópico → carrega mensagens
 *   3. Usuário envia mensagem → POST para Apps Script (sem Telegram direto)
 *   4. Upload de vídeo → FormData/JSON → Apps Script
 */

import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  listarTopicosForum,
  listarMensagensForum,
  enviarMensagemForum,
  uploadVideo,
} from "../lib/api.video";
import { listarVideos } from "../lib/api.video";
import { driveImg } from "../lib/api";
import type { TopicoForum, MensagemForum, VideoItem } from "../lib/types.video";

export const Route = createFileRoute("/forum")({ component: ForumPage });

const TIPOS_VIDEO = ["Music Video", "Lyric Video", "Live", "Short", "Clipe", "Outros"];

export default function ForumPage() {
  const [user] = useLocalStorage<{ nome: string; telegram_id: string } | null>("empire_user", null);

  // ── Estado principal ──
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [topicos, setTopicos] = useState<TopicoForum[]>([]);
  const [topicoAtivo, setTopicoAtivo] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemForum[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // ── Upload ──
  const [showUpload, setShowUpload] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    topicoId: "",
    nome: "",
    nomeDoCriador: "",
    tipo: "Music Video",
    thumbUrl: "",
    arquivoUrlExterna: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Chat ──
  const [inputMsg, setInputMsg] = useState("");
  const [replyTo, setReplyTo] = useState<MensagemForum | null>(null);
  const [sendingMsg, setSendingMsg] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Carrega tópicos + vídeos ──
  useEffect(() => {
    setLoading(true);
    Promise.all([listarTopicosForum(), listarVideos()])
      .then(([tops, vids]) => {
        setTopicos(tops);
        setVideos(vids);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Carrega mensagens do tópico ativo ──
  useEffect(() => {
    if (!topicoAtivo) return;
    setLoadingMsgs(true);
    listarMensagensForum(topicoAtivo)
      .then(setMensagens)
      .finally(() => setLoadingMsgs(false));
  }, [topicoAtivo]);

  // ── Scroll automático ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // ── helpers ──
  const videoDoTopico = (id: string) =>
    videos.find((v) => v.id === id);

  const topicoInfo = topicoAtivo ? topicos.find((t) => t.id === topicoAtivo) : null;
  const videoAtivo = topicoAtivo ? videoDoTopico(topicoAtivo) : null;

  // ── Enviar mensagem ──
  async function handleEnviarMsg(e: React.FormEvent) {
    e.preventDefault();
    if (!inputMsg.trim() || !topicoAtivo || !user) return;
    setSendingMsg(true);
    const optimistic: MensagemForum = {
      id: `opt_${Date.now()}`,
      user: user.nome,
      user_id: user.telegram_id,
      text: inputMsg.trim(),
      ts: Date.now(),
      reply_to: replyTo
        ? { id: replyTo.id, user: replyTo.user, text: replyTo.text }
        : undefined,
    };
    setMensagens((prev) => [...prev, optimistic]);
    setInputMsg("");
    setReplyTo(null);
    try {
      await enviarMensagemForum({
        topicoId: topicoAtivo,
        user: user.nome,
        userId: user.telegram_id,
        text: optimistic.text,
        replyTo: optimistic.reply_to,
      });
    } finally {
      setSendingMsg(false);
    }
  }

  // ── Upload de vídeo ──
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { setUploadMsg({ ok: false, text: "Faça login primeiro." }); return; }
    setUploadLoading(true);
    setUploadMsg(null);
    try {
      const result = await uploadVideo({
        topicoId: uploadForm.topicoId,
        nome: uploadForm.nome,
        nomeDoCriador: uploadForm.nomeDoCriador || user.nome,
        idDoCriador: user.telegram_id,
        tipo: uploadForm.tipo,
        thumbUrl: uploadForm.thumbUrl || undefined,
        arquivoUrlExterna: uploadForm.arquivoUrlExterna || undefined,
        arquivo: uploadFile ?? undefined,
      });
      if (result.ok) {
        setUploadMsg({ ok: true, text: "Vídeo enviado com sucesso! URL: " + (result.arquivo_url || "") });
        setShowUpload(false);
        // Recarrega vídeos
        listarVideos().then(setVideos);
      } else {
        setUploadMsg({ ok: false, text: result.erro || result.message || "Erro ao enviar." });
      }
    } catch (err: unknown) {
      setUploadMsg({ ok: false, text: String(err) });
    } finally {
      setUploadLoading(false);
    }
  }

  // ── Render ──
  return (
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-zinc-950 text-zinc-100">

      {/* ── Sidebar: lista de tópicos/vídeos ── */}
      <aside className="w-72 min-w-[220px] flex flex-col border-r border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <span className="font-semibold text-sm tracking-wide">Fórum de Vídeos</span>
          <button
            onClick={() => setShowUpload(true)}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 px-2 py-1 rounded transition-colors"
          >
            + Upload
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">Carregando…</div>
        ) : (
          <ul className="flex-1 overflow-y-auto">
            {/* Tópicos com vídeo associado */}
            {videos.map((v) => (
              <li key={v.id}>
                <button
                  onClick={() => setTopicoAtivo(v.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left ${
                    topicoAtivo === v.id ? "bg-zinc-800 border-l-2 border-emerald-500" : ""
                  }`}
                >
                  <img
                    src={driveImg(v.capa, 80) || v.capa || ""}
                    alt={v.nome || "Capa"}
                    className="w-10 h-10 rounded object-cover bg-zinc-700 flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {v.nome || <span className="text-zinc-500 italic">Sem título</span>}
                    </p>
                    <p className="text-xs text-zinc-400 truncate">
                      {v.nome_do_criador || <span className="text-zinc-600">—</span>}
                    </p>
                    <span className="text-[10px] text-zinc-500">{v.tipo}</span>
                  </div>
                </button>
              </li>
            ))}

            {/* Tópicos sem vídeo associado */}
            {topicos
              .filter((t) => !videos.find((v) => v.id === t.id))
              .map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setTopicoAtivo(t.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left ${
                      topicoAtivo === t.id ? "bg-zinc-800 border-l-2 border-emerald-500" : ""
                    }`}
                  >
                    <div className="w-10 h-10 rounded bg-zinc-700 flex-shrink-0 flex items-center justify-center text-zinc-400 text-xs">
                      💬
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.titulo || `Tópico ${t.id}`}</p>
                      <p className="text-xs text-zinc-500 truncate">{t.criador}</p>
                    </div>
                  </button>
                </li>
              ))}

            {videos.length === 0 && topicos.length === 0 && (
              <li className="px-4 py-8 text-center text-zinc-500 text-sm">
                Nenhum tópico encontrado.
              </li>
            )}
          </ul>
        )}
      </aside>

      {/* ── Painel de chat ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {topicoAtivo ? (
          <>
            {/* Header do tópico */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-zinc-800 bg-zinc-900">
              {videoAtivo?.capa && (
                <img
                  src={driveImg(videoAtivo.capa, 120) || videoAtivo.capa}
                  alt={videoAtivo.nome}
                  className="w-12 h-12 rounded object-cover"
                />
              )}
              <div>
                <h2 className="font-semibold text-base">
                  {videoAtivo?.nome || topicoInfo?.titulo || topicoAtivo}
                </h2>
                <p className="text-xs text-zinc-400">
                  {videoAtivo?.nome_do_criador || topicoInfo?.criador || ""}
                  {videoAtivo?.tipo && (
                    <span className="ml-2 px-1.5 py-0.5 bg-zinc-700 rounded text-[10px]">
                      {videoAtivo.tipo}
                    </span>
                  )}
                </p>
              </div>
              {videoAtivo?.arquivo_url && (
                <a
                  href={videoAtivo.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs bg-zinc-700 hover:bg-zinc-600 px-3 py-1.5 rounded transition-colors"
                >
                  ▶ Assistir
                </a>
              )}
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loadingMsgs ? (
                <p className="text-zinc-500 text-sm text-center py-8">Carregando mensagens…</p>
              ) : mensagens.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-zinc-500">
                  <span className="text-4xl mb-2">💬</span>
                  <p className="text-sm">Nenhuma mensagem ainda. Seja o primeiro!</p>
                </div>
              ) : (
                mensagens.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-0.5">
                    {msg.reply_to && (
                      <div className="ml-2 pl-2 border-l-2 border-zinc-600 text-zinc-400 text-xs">
                        <span className="font-medium">{msg.reply_to.user}</span>:{" "}
                        <span className="truncate">{msg.reply_to.text.slice(0, 60)}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2 group">
                      <div className="w-7 h-7 rounded-full bg-zinc-700 flex-shrink-0 flex items-center justify-center text-xs font-bold">
                        {msg.user?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-emerald-400">{msg.user}</span>
                          <span className="text-[10px] text-zinc-600">
                            {new Date(msg.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-200 break-words">{msg.text}</p>
                      </div>
                      <button
                        onClick={() => setReplyTo(msg)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 text-xs transition-opacity ml-1"
                        title="Responder"
                      >
                        ↩
                      </button>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input de mensagem */}
            <div className="border-t border-zinc-800 bg-zinc-900 px-4 py-3">
              {replyTo && (
                <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2 px-2 py-1 bg-zinc-800 rounded">
                  <span>↩ Respondendo {replyTo.user}:</span>
                  <span className="flex-1 truncate text-zinc-500">{replyTo.text.slice(0, 50)}</span>
                  <button onClick={() => setReplyTo(null)} className="text-zinc-500 hover:text-zinc-200">✕</button>
                </div>
              )}
              <form onSubmit={handleEnviarMsg} className="flex gap-2">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder={user ? "Digite uma mensagem…" : "Faça login para comentar"}
                  disabled={!user || sendingMsg}
                  className="flex-1 bg-zinc-800 text-zinc-100 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputMsg.trim() || !user || sendingMsg}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-medium transition-colors disabled:opacity-40"
                >
                  {sendingMsg ? "…" : "Enviar"}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-3">
            <span className="text-5xl">🎬</span>
            <p className="text-base">Selecione um tópico para entrar no chat</p>
            <p className="text-xs">ou clique em <strong>+ Upload</strong> para enviar um novo vídeo</p>
          </div>
        )}
      </main>

      {/* ── Modal de Upload ── */}
      {showUpload && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowUpload(false); }}
        >
          <div className="bg-zinc-900 rounded-xl w-full max-w-md p-6 border border-zinc-700 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-base">Upload de Vídeo</h3>
              <button onClick={() => setShowUpload(false)} className="text-zinc-400 hover:text-zinc-100 text-xl">✕</button>
            </div>

            {uploadMsg && (
              <div className={`mb-4 px-3 py-2 rounded text-sm ${
                uploadMsg.ok ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300"
              }`}>
                {uploadMsg.text}
              </div>
            )}

            <form onSubmit={handleUpload} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">ID do Tópico (telegram_topic_id) *</label>
                <input
                  required
                  type="text"
                  value={uploadForm.topicoId}
                  onChange={(e) => setUploadForm((f) => ({ ...f, topicoId: e.target.value }))}
                  placeholder="Ex: 12345"
                  className="bg-zinc-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Nome da Obra *</label>
                <input
                  required
                  type="text"
                  value={uploadForm.nome}
                  onChange={(e) => setUploadForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Título do vídeo"
                  className="bg-zinc-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Artista / Criador</label>
                <input
                  type="text"
                  value={uploadForm.nomeDoCriador}
                  onChange={(e) => setUploadForm((f) => ({ ...f, nomeDoCriador: e.target.value }))}
                  placeholder={user?.nome || "Nome do artista"}
                  className="bg-zinc-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Tipo</label>
                <select
                  value={uploadForm.tipo}
                  onChange={(e) => setUploadForm((f) => ({ ...f, tipo: e.target.value }))}
                  className="bg-zinc-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {TIPOS_VIDEO.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">URL da Capa/Thumbnail</label>
                <input
                  type="url"
                  value={uploadForm.thumbUrl}
                  onChange={(e) => setUploadForm((f) => ({ ...f, thumbUrl: e.target.value }))}
                  placeholder="https://..."
                  className="bg-zinc-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">URL externa do arquivo (Drive, .mp4)</label>
                <input
                  type="url"
                  value={uploadForm.arquivoUrlExterna}
                  onChange={(e) => setUploadForm((f) => ({ ...f, arquivoUrlExterna: e.target.value }))}
                  placeholder="https://drive.google.com/..."
                  className="bg-zinc-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Ou selecione o arquivo local</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-zinc-400 file:bg-zinc-700 file:text-zinc-200 file:rounded file:border-0 file:px-3 file:py-1.5 file:text-xs"
                />
                <p className="text-[10px] text-zinc-600">
                  O arquivo será enviado ao Apps Script → Telegram Bot → URL .mp4 será salva na planilha.
                </p>
              </div>

              <button
                type="submit"
                disabled={uploadLoading || !uploadForm.topicoId || !uploadForm.nome}
                className="mt-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded font-medium text-sm transition-colors disabled:opacity-40"
              >
                {uploadLoading ? "Enviando…" : "Enviar Vídeo"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
