/**
 * Empire TV — Worker de transmissão para a Kick
 * Roda em Google Cloud Run (Node.js + ffmpeg)
 * Variáveis de ambiente necessárias:
 *   APPS_SCRIPT_URL  — URL do doGet/doPost do Apps Script da TV
 *   KICK_RTMP_URL    — ex: rtmp://fa723fc1b171.global-contribute.live-video.net/app/SUA_CHAVE
 */

import { spawn } from "child_process";
import { existsSync, unlinkSync, createWriteStream } from "fs";
import https from "https";
import http from "http";
import path from "path";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const KICK_RTMP       = process.env.KICK_RTMP_URL;

if (!APPS_SCRIPT_URL) { console.error("APPS_SCRIPT_URL não definida"); process.exit(1); }
if (!KICK_RTMP)       { console.error("KICK_RTMP_URL não definida");  process.exit(1); }

// ── Utilitários ──────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      let body = "";
      res.on("data", d => body += d);
      res.on("end",  () => resolve(body));
    }).on("error", reject);
  });
}

async function buscarFila() {
  const body = await get(`${APPS_SCRIPT_URL}?acao=kick_fila`);
  try { return JSON.parse(body); } catch { return []; }
}

async function marcarStatus(ordem, status) {
  const payload = JSON.stringify({ acao: "kick_status", ordem, status });
  return new Promise((resolve) => {
    const url  = new URL(APPS_SCRIPT_URL);
    const opts = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   "POST",
      headers:  { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    };
    const req = https.request(opts, res => { res.resume(); res.on("end", resolve); });
    req.on("error", () => resolve());
    req.write(payload);
    req.end();
  });
}

function downloadDrive(driveId, filePath) {
  if (existsSync(filePath)) {
    console.log(`  [cache] ${filePath}`);
    return Promise.resolve(filePath);
  }
  const url = `https://drive.google.com/uc?export=download&id=${driveId}&confirm=t`;
  return new Promise((resolve, reject) => {
    function request(u) {
      const mod = u.startsWith("https") ? https : http;
      mod.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} ao baixar driveId=${driveId}`));
        }
        const file = createWriteStream(filePath);
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(filePath); });
        file.on("error",  reject);
      }).on("error", reject);
    }
    request(url);
  });
}

function transmitir(filePath) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-re",
      "-i",        filePath,
      "-c:v",      "libx264",
      "-preset",   "veryfast",
      "-b:v",      "3000k",
      "-maxrate",  "3000k",
      "-bufsize",  "6000k",
      "-pix_fmt",  "yuv420p",
      "-g",        "50",
      "-c:a",      "aac",
      "-b:a",      "128k",
      "-ar",       "44100",
      "-f",        "flv",
      KICK_RTMP,
    ]);
    ff.stderr.on("data", (d) => process.stdout.write(d));
    ff.on("close", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`ffmpeg encerrou com código ${code}`));
    });
  });
}

function limpar(filePath) {
  try { if (existsSync(filePath)) unlinkSync(filePath); } catch (_) {}
}

// ── Loop principal ────────────────────────────────────────────────────────────

async function main() {
  console.log("🎬 Empire TV Worker iniciado");

  const fila = await buscarFila();
  if (!Array.isArray(fila) || fila.length === 0) {
    console.log("📭 Fila vazia — nada para transmitir.");
    return;
  }

  console.log(`📋 ${fila.length} item(ns) na fila.`);

  for (let i = 0; i < fila.length; i++) {
    const atual   = fila[i];
    const proximo = fila[i + 1];

    const nomeAtual = `clip_${atual.ordem}_${atual.driveId}.mp4`;
    const pathAtual = path.join("/tmp", nomeAtual);

    // ── Download do clip atual ────────────────────────────────────────────────
    console.log(`\n⬇️  [${i+1}/${fila.length}] Baixando: ${atual.programa} (ordem ${atual.ordem})`);
    try {
      await downloadDrive(atual.driveId, pathAtual);
    } catch (e) {
      console.error(`  ❌ Erro ao baixar: ${e.message}`);
      await marcarStatus(atual.ordem, "Erro");
      continue;
    }

    // ── Pré-download do próximo em paralelo ───────────────────────────────────
    let preDownload = null;
    if (proximo) {
      const nomeProx = `clip_${proximo.ordem}_${proximo.driveId}.mp4`;
      const pathProx = path.join("/tmp", nomeProx);
      console.log(`  🔄 Pré-download: ${proximo.programa}`);
      preDownload = downloadDrive(proximo.driveId, pathProx)
        .catch(e => console.warn(`  ⚠️  Pré-download falhou (${proximo.programa}): ${e.message}`));
    }

    // ── Transmissão ───────────────────────────────────────────────────────────
    console.log(`  📡 Transmitindo: ${atual.programa}`);
    await marcarStatus(atual.ordem, "Transmitindo");
    try {
      await transmitir(pathAtual);
      await marcarStatus(atual.ordem, "Finalizado");
      console.log(`  ✅ Finalizado: ${atual.programa}`);
    } catch (e) {
      console.error(`  ❌ Erro ao transmitir: ${e.message}`);
      await marcarStatus(atual.ordem, "Erro");
    }

    // Aguarda pré-download terminar antes de continuar o loop
    if (preDownload) await preDownload;

    // Limpa /tmp para não lotar o container (512 MB de limite no Cloud Run)
    limpar(pathAtual);
  }

  console.log("\n🏁 Fila concluída.");
}

main().catch(err => { console.error("Erro fatal:", err); process.exit(1); });
