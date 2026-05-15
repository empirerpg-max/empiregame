/* ================================================
   FUGA DO PAPARAZZI — Subway Surfers Edition
   3 pistas + pulo + esquiva, projeção 3/4 em Canvas 2D
   State: MENU → LOADING → RUNNING → CASHOUT_LOADING → DEAD/SUCCESS
================================================ */

const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwxbkUndhZPtFvtK1uIFTkPNN-m6WeiFVMU3IDzuahsC0oQp8Ba2GLQFOAPkWv8eiA3/exec';

const URL_PARAMS = new URLSearchParams(window.location.search);
const TELEGRAM_ID = (URL_PARAMS.get('tg') || 'guest').trim();
const ARTIST_NAME = (URL_PARAMS.get('artist') || '').trim();

// ─── CONSTANTES ──────────────────────────────
const ENTRY_FEE     = 50;
const COIN_VALUE    = 5;

const LANE_COUNT    = 3;
const LANE_OFFSET   = 0.18;   // distância das pistas laterais ao centro (em fração da largura)
const HORIZON_RATIO = 0.32;   // y do horizonte (% da altura)
const FLOOR_RATIO   = 0.92;   // y do plano do player (% da altura)

const PERSPECTIVE_K = 0.55;   // intensidade da perspectiva (1/(1+z*k))
const Z_SPAWN       = 9;      // profundidade onde objetos surgem
const Z_DESPAWN     = -0.6;   // profundidade onde somem (atrás do player)

const SPEED_BASE    = 6.5;    // unidades de Z por segundo
const SPEED_GROWTH  = 0.05;   // aceleração por segundo
const SPEED_MAX     = 16;

const GRAVITY       = 38;     // aceleração vertical (em "unidades" do mundo)
const JUMP_VY       = -14;
const SLIDE_MS      = 520;
const LANE_LERP     = 14;     // velocidade de transição lateral

const SPAWN_INTERVAL_BASE = 0.95; // segundos entre spawns
const SPAWN_INTERVAL_MIN  = 0.45;

// ─── STATE ───────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
let W = 0, H = 0, HORIZON_Y = 0, FLOOR_Y = 0, ROAD_HALF = 0;
let PX = 4; // tamanho do "pixel" lógico (escala dos sprites)

// Desenha um retângulo "pixel" arredondado pro grid de PX
function px(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
// Desenha sprite a partir de matriz de chars + paleta. Cada char = 1 "pixel" de tamanho `s`.
function drawSprite(map, palette, x, y, s) {
  for (let row = 0; row < map.length; row++) {
    const line = map[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      const c = palette[ch];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x + col * s), Math.round(y + row * s), Math.ceil(s), Math.ceil(s));
    }
  }
}

let STATE = 'MENU';
let player = {
  lane: 1, laneVisual: 1,
  y: 0, vy: 0, onGround: true,
  slideUntil: 0,
};
let obstacles = []; // {z, lane, type:'BARRICADE'|'DRONE'|'BLOCK'}
let coins = [];     // {z, lane, y}
let particles = [];
let flashAlpha = 0;
let speed = SPEED_BASE;
let distance = 0, sessionCoins = 0;
let spawnAcc = 0, spawnInterval = SPAWN_INTERVAL_BASE;
let lastTime = 0, animId = null;
let playClicked = false, cashoutClicked = false;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  HORIZON_Y = H * HORIZON_RATIO;
  FLOOR_Y = H * FLOOR_RATIO;
  ROAD_HALF = W * 0.45;
}
window.addEventListener('resize', () => { resize(); ctx.imageSmoothingEnabled = false; initBackground(); });
resize();

// ─── PROJEÇÃO 3/4 ───────────────────────────
// Cada objeto tem coordenadas no "mundo": lane (-1..1), y (altura mundo), z (profundidade).
// Convertemos pra tela via fator de perspectiva.
function project(laneX, worldY, z) {
  const f = 1 / (1 + Math.max(0, z) * PERSPECTIVE_K);
  const screenX = W / 2 + laneX * ROAD_HALF * f;
  const screenY = HORIZON_Y + (FLOOR_Y - HORIZON_Y) * f - worldY * f * (FLOOR_Y - HORIZON_Y) * 0.05;
  return { x: screenX, y: screenY, scale: f };
}

