# Fuga do Paparazzi → Subway Surfers Edition

Reescrever o jogo HTML5 atual em `public/games/paparazzi-escape/` substituindo a mecânica de endless runner lateral por uma visão 3/4 com 3 pistas, pulo e esquiva. Mantém entrada de 50 E$C, cashout via FUGIR, perda total ao bater, integração via `sync_game_coins` e a estética Neon Glassmorphism.

## Mecânica (clássico Subway Surfers)

- **3 pistas fixas** (esquerda / centro / direita). Personagem trava no eixo Z aparente, só muda de pista.
- **Inputs**:
  - Swipe ←/→ ou setas/A,D → trocar pista
  - Swipe ↑ ou ↑/Espaço → pulo (gravidade + arco)
  - Swipe ↓ ou ↓ → esquiva/rolagem (hitbox baixa por ~500ms)
- **Câmera fake 3/4**: projeção em perspectiva via escala+offset Y conforme distância (Z simulado em 2D Canvas, sem WebGL).
- **Obstáculos** distribuídos por pista, com 3 tipos:
  - `BARRICADE` (baixo) → precisa pular
  - `CAMERA_DRONE` (alto) → precisa esquivar
  - `BLOCK` (cheio) → precisa trocar de pista
- **Moedas** em fileiras de 3-5, posicionáveis em arcos (acima de barricadas).
- **Paparazzi perseguidor**: sprite atrás do player, "alcança" se o player tropeçar (animação de game over).
- **Velocidade** acelera com a distância. Spawner usa intervalo decrescente.

## Loop / Arquitetura

```
game.js
 ├─ Constantes (LANES_X, GRAVITY, JUMP_VY, SLIDE_MS, SPEED_BASE, SPEED_GROWTH)
 ├─ State (screen, player{lane,y,vy,sliding}, obstacles[], coins[], distance, sessionCoins, speed)
 ├─ Input Manager (touchstart/move/end → swipe; keydown) — separado do loop
 ├─ Spawner (gera obstáculos + linhas de moedas a cada N px)
 ├─ Physics tick (gravidade, slide timer, lane lerp)
 ├─ Collision (AABB por pista + altura, considerando jump/slide)
 ├─ Render (parallax 3 camadas + projeção 3/4 dos objetos por Z)
 └─ Economia (callEmpire/sync_game_coins — inalterado)
```

Mantém separação `update()` / `draw()` e debit/credit já existentes em `transactEmpireCoins` / `syncEmpireCoins`.

## Visual (mantém Neon Glass)

- Fundo: skyline noturno + camada de luzes neon + chão de avenida com listras em perspectiva (linhas convergindo ao horizonte).
- Player: silhueta neon com leve glow.
- Obstáculos: barricadas de show com fitas neon, drones-câmera com flash branco no impacto.
- Moedas: 🪙 com pulse glow.
- HUD: reaproveita `style.css` atual (saldo da partida + distância + botão FUGIR).

## Telas / fluxo (sem mudança)

`MENU → LOADING (debita 50) → RUNNING (HUD + FUGIR) → DEAD ou CASHOUT_LOADING → SUCCESS`. Reuso integral do `index.html` atual.

## Arquivos afetados

- `public/games/paparazzi-escape/game.js` → **reescrever** com novo motor 3-lanes.
- `public/games/paparazzi-escape/style.css` → pequenos ajustes (instruções de swipe no menu, ícones de pista).
- `public/games/paparazzi-escape/index.html` → atualizar bloco `.rules` (swipe ←/→, ↑ pular, ↓ esquivar).
- `src/routes/games.paparazzi-escape.tsx` → atualizar texto descritivo ("3 pistas, pule, esquive").
- `src/routes/games.index.tsx` → atualizar `description` do card.

Sem mudanças no Apps Script — `sync_game_coins` continua igual.

## Detalhes técnicos

- Projeção 3/4: para cada objeto com `z` (distância à frente), `screenY = horizonY + (canvasH-horizonY) * (1/(1+z*k))`, `scale = 1/(1+z*k)`, `screenX = laneCenterX(lane) * scale + canvasW/2 * (1-scale)`. Atualizar `z -= speed * dt` por frame; remover quando `z < -2`.
- Hitbox: colisão dispara quando `z` cruza o plano do player (`z ≈ 0`) e a pista bate, considerando `player.y` (pulo) ou `player.sliding`.
- Performance: limitar a ~30 obstáculos ativos, pool simples de objetos para evitar GC no mobile.
- Touch: detectar swipe com threshold 30px e `Math.abs(dx) vs dy` para distinguir lateral de vertical.
- Anti-doubleclick em FUGIR já existe — preservar.

## Fora de escopo

- Sem power-ups (ímã/escudo/hoverboard) — fica para iteração futura se você pedir.
- Sem trilha sonora nova.
- Sem alterações no backend.