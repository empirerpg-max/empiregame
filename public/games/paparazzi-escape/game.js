/* ================================================
   FUGA DO PAPARAZZI — game.js
   State Machine: MENU → LOADING → RUNNING → CASHOUT_LOADING → DEAD/SUCCESS
================================================ */

// ─── CONSTANTES ──────────────────────────────
// Mesma URL do Apps Script usada por src/lib/api.ts e pelos outros jogos.
const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwxbkUndhZPtFvtK1uIFTkPNN-m6WeiFVMU3IDzuahsC0oQp8Ba2GLQFOAPkWv8eiA3/exec';

// Identificação vinda da rota React (?tg=...&artist=...)
const URL_PARAMS = new URLSearchParams(window.location.search);
const TELEGRAM_ID = (URL_PARAMS.get('tg') || 'guest').trim();
const ARTIST_NAME = (URL_PARAMS.get('artist') || '').trim();

const ENTRY_FEE = 50;
const GRAVITY = 1400;       // px/s²
const JUMP_FORCE = -560;    // px/s
const PLAYER_X_RATIO = 0.2; // posição X do jogador (20% da tela)
const GAP_START = 0.42;     // gap inicial (% da altura)
const GAP_MIN = 0.22;       // gap mínimo
const GAP_SHRINK = 0.004;   // redução do gap por obstáculo
const OBSTACLE_SPEED_BASE = 220; // px/s
const OBSTACLE_SPEED_INC = 8;   // +px/s a cada obstáculo
const OBSTACLE_INTERVAL = 110;  // frames entre obstáculos
const COIN_VALUE = 5;

// ─── STATE ───────────────────────────────────
let STATE = 'MENU';
let playerY, playerVY;
let obstacles = [], coins = [], particles = [], flashAlpha = 0;
let frameCount = 0, distance = 0, sessionCoins = 0;
let obstacleSpeed = OBSTACLE_SPEED_BASE;
let gapFactor = GAP_START;
let animId = null, lastTime = 0;
let playClicked = false;
let cashoutClicked = false;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let W, H, PLAYER_X, PLAYER_SIZE;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  PLAYER_X = W * PLAYER_X_RATIO;
  PLAYER_SIZE = Math.min(W * 0.07, 30);
}
window.addEventListener('resize', resize);
resize();

// ─── PARALLAX LAYERS ─────────────────────────
const layers = [
  { speed: 0.15, items: [] }, // prédios (lento)
  { speed: 0.45, items: [] }, // luzes neon (médio)
  { speed: 1.0,  items: [] }, // chão (rápido)
];

function initParallax() {
  layers[0].items = Array.from({length: 8}, (_, i) => ({
    x: i * (W / 4), y: H * 0.2,
    w: W * 0.12 + Math.random() * W * 0.1,
    h: H * 0.3 + Math.random() * H * 0.25,
    color: `hsl(${240 + Math.random()*40}, 30%, ${8 + Math.random()*8}%)`
  }));
  layers[1].items = Array.from({length: 30}, (_, i) => ({
    x: Math.random() * W * 2, y: H * 0.1 + Math.random() * H * 0.5,
    w: 4 + Math.random() * 8, h: 4 + Math.random() * 8,
    color: `hsl(${Math.random()*360}, 100%, 70%)`,
    alpha: 0.4 + Math.random() * 0.6
  }));
  layers[2].items = Array.from({length: 12}, (_, i) => ({
    x: i * (W / 6), y: H * 0.88, w: W * 0.06, h: 6,
    color: 'rgba(255,255,255,0.15)'
  }));
}

function drawParallax(dt) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#04040e');
  sky.addColorStop(0.7, '#0a0820');
  sky.addColorStop(1, '#120830');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  for (const b of layers[0].items) {
    b.x -= obstacleSpeed * layers[0].speed * dt;
    if (b.x + b.w < 0) b.x = W + b.w;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    for (let wy = b.y + 10; wy < b.y + b.h - 10; wy += 18) {
      for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 14) {
        if (Math.random() > 0.7) {
          ctx.fillStyle = `hsla(${200 + Math.random()*60}, 80%, 70%, 0.4)`;
          ctx.fillRect(wx, wy, 6, 8);
        }
      }
    }
  }

  for (const l of layers[1].items) {
    l.x -= obstacleSpeed * layers[1].speed * dt;
    if (l.x < -l.w) l.x = W + l.w;
    ctx.save();
    ctx.globalAlpha = l.alpha;
    ctx.fillStyle = l.color;
    ctx.shadowBlur = 10; ctx.shadowColor = l.color;
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.restore();
  }

  ctx.fillStyle = '#0c0818';
  ctx.fillRect(0, H * 0.86, W, H * 0.14);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H * 0.86); ctx.lineTo(W, H * 0.86); ctx.stroke();

  for (const l of layers[2].items) {
    l.x -= obstacleSpeed * layers[2].speed * dt;
    if (l.x + l.w < 0) l.x = W;
    ctx.fillStyle = l.color;
    ctx.fillRect(l.x, l.y, l.w, l.h);
  }

  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0, 0, W, H);
    flashAlpha -= 4 * dt;
    if (flashAlpha < 0) flashAlpha = 0;
  }
}

