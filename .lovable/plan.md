## 1. Turnê — agenda realista, status automático e card melhor

### Backend (snippet Apps Script — eu te entrego pra colar)
Reescrever `compra_unificada_tour` para gerar a agenda com espaçamento realista por porte:

- **Indie** (~3k): 1 show a cada 7-12 dias.
- **Arena** (~20k): 1 show a cada 10-18 dias.
- **Estádio** (~60k): 1 show a cada 14-25 dias.

Intervalo entre shows é sorteado nessa faixa (não fixo), então a agenda cai em meses diferentes ao longo da turnê. Cada linha gravada: `{ data, local, capacidade, vendidos, faturamento }` — `data` no formato `YYYY-MM-DD` real, `vendidos` calculado por % aleatória plausível por porte (Indie 60-95%, Arena 70-98%, Estádio 80-100%), `faturamento` = vendidos × ticket médio do porte.

Adicionar função `tour_tick_status_()` que roda no `queridometro_status`/abertura de tela (ou no `agenda_tour`) e:
- Marca shows com `data <= hoje` como realizados, atualiza `show_atual` e `arrecadacao_total`.
- Quando `show_atual >= total_shows`, marca `status = "Concluída"`.
- Atualiza `local_atual` para a cidade do próximo show pendente.

### Frontend
`src/routes/tours.$nome.tsx`:
- Trocar o "MAI" hardcoded por mês real derivado de `s.data` (formato `dd/MMM`).
- Adicionar barra `vendidos / capacidade` (% + número absoluto) e `R$ acumulado` por show.
- Cabeçalho do itinerário: mostrar **arrecadação acumulada até o show atual** (não só total final).
- Recarregar `getAgendaTour` ao montar (sem cache) pra refletir tick de status.

`src/routes/acoes.tour.tsx`: adicionar hint "As datas são geradas automaticamente ao longo dos próximos meses" abaixo do campo Data de início.

## 2. Novo item no menu inferior: PONTO

`src/routes/__root.tsx` (BottomNav): adicionar `{ to: "/ponto", label: "Ponto", icon: Target }` (lucide). Layout passa a ter 6 itens — reduzir gap/icon size pra caber em mobile.

### Rotas novas

```
src/routes/ponto.index.tsx              → tela de entrada (valida tg_id, "Oi, X. O que quer fazer?")
src/routes/ponto.distribuir.tsx         → escolhe aleatório vs manual
src/routes/ponto.distribuir.planilha.tsx → grid editável da aba PONTOS
src/routes/ponto.playlists.tsx          → escolhe automático vs manual
src/routes/ponto.playlists.planilha.tsx → grid editável (ECOIN + INVESTIMENTO)
```

### Fluxo Pontos
1. **`/ponto`** chama `api.getJogador(tgId)` → lê aba `Jogadores` (A=artista, B=tg_id, C=nome OFF) e devolve `{ nomeOff, artistas: [...] }`. Mostra "Oi, {nomeOff}".
2. Duas opções: **Distribuir pontos** ou **Aplicar playlists**.
3. **Distribuir pontos → Aleatoriamente**: chama `api.distribuirPontosAleatorio(tgId)`. Apps Script sorteia % por categoria respeitando soma 100 por linha (uma linha por artista do jogador), grava na aba `PONTOS` e devolve "✅ Pontos atribuídos".
4. **Distribuir pontos → Manualmente**: vai pra grid editável. Carrega `api.listarPontosJogador(tgId)` → devolve só as linhas onde col C ∈ artistas do jogador, com todas as colunas da aba. Usuário edita células; cada blur dispara `api.salvarCelulaPontos({ tgId, artista, coluna, valor })` que grava direto na planilha (mantém validação de soma 100 server-side, devolve erro toast se passar). Grid usa as mesmas colunas/labels que a planilha tem hoje (read-only nas colunas que ele não pode mexer).

### Fluxo Playlists
1. **`/ponto/playlists`**: duas opções.
2. **Distribuir conforme meu saldo (auto)**: chama `api.distribuirPlaylistsAuto(tgId)`. Apps Script:
   - Lê saldo Empire Coin do jogador na aba `ECOIN + INVESTIMENTO` (col D dado artista selecionado em C).
   - Para cada artista do jogador, identifica a **música mais recente** (E) e atribui a **playlist máxima** disponível em cada plataforma; sobrando saldo, distribui pra músicas anteriores em ordem decrescente de data até esgotar.
   - Grava apenas linhas vazias (não conflita com outros jogadores).
   - Devolve resumo "✅ N playlists atribuídas para X artistas".
3. **Distribuir manualmente**: grid editável da aba `ECOIN + INVESTIMENTO`. Carrega `api.listarPlaylistsJogador(tgId)` (linhas dos artistas do jogador). Colunas C, E, G, I, K editáveis; demais read-only mas visíveis. Cada edit chama `api.salvarCelulaPlaylist({ tgId, linha, coluna, valor })`. Server-side: só grava se a célula estava vazia OU pertence a esse jogador (evita pisar em outro player).

### `src/lib/api.ts` — novos endpoints
```ts
getJogador(tgId)
listarPontosJogador(tgId)
salvarCelulaPontos({ tgId, artista, coluna, valor })
distribuirPontosAleatorio(tgId)
listarPlaylistsJogador(tgId)
salvarCelulaPlaylist({ tgId, linha, coluna, valor })
distribuirPlaylistsAuto(tgId)
```

Todos batem no mesmo `SCRIPT_URL` (Apps Script), nenhum acessa Google Sheets direto (mantém padrão do projeto).

### Apps Script (snippets que eu te entrego)
- Spreadsheet alvo: `1wNbtP78MrtrOc2Jb1ejXcHVjqndR2Vm4-3EIVqa8aOg` (abas `Jogadores`, `PONTOS`, `ECOIN + INVESTIMENTO`). Constante no topo do script.
- Funções `acao_get_jogador_`, `acao_listar_pontos_jogador_`, `acao_salvar_celula_pontos_`, `acao_distribuir_pontos_aleatorio_`, `acao_listar_playlists_jogador_`, `acao_salvar_celula_playlist_`, `acao_distribuir_playlists_auto_` + roteamento no `doGet/doPost`.

## Pendência

As duas imagens da aba `ECOIN + INVESTIMENTO` que você mencionou não chegaram. Vou seguir com a descrição em texto (C=artista, D=saldo, E=música, distribuir do mais recente pro mais antigo, respeitando colunas livres). Se o layout real divergir, ajusto o snippet do Apps Script depois.

## Ordem de implementação
1. UI nova (rotas `/ponto/*`) + tipagens em `api.ts` + item no BottomNav.
2. Card de turnê melhorado (frontend puro).
3. Te entregar todos os snippets Apps Script num único bloco no fim, prontos pra colar.