function laneToX(lane) {
  // lane 0=esquerda, 1=centro, 2=direita → -1 / 0 / +1
  return (lane - 1) * (LANE_OFFSET / 0.18);
}

// ─── PARALLAX FUNDO ─────────────────────────
const skyline = [];
const neonLights = [];
function initBackground() {
  skyline.length = 0;
  for (let i = 0; i < 14; i++) {
    skyline.push({
      x: Math.random() * W * 1.4 - W * 0.2,
      w: 40 + Math.random() * 90,
      h: 60 + Math.random() * 130,
      hue: 240 + Math.random() * 60,
    });
  }
  neonLights.length = 0;
  for (let i = 0; i < 40; i++) {
    neonLights.push({
      x: Math.random() * W,
      y: HORIZON_Y - 8 + Math.random() * 14,
      hue: Math.random() * 360,
      r: 2 + Math.random() * 3,
      a: 0.3 + Math.random() * 0.6,
      vx: 20 + Math.random() * 30,
    });
  }
}

function drawBackground(dt) {
  // Céu
  const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  sky.addColorStop(0, '#04040e');
  sky.addColorStop(0.6, '#0a0820');
  sky.addColorStop(1, '#1a0a3a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, FLOOR_Y);

  // Skyline lento
  for (const b of skyline) {
    b.x -= speed * 4 * dt;
    if (b.x + b.w < 0) { b.x = W + Math.random() * 80; b.w = 40 + Math.random() * 90; }
    ctx.fillStyle = `hsl(${b.hue}, 35%, 10%)`;
    ctx.fillRect(b.x, HORIZON_Y - b.h, b.w, b.h);
    // janelinhas
    ctx.fillStyle = `hsla(${b.hue + 20}, 80%, 65%, 0.35)`;
    for (let wy = HORIZON_Y - b.h + 10; wy < HORIZON_Y - 6; wy += 12) {
      for (let wx = b.x + 4; wx < b.x + b.w - 6; wx += 10) {
        if (Math.random() > 0.7) ctx.fillRect(wx, wy, 3, 5);
      }
    }
  }

  // Linha do horizonte com neon
  for (const n of neonLights) {
    n.x -= n.vx * dt;
    if (n.x < -10) n.x = W + 10;
    ctx.save();
    ctx.globalAlpha = n.a;
    ctx.fillStyle = `hsl(${n.hue}, 100%, 65%)`;
    ctx.shadowBlur = 12; ctx.shadowColor = `hsl(${n.hue}, 100%, 70%)`;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ─── CHÃO COM PISTAS EM PERSPECTIVA ─────────
let roadOffset = 0;
function drawRoad(dt) {
  roadOffset = (roadOffset + speed * dt * 0.5) % 1;

  // Chão
  const ground = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
  ground.addColorStop(0, '#0c0820');
  ground.addColorStop(1, '#06030f');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

  // Linhas convergindo no horizonte (laterais + divisórias de pistas)
  const xs = [-1.5, -0.5, 0.5, 1.5]; // bordas laterais e divisórias entre pistas
  ctx.strokeStyle = 'rgba(255,75,170,0.35)';
  ctx.lineWidth = 1.5;
  for (const lx of xs) {
    const top = project(lx, 0, Z_SPAWN);
    const bot = project(lx, 0, 0);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bot.x, bot.y);
    ctx.stroke();
  }

  // "Cílios" das pistas (faixas tracejadas em perspectiva)
  ctx.fillStyle = 'rgba(75,240,255,0.25)';
  for (let i = 0; i < 12; i++) {
    const z = ((i + roadOffset) / 12) * Z_SPAWN;
    for (const lx of [-0.5, 0.5]) {
      const p = project(lx, 0, z);
      const sz = 2 + (1 - p.scale) * 0; // visual mínimo
      ctx.fillRect(p.x - 1, p.y - 1, 2 + (1 / (1 + z)) * 6, 2 + (1 / (1 + z)) * 4);
    }
  }

  // Linha do horizonte glow
  ctx.strokeStyle = 'rgba(75,240,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HORIZON_Y); ctx.lineTo(W, HORIZON_Y); ctx.stroke();
}

// ─── PLAYER ──────────────────────────────────
function drawPlayer() {
  // Posição lateral interpola entre lanes
  const laneX = laneToX(player.laneVisual);
  const p = project(laneX, player.y, 0);
  const baseSize = Math.min(W, H) * 0.07;

  const sliding = isSliding();
  const bodyH = sliding ? baseSize * 1.0 : baseSize * 1.7;
  const bodyW = sliding ? baseSize * 1.4 : baseSize * 0.9;

  ctx.save();
  // Sombra no chão
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(p.x, FLOOR_Y + 4, bodyW * 0.7, bodyW * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Corpo neon
  const cy = p.y - bodyH * 0.55;
  ctx.shadowBlur = 22; ctx.shadowColor = '#ff4baa';
  ctx.fillStyle = '#ff4baa';
  ctx.beginPath();
  ctx.ellipse(p.x, cy, bodyW * 0.5, bodyH * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cabeça (escondida quando deslizando)
  if (!sliding) {
    ctx.fillStyle = '#ffd5b8';
    ctx.beginPath();
    ctx.arc(p.x, cy - bodyH * 0.55, baseSize * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trail neon
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#4bf0ff';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 2, bodyW * 0.55, baseSize * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── OBSTÁCULOS / MOEDAS ─────────────────────
function spawn() {
  // Padrões: às vezes 2 obstáculos numa linha, deixando 1 pista livre
  const r = Math.random();
  if (r < 0.55) {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    obstacles.push(makeObstacle(lane, randomType()));
  } else if (r < 0.85) {
    // dois obstáculos, uma pista livre
    const free = Math.floor(Math.random() * LANE_COUNT);
    for (let l = 0; l < LANE_COUNT; l++) {
      if (l === free) continue;
      obstacles.push(makeObstacle(l, randomType()));
    }
  } else {
    // linha cheia de barricada (precisa pular tudo)
    for (let l = 0; l < LANE_COUNT; l++) obstacles.push(makeObstacle(l, 'BARRICADE'));
  }

  // Linha de moedas com 35% de chance
  if (Math.random() < 0.7) {
    const coinLane = Math.floor(Math.random() * LANE_COUNT);
    const arc = Math.random() < 0.4; // arco em cima de barricada
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const z = Z_SPAWN - 0.5 - i * 0.55;
      const y = arc ? Math.sin((i / (count - 1)) * Math.PI) * 6 : 0;
      coins.push({ lane: coinLane, z, y, alive: true });
    }
  }
}

function randomType() {
  const r = Math.random();
  if (r < 0.55) return 'BARRICADE'; // pular
  if (r < 0.85) return 'DRONE';     // esquivar
  return 'BLOCK';                   // trocar de pista
}

function makeObstacle(lane, type) {
  return { lane, z: Z_SPAWN, type };
}

function drawObstacle(o) {
  const laneX = laneToX(o.lane);
  if (o.type === 'BARRICADE') {
    const baseY = 0;
    const top   = 4;
    const a = project(laneX - 0.18, baseY, o.z);
    const b = project(laneX + 0.18, baseY, o.z);
    const c = project(laneX + 0.18, top,   o.z);
    const d = project(laneX - 0.18, top,   o.z);
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = '#ff4baa';
    const grd = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
    grd.addColorStop(0, '#2a0a3e');
    grd.addColorStop(1, '#ff4baa');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fill();
    // listra neon
    ctx.fillStyle = '#4bf0ff';
    ctx.fillRect((a.x + b.x) / 2 - 2, (a.y + c.y) / 2 - 2, 4, 4);
    ctx.restore();
  } else if (o.type === 'DRONE') {
    // Drone-câmera no alto: precisa esquivar (slide)
    const droneY = 14;
    const a = project(laneX - 0.14, droneY,     o.z);
    const b = project(laneX + 0.14, droneY,     o.z);
    const c = project(laneX + 0.14, droneY - 4, o.z);
    const d = project(laneX - 0.14, droneY - 4, o.z);
    ctx.save();
    ctx.shadowBlur = 16; ctx.shadowColor = '#4bf0ff';
    ctx.fillStyle = '#1a1040';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4bf0ff';
    ctx.lineWidth = 2; ctx.stroke();
    // lente
    ctx.fillStyle = '#ff4baa';
    ctx.beginPath();
    ctx.arc((a.x + b.x) / 2, (a.y + c.y) / 2, 4 * a.scale + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Flash branco quando próximo
    if (o.z < 1.2 && o.z > 0.6 && !o._flashed) {
      o._flashed = true;
      flashAlpha = Math.max(flashAlpha, 0.25);
    }
  } else {
    // BLOCK alto que ocupa tudo: precisa trocar de pista
    const top = 14;
    const a = project(laneX - 0.18, 0,   o.z);
    const b = project(laneX + 0.18, 0,   o.z);
    const c = project(laneX + 0.18, top, o.z);
    const d = project(laneX - 0.18, top, o.z);
    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = '#ff4466';
    const grd = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
    grd.addColorStop(0, '#3a0a1a');
    grd.addColorStop(1, '#ff4466');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffaaaa';
    ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
}

function drawCoin(c) {
  const laneX = laneToX(c.lane);
  const p = project(laneX, c.y + 6, c.z);
  const r = 12 * p.scale + 3;
  ctx.save();
  ctx.shadowBlur = 18; ctx.shadowColor = '#ffcc00';
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Ordena por z desc para desenhar do mais longe ao mais perto
function drawWorldObjects() {
  const all = [];
  for (const o of obstacles) all.push({ kind: 'O', z: o.z, ref: o });
  for (const c of coins) if (c.alive) all.push({ kind: 'C', z: c.z, ref: c });
  all.sort((a, b) => b.z - a.z);
  for (const item of all) {
    if (item.kind === 'O') drawObstacle(item.ref);
    else drawCoin(item.ref);
  }
}

// ─── INPUT ──────────────────────────────────
function moveLane(dir) {
  if (STATE !== 'RUNNING') return;
  player.lane = Math.max(0, Math.min(LANE_COUNT - 1, player.lane + dir));
}
function jump() {
  if (STATE !== 'RUNNING') return;
  if (!player.onGround) return;
  player.vy = JUMP_VY;
  player.onGround = false;
}
function slide() {
  if (STATE !== 'RUNNING') return;
  player.slideUntil = performance.now() + SLIDE_MS;
  // Se estiver no ar, aborta o pulo (cai mais rápido)
  if (!player.onGround) player.vy = Math.max(player.vy, 8);
}
function isSliding() {
  return performance.now() < player.slideUntil && player.onGround;
}

document.addEventListener('keydown', e => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); moveLane(-1); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); moveLane(1); }
  else if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') { e.preventDefault(); jump(); }
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); slide(); }
});

let touchStart = null;
const SWIPE_THRESHOLD = 28;
canvas.addEventListener('touchstart', e => {
  const t = e.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY, t: performance.now() };
}, { passive: true });
canvas.addEventListener('touchend', e => {
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (Math.max(adx, ady) < SWIPE_THRESHOLD) {
    // tap = pulo (mais intuitivo no mobile)
    jump();
  } else if (adx > ady) {
    moveLane(dx > 0 ? 1 : -1);
  } else {
    if (dy < 0) jump(); else slide();
  }
  touchStart = null;
}, { passive: true });

// ─── PARTICLES ───────────────────────────────
class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y; this.color = color;
    this.vx = (Math.random() - 0.5) * 200;
    this.vy = Math.random() * -160 - 40;
    this.life = 1; this.decay = 2 + Math.random();
    this.size = 3 + Math.random() * 4;
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 380 * dt; this.life -= this.decay * dt; }
  draw() {
    if (this.life <= 0) return;
    ctx.save(); ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.restore();
  }
}