// ─── PLAYER ──────────────────────────────────
function drawPlayer() {
  const py = playerY;
  const ps = PLAYER_SIZE;
  ctx.save();
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#ff4baa';
  ctx.fillStyle = '#ff4baa';
  ctx.beginPath();
  ctx.ellipse(PLAYER_X, py, ps * 0.6, ps * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffccaa';
  ctx.beginPath();
  ctx.arc(PLAYER_X, py - ps * 0.9, ps * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#ff4baa';
  ctx.beginPath();
  ctx.ellipse(PLAYER_X - ps, py, ps * 0.4, ps * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── OBSTACLES ───────────────────────────────
function spawnObstacle() {
  const gap = H * gapFactor;
  const minY = H * 0.1;
  const maxY = H * 0.75 - gap;
  const gapY = minY + Math.random() * (maxY - minY);
  obstacles.push({
    x: W + 40,
    gapY,
    gapH: gap,
    w: 38,
    passed: false,
    flashed: false,
    hasCoin: Math.random() > 0.35
  });
  if (obstacles[obstacles.length-1].hasCoin) {
    coins.push({
      x: W + 59,
      y: gapY + gap / 2,
      r: 10,
      alive: true
    });
  }
  gapFactor = Math.max(GAP_MIN, gapFactor - GAP_SHRINK);
  obstacleSpeed += OBSTACLE_SPEED_INC;
}

function drawObstacles(dt) {
  for (const obs of obstacles) {
    obs.x -= obstacleSpeed * dt;
    const topH = obs.gapY;
    const botY = obs.gapY + obs.gapH;
    const botH = H - botY;
    drawCameraBlock(obs.x, 0, obs.w, topH, true);
    drawCameraBlock(obs.x, botY, obs.w, botH, false);
    // Flash de câmera quando entra em tela
    if (!obs.flashed && obs.x < W - 40) {
      obs.flashed = true;
      flashAlpha = Math.max(flashAlpha, 0.35);
    }
  }
  obstacles = obstacles.filter(o => o.x + o.w > -10);
}

function drawCameraBlock(x, y, w, h, isTop) {
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, '#1a0a2e');
  grad.addColorStop(1, '#2e1055');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#7733cc';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  const iconY = isTop ? y + h - 28 : y + 8;
  ctx.save();
  ctx.shadowBlur = 14; ctx.shadowColor = '#ff44aa';
  ctx.fillStyle = '#ff44aa';
  ctx.font = '22px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('📷', x + w / 2, iconY);
  ctx.restore();
}

function drawCoins() {
  for (const coin of coins) {
    if (!coin.alive) continue;
    coin.x -= obstacleSpeed * (1/60); // approx — moved with obstacle, kept smooth
    const floatY = coin.y + Math.sin(Date.now() / 300) * 4;
    ctx.save();
    ctx.shadowBlur = 16; ctx.shadowColor = '#ffcc00';
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(coin.x, floatY, coin.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(coin.x - 3, floatY - 3, coin.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `bold ${coin.r * 1.1}px Arial`;
    ctx.fillStyle = '#aa6600';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', coin.x, floatY);
    ctx.restore();
  }
  coins = coins.filter(c => c.x > -20);
}

// ─── PARTICLES ───────────────────────────────
class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y; this.color = color;
    this.vx = (Math.random() - 0.5) * 160;
    this.vy = Math.random() * -120 - 40;
    this.life = 1; this.decay = 2 + Math.random();
    this.size = 3 + Math.random() * 5;
  }
  update(dt) { this.x += this.vx*dt; this.y += this.vy*dt; this.vy += 300*dt; this.life -= this.decay*dt; }
  draw() {
    if (this.life <= 0) return;
    ctx.save(); ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.restore();
  }
}

// ─── COLLISION (AABB) ────────────────────────
function checkCollision() {
  const px = PLAYER_X - PLAYER_SIZE * 0.55;
  const py = playerY - PLAYER_SIZE * 0.9;
  const pw = PLAYER_SIZE * 1.1;
  const ph = PLAYER_SIZE * 1.7;

  if (playerY - PLAYER_SIZE < 0 || playerY + PLAYER_SIZE > H * 0.86) return true;

  for (const obs of obstacles) {
    const ox = obs.x;
    const ow = obs.w;
    if (px < ox + ow && px + pw > ox) {
      if (py < obs.gapY) return true;
      if (py + ph > obs.gapY + obs.gapH) return true;
    }
  }
  return false;
}

function checkCoinCollect() {
  for (const coin of coins) {
    if (!coin.alive) continue;
    const dx = coin.x - PLAYER_X;
    const dy = coin.y - playerY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < coin.r + PLAYER_SIZE * 0.6) {
      coin.alive = false;
      sessionCoins += COIN_VALUE;
      for (let i = 0; i < 8; i++) particles.push(new Particle(coin.x, coin.y, '#ffcc00'));
      updateHUD();
    }
  }
}

// ─── HUD ─────────────────────────────────────
function updateHUD() {
  document.getElementById('hud-coins').textContent = `${sessionCoins} 🪙`;
  document.getElementById('hud-dist').textContent = `${Math.floor(distance)}m`;
}

// ─── GAME LOOP ───────────────────────────────
function gameLoop(ts) {
  if (STATE !== 'RUNNING') return;
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  frameCount++;
  distance += obstacleSpeed * dt * 0.01;

  playerVY += GRAVITY * dt;
  playerY += playerVY * dt;

  if (frameCount % OBSTACLE_INTERVAL === 0) spawnObstacle();

  for (const obs of obstacles) {
    if (!obs.passed && obs.x + obs.w < PLAYER_X) obs.passed = true;
  }

  drawParallax(dt);
  drawObstacles(dt);
  drawCoins();
  drawPlayer();

  particles = particles.filter(p => p.life > 0);
  for (const p of particles) { p.update(dt); p.draw(); }

  if (checkCollision()) { triggerDead(); return; }
  checkCoinCollect();

  updateHUD();
  animId = requestAnimationFrame(gameLoop);
}

// ─── ECONOMY (Apps Script `sync_game_coins`) ─
async function callEmpire(payload) {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!res.ok) return { ok: false, erro: 'HTTP ' + res.status };
    const txt = await res.text();
    try { return JSON.parse(txt); } catch (_) { return { ok: false, erro: 'Resposta inválida' }; }
  } catch (e) {
    return { ok: false, erro: e.message || 'Falha de rede' };
  }
}

