# Plano: deixar o app mais fluido — sem custo

Sem migrar nada pra Lovable Cloud. Todas as melhorias são no frontend (código que já roda no teu projeto), portanto **0 custo adicional**. O backend continua no teu Apps Script como está.

## O que vou fazer

### 1. Lazy loading em todas as imagens (~50 `<img>`)
Hoje o navegador baixa **todas** as fotos de artistas/álbuns/capas assim que a rota carrega, mesmo as que estão fora da tela. Adicionar `loading="lazy"` e `decoding="async"` faz o navegador só baixar quando o usuário rolar até elas.

**Impacto:** carregamento inicial muito mais rápido em `/artistas`, `/albuns`, `/playlists`, `/ranking`, `/hall`.

**Arquivos:** varrer `src/routes/*.tsx` e `src/components/*.tsx` adicionando os atributos onde faltarem.

### 2. Iframe do `/charts` com lazy load
Hoje o iframe do mini-app de charts carrega imediatamente. Adicionar `loading="lazy"` adia até o usuário entrar na rota.

**Arquivo:** `src/routes/charts.tsx`

### 3. Pré-carregamento inteligente de rotas (já parcialmente feito)
Já configurei `defaultPreload: "intent"` no router. Vou complementar com **prefetch on hover** nos links principais do BottomNav, pra que ao passar o dedo no ícone, a próxima rota já comece a baixar.

**Arquivo:** `src/routes/__root.tsx`

### 4. Cache mais agressivo nos endpoints "frios"
Endpoints como `gravadoras`, `hall`, `tutorial` mudam pouquíssimo. Vou aumentar o cache desses pra **5 minutos** (hoje são 60s). Endpoints "quentes" (saldo, social) ficam em 60s.

**Arquivo:** `src/lib/api.ts` — adicionar map de TTLs por endpoint.

### 5. Skeleton loaders consistentes
Algumas rotas mostram tela em branco enquanto carregam (sensação de travado). Vou padronizar o esqueleto `animate-pulse` que já uso nos charts em: Hub, `/social`, `/ranking`, `/albuns`.

**Sensação de velocidade** melhora muito mesmo sem mudar tempo real de carregamento.

### 6. Otimização de imagens via Drive (`driveImg`)
As fotos vêm do Google Drive em tamanho original (pesadas demais pra thumbnail). Vou ajustar o helper `driveImg` pra adicionar parâmetro `=w200` (ou similar) quando a imagem for usada como avatar/thumb pequena, fazendo o Drive servir uma versão reduzida automaticamente.

**Arquivo:** `src/lib/api.ts` (ou onde `driveImg` estiver definido).

**Impacto:** essa é provavelmente a mudança de maior impacto — algumas fotos hoje têm 2-5 MB cada.

### 7. Memoização de listas pesadas
Listas de artistas/álbuns re-renderizam a cada mudança de estado. Vou aplicar `React.memo` + `useMemo` nas células de lista mais usadas.

**Arquivos:** componentes de card de artista, álbum, playlist.

## O que NÃO vou fazer
- Mexer no Apps Script (você confirmou que está ok).
- Ativar Lovable Cloud.
- Adicionar dependências novas (mantém o bundle leve).

## Sobre a lentidão "estrutural" do Apps Script
Pra ser 100% transparente: **o teto de velocidade do app é o cold start do `script.google.com`** (1-3s na primeira chamada após inatividade). Isso só some migrando endpoints pra Cloud — mas como você não quer custo, as 7 melhorias acima vão deixar a navegação **dentro** do app fluida, e a primeira chamada continua dependendo do Google.

## Resultado esperado
- Primeira renderização: ~30-50% mais rápida (lazy loading + `driveImg` redimensionado).
- Navegação entre rotas já visitadas: instantânea (cache + prefetch).
- Sensação geral: muito mais fluida graças aos skeletons.

Posso seguir?
