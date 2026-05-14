## Plano de migração — Empire Hub

### Diagnóstico do repositório
- Stack: TanStack Router + React 19 + Tailwind v4 + Vite 7 + Express (SPA, sem SSR).
- Roteamento: `createHashHistory` (URLs `/#/...`).
- Dados: 100% client-side via `fetch` para o Apps Script (`src/lib/api.ts`). Nenhum `loader:` em rotas.
- Telegram: `src/lib/telegram.ts` já tenta SDK + URL params + `initData` + cache. Script `telegram-web-app.js` já está no `<head>` (`index.html` e `__root.tsx`).
- 50+ arquivos em `src/routes`, `src/components`, `src/lib`. Layout pronto (BottomNav, modais, motion).

### Diferença vs template Lovable
- Lovable usa TanStack **Start** (SSR no Cloudflare Workers) — não Express.
- `__root.tsx` precisa fornecer `<html><head><body>` via `shellComponent`.
- Não há `index.html`, `main.tsx`, nem `server.ts` próprio.
- Routing pode continuar com hash (compatível com SSR desativado).

### Etapas

**1. Limpar template e instalar dependências faltantes**
- Remover `src/routes/index.tsx` placeholder.
- Adicionar via `bun add`: `motion`, `sonner`, `canvas-confetti` + `@types/canvas-confetti`, `embla-carousel-react`, `recharts`, `cmdk`, `vaul`, `input-otp`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `date-fns`, `tw-animate-css` (a maior parte já existe; instalar só os ausentes).

**2. Copiar arquivos do repo**
- `src/lib/api.ts`, `src/lib/telegram.ts`, `src/lib/notify.ts` → tal e qual.
- `src/components/PlaylistEditor.tsx` → tal e qual.
- `src/hooks/use-mobile.tsx` → mantém (já existe equivalente, sobrescrever).
- Todas as 40+ rotas em `src/routes/*` → copiar inalteradas (já usam `createFileRoute` da TanStack Router, que é o mesmo import).
- `src/styles.css` → mesclar tokens, fonts e `@theme` do repo no `styles.css` atual (preservar Inter + Press Start 2P + cores oklch do Empire).

**3. Adaptar `__root.tsx`**
- Manter o pattern Lovable (`createRootRouteWithContext<{queryClient}>`, `RootShell` com `<html><head><body>`, `HeadContent`, `Scripts`).
- Portar todo o JSX de UI do repo (`GlobalLinkModal`, `BottomNav`, `Toaster`, header com `useTelegramUser`, motion).
- Incluir no `head()`: `telegram-web-app.js` script, fontes Google, meta `theme-color`, Open Graph.
- Adicionar `<html lang="pt-BR" class="dark">` para preservar dark mode.

**4. Configurar router e desabilitar SSR**
- Em `src/router.tsx`: adicionar `defaultSsr: false` ao `createRouter` (TanStack Start respeita) — todo o app renderiza só no cliente, evitando crash de `window`/`localStorage` durante SSR e mantendo o comportamento original do repo. Hash history pode ser opcionalmente removido (URLs ficam mais limpas) ou mantido para compatibilidade do bot atual — recomendo **remover hash history** (Telegram WebApp aceita URLs normais).
- Manter `QueryClientProvider` que já está no template.

**5. Telegram WebApp — auto ID**
- O hook `useTelegramUser` já cobre os 3 caminhos: SDK (`window.Telegram.WebApp.initDataUnsafe.user.id`), `?tgWebAppData` na URL/hash, e cache no `localStorage`.
- Garantir que o bot esteja configurado no BotFather com **Menu Button → Web App** apontando para a URL publicada do Lovable. O Telegram injeta `tgWebAppData` automaticamente quando aberto via botão do bot — nenhuma mudança de URL é necessária.
- Adicionar `tg.ready()` e `tg.expand()` no mount do root para tela cheia em mobile.

**6. Correção de bugs conhecidos**
- `useTelegramUser`: o array de fallback tem `params.get("tgid")` duplicado — limpar.
- Logs `console.log("DEBUG ...")` de produção — remover ou colocar atrás de `import.meta.env.DEV`.
- Cache `localStorage` pode servir dados de outro usuário entre testes — invalidar quando SDK retornar ID diferente.
- Em rotas que dependem de `user.id`, garantir guard `if (!ready) return loading` para evitar flash de "guest".

**7. Otimização mobile**
- Já existe `viewport-fit=cover`, `safe-area-inset-bottom` na BottomNav, `bg-background/85 backdrop-blur` — manter.
- Adicionar `overscroll-behavior: none` no body para evitar pull-to-refresh dentro do Telegram.
- Verificar zonas de toque (mínimo 44px) na BottomNav e modais.
- Lazy-load das imagens do Drive (`loading="lazy"` em `<img>`).

**8. Verificação final**
- Rodar build (auto pelo harness) e checar `routeTree.gen.ts` regenerado.
- Abrir preview e validar: home renderiza, BottomNav visível, modal de vincular abre, navegação entre rotas funciona, fonte Inter carregada.
- Testar com `?id=810141686` na URL (simula usuário Telegram) e ver se "Meus Artistas" carrega via Apps Script.

### Detalhes técnicos

- **Imports inalterados**: `@tanstack/react-router` é o mesmo pacote em Router e Start; `createFileRoute` funciona idêntico, então as 40+ rotas não precisam de edição.
- **Apps Script CORS**: o deployment já está como "Anyone" — fetch direto do browser funciona, não precisa proxy.
- **SSR off**: Lovable Start aceita `defaultSsr: false` no router; isso faz o Worker servir só o shell HTML e o cliente hidratar tudo. Equivalente ao SPA original.
- **Hash history**: removido — a URL do bot não muda, o Telegram passa `tgWebAppData` no fragment automaticamente e nosso hook lê tanto `?` quanto `#`.

### Próximas etapas (depois desta entrega)
Você disse que tem outras já pensadas — implementaremos uma a uma após essa base estar rodando.