// ─── COLLISIONS ──────────────────────────────
// player ocupa z ~ 0; consideramos colisão quando obstáculo cruza [-0.4, 0.4]
function checkCollisions() {
  const sliding = isSliding();
  const inAir   = !player.onGround;
  for (const o of obstacles) {
    if (o.lane !== player.lane) continue;
    if (o.z > 0.45 || o.z < -0.4) continue;
    if (o.type === 'BARRICADE') {
      // bate se NÃO estiver pulando
      if (!inAir) return true;
    } else if (o.type === 'DRONE') {
      // bate se NÃO estiver deslizando
      if (!sliding) return true;
    } else { // BLOCK
      // sempre bate (precisa trocar de pista)
      return true;
    }
  }
  return false;
}

function checkCoins() {
  for (const c of coins) {
    if (!c.alive) continue;
    if (c.lane !== player.lane) continue;
    if (c.z > 0.45 || c.z < -0.4) continue;
    // moeda em arco: se altura do player + jump compensa pouco
    c.alive = false;
    sessionCoins += COIN_VALUE;
    const laneX = laneToX(c.lane);
    const p = project(laneX, c.y + 6, c.z);
    for (let i = 0; i < 10; i++) particles.push(new Particle(p.x, p.y, '#ffcc00'));
    updateHUD();
  }
}

