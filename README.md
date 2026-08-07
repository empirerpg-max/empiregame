# Empire Hub / Empire Play / Empire TV

Aplicativo web (Telegram Mini App + navegador) que roda o RPG musical **Empire**:
artistas, gravadoras, charts, turnês, bolsa de valores, catálogo de músicas/álbuns/clipes,
transmissões ao vivo e mini-games.

- **Preview:** https://id-preview--1dfc0f66-4a5d-4eee-afb1-75282af91d1d.lovable.app
- **Produção:** https://empiregame.lovable.app

---

## 1. Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | TanStack Start v1 (React 19 + SSR) |
| Build | Vite 7 |
| Runtime de produção | Cloudflare Workers (`wrangler.jsonc` → `src/server.ts`) |
| Estilo | Tailwind CSS v4 (`src/styles.css`, tokens semânticos) |
| UI | shadcn/ui + Radix + lucide-react + motion |
| Dados (jogo) | **Google Sheets** via Google Apps Script (2 Web Apps) |
| Dados (chat/realtime) | Lovable Cloud (Supabase): `tv_chat_messages`, realtime |
| Mídia | Google Drive (imagens/áudio) + Telegram (vídeos) |
| Gráficos | recharts |
| Cache de fetch | SWR + cache manual em `sessionStorage` |

---

## 2. Arquitetura em uma imagem

```text
                 ┌──────────────────────────────────────────┐
   Telegram      │  Frontend (TanStack Start / React)       │
   Mini App  ───▶│  src/routes/*.tsx  •  src/lib/api.ts     │
   ou browser    └───────┬───────────────┬──────────────┬────┘
                         │               │              │
        (A) Apps Script  │   (B) Worker  │   (C) Supabase
                         ▼               ▼              ▼
        ┌────────────────────────┐ ┌───────────────┐ ┌──────────────┐
        │ GAS Hub  + GAS TV      │ │ /api/* no     │ │ chat ao vivo │
        │ (Google Sheets)        │ │ Worker:       │ │ realtime     │
        │ DB_ARTISTAS, EMPRESAS, │ │ catalogo,     │ │              │
        │ BOLSA_LOG, REGISTROS,  │ │ empire-play,  │ └──────────────┘
        │ Agenda_TV, Musicas...  │ │ gestao, forum,│
        └────────────────────────┘ │ stream, media │
                                   └───────┬───────┘
                                           │
                            Google Sheets API (service account)
                            Google Drive API
                            Telegram Bot API (self-hosted) / MTProto proxy
```

### (A) Apps Script — coração do jogo
`src/lib/api.ts` fala com **dois** Web Apps distintos (propositalmente separados
para facilitar gestão):

- `SCRIPT_URL` → Empire Hub (artistas, saldo, market, turnês, bolsa, charts, ranking…)
- `TV_SCRIPT_URL` → Empire TV (aba `Agenda_TV`, presença, chat arquivado)

Protocolo: `GET/POST ?action=<nome>`. Respostas JSON com chaves em `snake_case`
sem acentos (geradas a partir dos cabeçalhos da planilha).
O código-fonte do Apps Script versionado no repo está em `scriptatual2.txt`
(cole no editor do Apps Script para publicar).

### (B) Worker (`src/server.ts` + `backend/`)
Rotas HTTP servidas pelo próprio app, usadas onde o Apps Script é lento ou tem
limite de payload:

- `/api/catalogo?action=albuns|musicas|videos|music_videos`
- `/api/empire-play/{home,user,musicas,music-videos,videos,albuns}`
- `/api/gestao/{musica,video,music-video,album,upload}`
- `/api/forum/{comment,comments}`
- `/api/stream/:id` → vídeo do Telegram
- `/api/media/audio?id=` → proxy de áudio do Drive com HTTP Range (seek)

Acesso ao Google usa **service account** (`backend/src/google/service-account.ts`).

### (C) Lovable Cloud (Supabase)
Usado só onde precisa ser instantâneo e persistente: chat ao vivo da TV
(`tv_chat_messages` + Realtime). Cliente: `@/integrations/supabase/client`.

---

## 3. Mapa de rotas