async function syncEmpireCoins(telegramId, wagerAmount, wonAmount) {
  const r = await callEmpire({
    acao: 'sync_game_coins',
    telegram_id: telegramId,
    wager: wagerAmount,
    won: wonAmount,
    gameContext: 'Fuga do Paparazzi',
    artistName: ARTIST_NAME
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

// ─── STATE TRANSITIONS ───────────────────────
async function startGame() {
  if (playClicked) return;
  playClicked = true;
  STATE = 'LOADING';
  showScreen('screen-loading');

  const ok = await deductEntry();
  if (!ok) { STATE = 'MENU'; showScreen('screen-menu'); playClicked = false; return; }

  // Reset
  playerY = H / 2; playerVY = 0;
  obstacles = []; coins = []; particles = [];
  frameCount = 0; distance = 0; sessionCoins = 0;
  obstacleSpeed = OBSTACLE_SPEED_BASE; gapFactor = GAP_START;
  flashAlpha = 0;
  cashoutClicked = false;
  initParallax();
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

  // Crédita só o saldo coletado (a entrada já foi debitada).
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
  flashAlpha = 0.9;
  ctx.fillStyle = `rgba(255,255,255,0.9)`;
  ctx.fillRect(0, 0, W, H);

  showScreen('screen-dead');
  document.getElementById('dead-coins').textContent = `Perdeu: ${ENTRY_FEE} 🪙 + ${sessionCoins} 🪙 coletadas`;
  document.getElementById('dead-saving').classList.add('hidden');
  // Sem chamada extra: a entrada já foi debitada no start; moedas coletadas eram só "saldo de partida" (nunca creditado).
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

// ─── INPUT (separado do loop pra evitar lag) ─
function doJump() {
  if (STATE !== 'RUNNING') return;
  playerVY = JUMP_FORCE;
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); doJump(); }
});
document.addEventListener('touchstart', e => {
  if (e.target.closest('button') || e.target.closest('.screen')) return;
  doJump();
}, { passive: true });
document.addEventListener('mousedown', e => {
  if (e.target.closest('button') || e.target.closest('.screen')) return;
  doJump();
});

document.getElementById('btn-play').addEventListener('click', startGame);
document.getElementById('btn-cashout').addEventListener('click', triggerCashout);
document.getElementById('btn-retry').addEventListener('click', () => { goToMenu(); });
document.getElementById('btn-menu-dead').addEventListener('click', goToMenu);
document.getElementById('btn-play-again').addEventListener('click', () => { goToMenu(); });
document.getElementById('btn-menu-suc').addEventListener('click', goToMenu);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && STATE === 'RUNNING') {
    // Pausa preventiva: cancela o loop. Para retomar, jogador volta pelo menu.
    if (animId) cancelAnimationFrame(animId);
  }
});

// Init
showScreen('screen-menu');
initParallax();
drawParallax(0);
