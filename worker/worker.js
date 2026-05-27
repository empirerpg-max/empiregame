/**
 * Empire TV — Worker de transmissão para a Kick
 * Variáveis de ambiente:
 *   APPS_SCRIPT_URL  — URL do Apps Script da TV
 *   KICK_RTMP_URL    — URL RTMP completa com chave
 */

import { spawn }                                     from "child_process";
import { existsSync, unlinkSync, createWriteStream }  from "fs";
import { stat }                                       from "fs/promises";
import https                                          from "https";
import http                                           from "http";
import path                                           from "path";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL
  || "https://script.google.com/macros/s/AKfycby7OeFYuai1QoTEXD427-Kn_2KBvh3nakD4iKSuOji9-i3x7sK8DD59BHRBRc5Ow1YB/exec";

const KICK_RTMP = process.env.KICK_RTMP_URL
  || "rtmp://fa723fc1b171.global-contribute.live-video.net/app/sk_us-west-2_uup5d441E9QX_xchfyt3s6vMUxxtwRSsm4FKQEDOY6c";

// Tamanho mínimo para considerar o arquivo válido (5 MB)
const MIN_VIDEO_BYTES = 5 * 1024 * 1024;

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/**
 * Faz GET seguindo redirecionamentos e retorna { body, headers, cookies }.
 * cookieJar: objeto { [name]: value } acumulado entre redirecionamentos.
 */