| Rota | O que faz |
| --- | --- |
| `/` | home / hub |
| `/artistas`, `/artistas/$nome`, `.../bens`, `.../projetos` | ficha do artista, patrimônio, projetos |
| `/gravadoras`, `/rescisao`, `/payola`, `/filantropia` | mecânicas de carreira |
| `/bolsa` | **bolsa de valores**: empresas + turnês, resultado do dia, acumulado |
| `/market`, `/leiloes` | compras e leilões |
| `/tours`, `/tours/$nome`, `/acoes/tour` | turnês |
| `/albuns`, `/album/$id`, `/album/$id/editar` | álbuns |
| `/catalogo`, `/catalogo/$id` | catálogo + fórum da obra (chat por tópico) |
| `/empire-play` | player de músicas/clipes (Telegram/Drive/YouTube) |
| `/tv` | Empire TV: browse estilo Netflix + watch estilo Twitch (player fixo + chat) |
| `/charts`, `/ranking`, `/hall`, `/radar`, `/social` | rankings e feeds |
| `/ponto/*` | distribuição de pontos e playlists |
| `/games/*` | hits-producer, memória-fama, paparazzi-escape, queridômetro |
| `/bet`, `/duelo` | apostas e duelos |

Charts legados em HTML puro vivem em `public/charts-app/`; games em `public/games/`.

---

## 4. Economia recorrente (Bolsa)

Implementada no Apps Script:

- Aba `EMPRESAS`: `id | dono | nome | segmento | capital_inicial | valor_atual | lucro_acumulado | criada_em | ativa`
- Aba `BOLSA_LOG`: `data | artista | tipo (EMPRESA/TOUR) | ref_id | resultado_dia | saldo_apos`
- `tickBolsaDiario()` (trigger time-driven diário):
  `resultado = valor_atual * (volBase*(rand*2-1) + tendenciaGlobal + min(prestigio/2000, 0.02))`
  - volatilidade por segmento: tech ±12%, beauty ±7%, food ±3%
  - tendência global do dia: −3% a +3% (um único sorteio para todo o mercado)
  - o resultado é **creditado na coluna `saldo` de `DB_ARTISTAS`** (pró-labore → entra na fortuna)
  - turnês entram no mesmo log com `tipo=TOUR`, a partir de `CONTROLE_TOURS`
- Empresa que zera 3 dias seguidos → `ativa=false` (falência) + entrada no `RADAR_FEED`

`/bolsa` consome `listar_empresas`, `minhas_empresas`, `historico_bolsa`.

---

## 5. Vídeo do Telegram (caminho crítico de performance)

Regra de ouro: **o play nunca deve depender de leitura de planilha.**

1. A listagem (`/api/empire-play/*`) já devolve `telegram_file_id`,
   `arquivo_fonte` normalizado (`telegram | drive | youtube`) e o link externo tratado.
2. `VideoPlayer.tsx` monta `/api/stream/<id>?fonte=<fonte>` com esses valores já resolvidos.
3. `streamVideoController` decide pelo formato do id:
   - numérico → rota MTProto legada (`LEGACY_TELEGRAM_PROXY_URL`, blocos de 128 KB alinhados)
   - opaco ≥20 chars → Bot API local (`BOT_API_BASE_URL`)
   - `http(s)://` → Drive/YouTube
   - **fallback** (só links antigos de localStorage): busca nas abas `Music Videos`/`Videos`

Se essa leitura de Sheets voltar ao caminho principal, o TTFB do play sobe 1–3 s
e o `<video>` passa a travar/re-tentar. Já foi bug; não reintroduza.

---

## 6. Dependências externas (do que o app depende)

| Dependência | Sem ela… |
| --- | --- |
| Apps Script Hub publicado | quase todo o jogo para de carregar |
| Apps Script TV publicado | `/tv` sem grade, sem presença, sem arquivo |
| Planilha principal (`1onh3Jy…`) | fonte de verdade de tudo |
| Service account Google (Sheets + Drive habilitados) | rotas `/api/*` do Worker falham |
| `BOT_TOKEN` + `BOT_API_BASE_URL` (telegram-bot-api self-hosted) | vídeos novos não tocam; uploads >20 MB impossíveis |
| `LEGACY_TELEGRAM_PROXY_URL` + `LEGACY_TELEGRAM_CHANNEL_ID` | vídeos legados não tocam |
| Lovable Cloud (Supabase) | chat ao vivo sem realtime/persistência |
| Kick (`kick.com/empiretvoficial`) | sem embed quando está ao vivo |
| Google Drive público | capas e áudios quebram |