// ─── HUD ─────────────────────────────────────
function updateHUD() {
  document.getElementById('hud-coins').textContent = `${sessionCoins} 🪙`;
  document.getElementById('hud-dist').textContent = `${Math.floor(distance)}m`;
}

// ─── LOOP ────────────────────────────────────
function update(dt) {
  // Velocidade global
  speed = Math.min(SPEED_MAX, speed + SPEED_GROWTH * dt);
  distance += speed * dt * 1.6;

  // Player vertical
  player.vy += GRAVITY * dt;
  player.y -= player.vy * dt;
  if (player.y <= 0) { player.y = 0; player.vy = 0; player.onGround = true; }

  // Lane visual interpola
  player.laneVisual += (player.lane - player.laneVisual) * Math.min(1, LANE_LERP * dt);

  // Mundo
  for (const o of obstacles) o.z -= speed * dt;
  for (const c of coins)     c.z -= speed * dt;
  obstacles = obstacles.filter(o => o.z > Z_DESPAWN);
  coins     = coins.filter(c => c.z > Z_DESPAWN && c.alive);

  // Spawn
  spawnInterval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_BASE - distance * 0.0005);
  spawnAcc += dt;
  if (spawnAcc >= spawnInterval) { spawnAcc = 0; spawn(); }

  // Partículas
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) p.update(dt);

  // Colisão
  if (checkCollisions()) { triggerDead(); return false; }
  checkCoins();

  return true;
}