function getWithCookies(url, cookieJar = {}) {
  return new Promise((resolve, reject) => {
    const mod  = url.startsWith("https") ? https : http;
    const cookieHeader = Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`).join("; ");
    const options = new URL(url);
    const reqOpts = {
      hostname: options.hostname,
      path:     options.pathname + options.search,
      method:   "GET",
      headers:  cookieHeader ? { Cookie: cookieHeader } : {},
    };
    const req = mod.request(reqOpts, (res) => {
      // Acumula cookies
      const setCookies = res.headers["set-cookie"] || [];
      setCookies.forEach(c => {
        const part = c.split(";")[0];
        const idx  = part.indexOf("=");
        if (idx > 0) cookieJar[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
      });
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307) {
        return getWithCookies(res.headers.location, cookieJar).then(resolve).catch(reject);
      }
      let body = "";
      res.on("data", d => body += d);
      res.on("end",  () => resolve({ body, headers: res.headers, cookies: cookieJar }));
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Baixa um arquivo seguindo redirecionamentos com cookieJar acumulado.
 */
function downloadToFile(url, filePath, cookieJar = {}) {
  return new Promise((resolve, reject) => {
    const mod  = url.startsWith("https") ? https : http;
    const cookieHeader = Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`).join("; ");
    const parsed = new URL(url);
    const reqOpts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   "GET",
      headers:  cookieHeader ? { Cookie: cookieHeader } : {},
    };
    const req = mod.request(reqOpts, (res) => {
      // Acumula cookies
      const setCookies = res.headers["set-cookie"] || [];
      setCookies.forEach(c => {
        const part = c.split(";")[0];
        const idx  = part.indexOf("=");
        if (idx > 0) cookieJar[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
      });
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307) {
        return downloadToFile(res.headers.location, filePath, cookieJar).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} ao baixar arquivo`));
      }
      const file = createWriteStream(filePath);
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(filePath); });
      file.on("error",  reject);
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Download correto para Google Drive — funciona para arquivos grandes (+100 MB).
 *
 * Fluxo:
 *  1. Tenta download direto via /uc?export=download
 *  2. Se o Drive retornar uma página HTML de aviso (arquivo grande),
 *     extrai o token de confirmação e refaz o download com ele.
 *  3. Valida que o arquivo baixado tem pelo menos MIN_VIDEO_BYTES.
 */
async function downloadDrive(driveId, filePath) {
  if (existsSync(filePath)) {
    const info = await stat(filePath);
    if (info.size >= MIN_VIDEO_BYTES) {
      console.log(`  [cache] ${path.basename(filePath)} (${(info.size/1024/1024).toFixed(1)} MB)`);
      return filePath;
    }
    // Arquivo corrompido/incompleto do cache — remove e baixa de novo
    unlinkSync(filePath);
    console.log(`  [cache inválido] removido ${path.basename(filePath)}`);
  }

  const cookieJar = {};
  const urlDirect = `https://drive.google.com/uc?export=download&id=${driveId}`;

  console.log(`  ↓ Iniciando download: ${driveId}`);

  // Primeira requisição — para arquivos pequenos já vem o binário diretamente
  // Para arquivos grandes o Drive retorna HTML com um formulário de confirmação
  const { body, headers, cookies } = await getWithCookies(urlDirect, cookieJar);

  // Detecta se é página HTML (arquivo grande bloqueado)
  const contentType = headers["content-type"] || "";
  if (contentType.includes("text/html") || body.trimStart().startsWith("<!DOCTYPE") || body.trimStart().startsWith("<html")) {
    console.log(`  ⚠️  Arquivo grande detectado — extraindo token de confirmação...`);

    // Extrai o token do HTML (campo 'confirm' ou 'uuid')
    let confirmToken = "";
    const matchConfirm = body.match(/[?&]confirm=([0-9A-Za-z_-]+)/);
    const matchUuid    = body.match(/[?&]uuid=([0-9A-Za-z_-]+)/);
    const matchInput   = body.match(/name="confirm"[^>]*value="([^"]+)"/);

    if (matchConfirm) confirmToken = matchConfirm[1];
    else if (matchUuid) confirmToken = matchUuid[1];
    else if (matchInput) confirmToken = matchInput[1];

    if (!confirmToken) {
      // Tenta a URL alternativa via /file/d/ID/view -> redirect para download
      console.log(`  ℹ️  Token não encontrado, tentando URL alternativa...`);
      const urlAlt = `https://drive.google.com/uc?export=download&id=${driveId}&confirm=t&uuid=${Date.now()}`;
      await downloadToFile(urlAlt, filePath, cookies);
    } else {
      const urlConfirm = `https://drive.google.com/uc?export=download&id=${driveId}&confirm=${confirmToken}`;
      console.log(`  ✓ Token: ${confirmToken}`);
      await downloadToFile(urlConfirm, filePath, cookies);
    }
  } else {
    // Arquivo pequeno — já veio o conteúdo na primeira requisição
    // Mas como usamos getWithCookies (acumula body como string), salvamos direto
    // Para arquivos binários grandes isso não funciona bem — usa downloadToFile
    await downloadToFile(urlDirect, filePath, {});
  }

  // Valida o resultado
  if (!existsSync(filePath)) throw new Error(`Arquivo não criado: ${filePath}`);
  const info = await stat(filePath);
  if (info.size < MIN_VIDEO_BYTES) {
    unlinkSync(filePath);
    throw new Error(`Arquivo inválido (${info.size} bytes) — Drive provavelmente bloqueou. Verifique se o vídeo está com permissão "Qualquer pessoa com o link"`);
  }

  console.log(`  ✅ Download OK: ${(info.size/1024/1024).toFixed(1)} MB`);
  return filePath;
}

async function buscarFila() {
  const { body } = await getWithCookies(`${APPS_SCRIPT_URL}?acao=kick_fila`);
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

// ── Loop principal (exportado para o server.js) ───────────────────────────────

export async function run() {
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

    console.log(`\n⬇️  [${i+1}/${fila.length}] Baixando: ${atual.programa} (ordem ${atual.ordem})`);
    try {
      await downloadDrive(atual.driveId, pathAtual);
    } catch (e) {
      console.error(`  ❌ Erro ao baixar: ${e.message}`);
      await marcarStatus(atual.ordem, "Erro");
      continue;
    }

    // Pré-download do próximo em paralelo
    let preDownload = null;
    if (proximo) {
      const pathProx = path.join("/tmp", `clip_${proximo.ordem}_${proximo.driveId}.mp4`);
      console.log(`  🔄 Pré-download: ${proximo.programa}`);
      preDownload = downloadDrive(proximo.driveId, pathProx)
        .catch(e => console.warn(`  ⚠️  Pré-download falhou: ${e.message}`));
    }

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

    if (preDownload) await preDownload;
    limpar(pathAtual);
  }

  console.log("\n🏁 Fila concluída.");
}