Variáveis: ver `.env.example`. Em produção elas são injetadas no Worker
(nunca use `process.env` no browser — só `import.meta.env.VITE_*`).

---

## 7. Gargalos conhecidos

1. **Apps Script é o maior gargalo.** Cota diária, ~6 min por execução, resposta
   limitada e latência de 1–3 s por chamada. Mitigações no app: SWR + cache em
   `sessionStorage`, e migração das listagens pesadas para o Worker.
2. **Leitura de planilha no caminho de play/render.** Sheets é armazenamento lento;
   nunca leia dentro de render, `setInterval` curto ou no clique de play.
3. **Google Sheets é a única fonte de verdade.** Sem transações: duas gravações
   concorrentes no mesmo saldo podem se sobrescrever.
4. **Mídia no Google Drive.** Rate limit e HTML de "quota exceeded" em vez de bytes;
   o proxy de áudio tem fallback para `lh3.googleusercontent.com`.
5. **Telegram self-hosted é ponto único de falha.** Se a VPS cai, todo o vídeo cai.
6. **Cloudflare Workers ≠ Node.** Sem `child_process`, `sharp`, `fs.watch`, binários
   nativos. Nunca configurar `ssr.external`/`resolve.external`.
7. **Chaves em `snake_case` sem acentos** vindas dos cabeçalhos da planilha:
   renomear uma coluna quebra a tela silenciosamente. Por isso o código usa
   cadeias de fallback (`nome_da_musica || nome_do_video || titulo || …`).
8. **Peso do bundle** (Radix + recharts + motion) pesa em celular fraco;
   preferir import dinâmico para telas pesadas.
9. **Chat da TV permite insert anônimo** por decisão de produto (Mini App sem login).
   Não é finding de segurança aqui; se abrir para a web pública, revisar RLS.

---

## 8. Direcionamentos (regras para quem mexer)

- **Não quebre o contrato com a planilha.** A estrutura já existe há muito tempo:
  ao mudar tela, mantenha os `action=` e os nomes de abas (`Agenda_TV`, `Musicas`,
  `Albuns`, `Music Videos`, `Comentarios_Videos`, `Top_Videos_YT`, `EMPRESAS`, `BOLSA_LOG`).
- **Um Apps Script por domínio.** Hub e TV têm URLs próprias — não unifique.
- Rotas em `src/routes/`; nunca editar `src/routeTree.gen.ts`.
- Cada rota de conteúdo precisa do próprio `head()` com título e descrição únicos.
- Cores só via tokens de `src/styles.css` — nada de `text-white`/`bg-[#...]`.
- Lógica de servidor interna: `createServerFn` de `@tanstack/react-start`.
  Webhooks/cron/API pública: `src/routes/api/public/*` (com verificação do chamador).
- Toda nova tabela no Postgres precisa de `GRANT` + RLS na mesma migration.
- Ler Sheets: sob demanda, com cache; parar após 4xx repetido; backoff em 429/5xx.
- Identidade visual: escuro, vidro (`backdrop-blur`), pills, tipografia black/uppercase
  em rótulos. O `/tv` mistura Netflix (browse) + Twitch (watch).

---

## 9. Rodando localmente

```bash
bun install
cp .env.example .env   # preencha as chaves
bun run dev            # http://localhost:8080
```

Scripts: `dev`, `build`, `build:dev`, `preview`, `lint`, `format`.
Em dev, `/api/catalogo` é proxyado direto para o Apps Script (`vite.config.ts`),
evitando CORS.

---

## 10. Onde olhar quando quebra

| Sintoma | Primeiro lugar |
| --- | --- |
| Tela branca / 500 em `/src/styles.css` | erro de transform do Vite; reiniciar dev server |
| Lista vazia mas sem erro | mapeamento de chave mudou → `src/lib/api.ts` + cabeçalho da planilha |
| Vídeo demora/trava | `mediaController.ts` (leitura de Sheets voltou?) + VPS do Telegram |
| Áudio sem seek | `/api/media/audio` (header `Range` / 206) |
| `/tv` sem grade | `Agenda_TV` + `TV_SCRIPT_URL` publicado |
| Chat não atualiza | Realtime do Supabase em `tv_chat_messages` |
| Build falha em `routeTree.gen.ts` | há erro de sintaxe/import em alguma rota |
