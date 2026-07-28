// src/types/play.ts
// Interfaces ajustadas para corresponder às chaves retornadas pelo backend GAS

export interface PlayItem {
  id: string;
  titulo: string;
  artista: string;
  capa: string;
  audioSrc: string;
  letra?: string;
  categoria: "musica" | "musicvideo" | "video";
}

/** Resposta bruta do backend para Músicas */
export interface RawMusica {
  id_do_topico?: string;
  nome_da_musica?: string;
  act_principal?: string;
  /** alias principal enviado pelo backend */
  nome_do_criador?: string;
  id_do_criador?: string;
  capa_da_musica?: string;
  id_do_arquivo?: string;
  link_do_audio?: string;
  data_de_lancamento?: string;
  album?: string;
  letra?: string;
  [key: string]: string | undefined;
}

/** Resposta bruta do backend para Music Videos / Clipes */
export interface RawMusicVideo {
  id_do_topico?: string;
  /** Título do clipe — chave principal do backend */
  titulo?: string;
  tipo_de_clipe?: string;
  nome_do_clipe?: string;
  /** Artista / criador — chave principal do backend */
  nome_do_criador?: string;
  act_principal?: string;
  id_do_criador?: string;
  thumbnail_url?: string;
  capa?: string;
  telegram_file_id?: string;
  youtube_url?: string;
  drive_url?: string;
  link_do_video?: string;
  data_de_lancamento?: string;
  weeks_video?: string;
  [key: string]: string | undefined;
}

/** Comentário normalizado vindo do fórum */
export interface ForumComentario {
  /** Mapeado de id_do_topico no backend */
  idTopico: string;
  /** Mapeado de nome_do_jogador no backend */
  nome: string;
  /** Mapeado de comentario no backend */
  texto: string;
  reacao?: string;
  timestamp?: string;
}

/** Payload de envio de novo comentário */
export interface NovoComentarioPayload {
  action: "novoComentario";
  categoria: string;
  idTopico: string;
  nomeJogador: string;
  comentario: string;
  emoji?: string;
}