function draw(dt) {
  drawBackground(dt);
  drawRoad(dt);
  drawWorldObjects();
  drawPlayer();
  for (const p of particles) p.draw();

  // Flash branco (câmeras / drones)
  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0, 0, W, H);
    flashAlpha = Math.max(0, flashAlpha - 2.5 * dt);
  }
}

function gameLoop(ts) {
  if (STATE !== 'RUNNING') return;
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  const alive = update(dt);
  if (!alive) return;
  draw(dt);
  updateHUD();
  animId = requestAnimationFrame(gameLoop);
}

// ─── ECONOMIA ────────────────────────────────
async function callEmpire(payload) {
  try {
    const res = await fetch(WEBHOOK_URL, { method: 'POST', body: JSON.stringify(payload) });
    if (!res.ok) return { ok: false, erro: 'HTTP ' + res.status };
    const txt = await res.text();
    try { return JSON.parse(txt); } catch (_) { return { ok: false, erro: 'Resposta inválida' }; }
  } catch (e) { return { ok: false, erro: e.message || 'Falha de rede' }; }
}

async function syncEmpireCoins(telegramId, wagerAmount, wonAmount) {
  const r = await callEmpire({
    acao: 'sync_game_coins',
    telegram_id: telegramId,
    wager: wagerAmount,
    won: wonAmount,
    gameContext: 'Fuga do Paparazzi',
    artistName: ARTIST_NAME,
  });
  return r && r.ok === true;
}

