# Plano de Ajustes Finais + Revisão Pré-lançamento

## 1. Memória da Fama — tempo

`public/games/memoria-fama/game.js`:
- `GAME_DURATION`: 60 → **40s**
- Ajustar `SPEED_BONUS_THRESHOLD` de 30 → **20s** (manter proporção do bônus de velocidade que destrava cap de 3× entrada)
- Texto da tela MENU/instruções: "60 segundos" → "40 segundos"

## 2. Footer com 5 botões (adicionar Charts)

`src/routes/__root.tsx` → `BottomNav`:
- Nova ordem: **Hub · Artistas · Charts · Social · Rank**
- Charts vai ao centro (posição de destaque), ícone `TrendingUp`
- Reduzir padding horizontal interno dos itens pra caber bem em 360px (já usa `flex-1`, ok)

## 3. Remover "Charts" do hambúrguer

`__root.tsx` → categoria **Empire Coliseum**:
- Remover item `{ to: "/charts", label: "Charts", icon: TrendingUp }`
- Sobram: Duelos, Hall of Fame

## 4. Acesso Rápido — página dedicada `/acesso-rapido`

Criar `src/routes/acesso-rapido.tsx`:
- Header com ícone Telegram + título "Acesso Rápido"
- Grid de cards (2 colunas mobile) — cada card tem ícone, label e abre o link via `openExternal()` do `@/lib/telegram`
- Lista (8 canais):

  | Label | URL |
  |---|---|
  | News | https://t.me/empirenews1 |
  | Social | https://t.me/empiresocial1 |
  | Vídeos | https://t.me/+abAEzgGvI5E5MjA5 |
  | Álbuns | https://t.me/+g3oxVuzryNkwYzVh |
  | Singles | https://t.me/+b92qIsQP4BU3YjUx |
  | Eventos | https://t.me/empireeventos |
  | Avisos | https://t.me/empireinfos1 | 
  | Central de Ajuda | https://t.me/+LRE37LcEnOdmMWQx |

- Ícones distintos por tipo (Newspaper, MessageCircle, Video, Disc3, Music2, Calendar, Bell, LifeBuoy)

`__root.tsx` → menu hambúrguer:
- Inserir botão **Acesso Rápido** no TOPO (antes de Empire Studio), estilo destacado: card grande primário com ícone `Send` (Telegram), atalho rápido pra rota.

## 5. Revisão pré-lançamento — achados e correções

Varri `src/routes/`, `__root.tsx`, hub, lib. Pontos a corrigir/conferir:

### Críticos
- **SEO/meta duplicados**: `__root.tsx` declara `description`, `og:description`, `twitter:description` e `og:image` duas vezes (linhas 151–181). O segundo conjunto sobrescreve o primeiro mas suja o `<head>`. Deduplicar mantendo só a versão final.
- **Modais fora de `AnimatePresence` válido**: o bloco `showIdModal` está dentro de `<AnimatePresence>` mas sem `key` no `motion.div` raiz — anima abertura mas não saída. Adicionar `key` ou trocar pelo padrão usado em `GlobalLinkModal`.

### Importantes (UX comum em apps mobile)
- **Empty state global**: rotas como `/albuns`, `/playlists`, `/leiloes` precisam revisão pra garantir mensagem amigável quando lista vazia (revisar uma a uma na implementação).
- **Estado de erro de rede**: hoje vários `useEffect` com `.then(setX)` sem `.catch`. Adicionar fallback de erro padronizado pelo menos no Hub e Charts (Hub já tem, replicar padrão).
- **Pull-to-refresh**: não há gesto nativo; o botão sync no Hub cobre, mas confirmar que `/charts`, `/ranking`, `/social` têm botão de refresh visível.
- **Loading skeletons consistentes**: padrão dos charts é bom (`animate-pulse`); validar que todas as rotas usam (rapidão).
- **Safe-area**: BottomNav já trata `env(safe-area-inset-bottom)`. Top bar não tem `env(safe-area-inset-top)` — em iPhone com notch dentro do Telegram pode comer o conteúdo. Adicionar `pt-[env(safe-area-inset-top)]` no `<nav>` top.
- **Acessibilidade**: links externos do Acesso Rápido precisam `rel="noopener noreferrer"` e `aria-label`.
- **Botão hambúrguer**: já tem `aria-expanded` ✓.

### Pequenos polimentos
- **Tutorial**: link "Guia de Sobrevivência" só aparece no rodapé do menu — manter, mas garantir que primeiro acesso (sem `user.id` válido) sugere o tutorial.
- **Toaster**: posição `top-center` pode bater com top bar fixo (h-16). Ajustar `offset` ou trocar pra `bottom-center` (acima do BottomNav).
- **Versão do app no menu**: adicionar rodapé discreto com versão (ex: "v1.0.0") no fim do hambúrguer — útil pra suporte.

### Conferências (não bloqueiam, mas valem checar)
- 4 jogos integrados: confirmar que todos chamam `sync_game_coins` corretamente após premiação (paparazzi, hits, memória, queridômetro).
- Webhook do Apps Script: confirmar que casos `queridometro_status` e `queridometro_votar` foram adicionados ao `doPost` (responsabilidade tua no script).
- Imagens via `driveImg`: se Drive ficar fora do ar, app trava em alguns lugares — valeria um onError genérico que cai num placeholder local (small win).

## Arquivos que serão tocados

- `public/games/memoria-fama/game.js` (tempo)
- `public/games/memoria-fama/index.html` (texto "60s" se houver)
- `src/routes/__root.tsx` (BottomNav, hambúrguer, meta dedup, safe-area, toaster, versão, botão Acesso Rápido)
- `src/routes/acesso-rapido.tsx` (nova rota)

Após o "Implementar plano", aplico tudo de uma vez e te entrego um resumo curto do que mudou + o que fica como sugestão futura.