async function deductEntry() {
  if (!ARTIST_NAME) {
    alert('Nenhum artista selecionado. Volte ao menu e escolha um artista.');
    return false;
  }
  const ok = await syncEmpireCoins(TELEGRAM_ID, ENTRY_FEE, 0);
  if (!ok) alert('Não foi possível debitar a entrada. Saldo insuficiente ou falha de rede.');
  return ok;
}

// ─── TRANSIÇÕES ──────────────────────────────
async function startGame() {
  if (playClicked) return;
  playClicked = true;
  STATE = 'LOADING';
  showScreen('screen-loading');

  const ok = await deductEntry();
  if (!ok) { STATE = 'MENU'; showScreen('screen-menu'); playClicked = false; return; }

  // Reset
  player = { lane: 1, laneVisual: 1, y: 0, vy: 0, onGround: true, slideUntil: 0 };
  obstacles = []; coins = []; particles = [];
  speed = SPEED_BASE; distance = 0; sessionCoins = 0;
  spawnAcc = 0; spawnInterval = SPAWN_INTERVAL_BASE;
  flashAlpha = 0;
  cashoutClicked = false;
  initBackground();
  updateHUD();

  STATE = 'RUNNING';
  showScreen(null);
  document.getElementById('hud').classList.remove('hidden');

  lastTime = performance.now();
  animId = requestAnimationFrame(gameLoop);
}

async function triggerCashout() {
  if (STATE !== 'RUNNING' || cashoutClicked) return;
  cashoutClicked = true;
  STATE = 'CASHOUT_LOADING';
  if (animId) cancelAnimationFrame(animId);
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('cashout-amount').textContent = `+${sessionCoins} 🪙`;
  showScreen('screen-cashout');

  await syncEmpireCoins(TELEGRAM_ID, 0, sessionCoins);

  showScreen('screen-success');
  document.getElementById('success-prize').textContent = `+${sessionCoins} 🪙`;
  document.getElementById('success-dist').textContent = `Distância: ${Math.floor(distance)}m`;
  document.getElementById('success-saving').classList.add('hidden');
  document.getElementById('btn-play-again').disabled = false;
}

async function triggerDead() {
  STATE = 'DEAD';
  if (animId) cancelAnimationFrame(animId);
  document.getElementById('hud').classList.add('hidden');
  flashAlpha = 0.95;
  ctx.fillStyle = `rgba(255,255,255,0.95)`;
  ctx.fillRect(0, 0, W, H);

  showScreen('screen-dead');
  document.getElementById('dead-coins').textContent = `Perdeu: ${ENTRY_FEE} 🪙 + ${sessionCoins} 🪙 coletadas`;
  document.getElementById('dead-saving').classList.add('hidden');
  document.getElementById('btn-retry').disabled = false;
}

function goToMenu() {
  STATE = 'MENU';
  playClicked = false;
  cashoutClicked = false;
  if (animId) cancelAnimationFrame(animId);
  document.getElementById('hud').classList.add('hidden');
  obstacles = []; coins = []; particles = [];
  ctx.clearRect(0, 0, W, H);
  showScreen('screen-menu');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if (id) document.getElementById(id)?.classList.add('active');
}

document.getElementById('btn-play').addEventListener('click', startGame);
document.getElementById('btn-cashout').addEventListener('click', triggerCashout);
document.getElementById('btn-retry').addEventListener('click', goToMenu);
document.getElementById('btn-menu-dead').addEventListener('click', goToMenu);
document.getElementById('btn-play-again').addEventListener('click', goToMenu);
document.getElementById('btn-menu-suc').addEventListener('click', goToMenu);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && STATE === 'RUNNING' && animId) cancelAnimationFrame(animId);
});

// Init
showScreen('screen-menu');
initBackground();
drawBackground(0);
drawRoad(0);
