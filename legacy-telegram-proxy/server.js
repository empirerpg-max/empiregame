require('dotenv').config();
const express = require('express');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions/index.js');
const bigInt = require('big-integer');

const app = express();
const PORT = Number(process.env.PORT) || 8083;

// Mesmas credenciais/fallbacks usados no empireuploadsfinal/server.ts —
// necessário porque nem toda combinação de API_ID/API_HASH é aceita pelo
// Telegram para autenticação de bot via MTProto.
const KNOWN_API_PAIRS = [
  { apiId: Number(process.env.TELEGRAM_API_ID) || 2040, apiHash: process.env.TELEGRAM_API_HASH || 'b18441a12608e10915321038209c122c' },
  { apiId: 2496, apiHash: '8da85b0d5bfe62527e5b244c20f15868' },
  { apiId: 184276, apiHash: 'c7c29efb086782d46e29783f9a764724' },
  { apiId: 94575, apiHash: 'a3406de8d171326e493e80fc7354b3e3' },
  { apiId: 6, apiHash: 'eb066357b5234192bd27814ed921131a' },
];

const clientsCache = new Map();

async function getTelegramClient(botToken, customApiId, customApiHash) {
  const cleanToken = botToken.trim();
  const cacheKey = `${cleanToken}_${customApiId || 'default'}`;
  const cached = clientsCache.get(cacheKey);

  if (cached && cached.client.connected) {
    cached.lastUsed = Date.now();
    return cached.client;
  }

  const pairsToTry = [];
  if (customApiId && customApiHash) {
    pairsToTry.push({ apiId: customApiId, apiHash: customApiHash });
  }
  for (const pair of KNOWN_API_PAIRS) {
    if (!pairsToTry.some((p) => p.apiId === pair.apiId)) {
      pairsToTry.push(pair);
    }
  }

  let lastError = null;

  for (const pair of pairsToTry) {
    try {
      const stringSession = new StringSession('');
      const client = new TelegramClient(stringSession, pair.apiId, pair.apiHash, {
        connectionRetries: 3,
        useWSS: false,
      });

      await client.start({ botAuthToken: cleanToken });

      clientsCache.set(cacheKey, { client, lastUsed: Date.now() });
      return client;
    } catch (err) {
      console.warn(`Tentativa de conexão MTProto com API_ID ${pair.apiId} falhou:`, err?.errorMessage || err?.message || err);
      lastError = err;
      const msg = String(err?.errorMessage || err?.message || err);
      if (msg.includes('API_ID_INVALID')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Não foi possível autenticar o Bot no Telegram. Verifique se o Token do Bot está correto.');
}

setInterval(() => {
  const now = Date.now();
  for (const [key, item] of clientsCache.entries()) {
    if (now - item.lastUsed > 10 * 60 * 1000) {
      item.client.disconnect().catch(() => {});
      clientsCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mtproto_proxy: true, time: new Date().toISOString() });
});

// GET /api/stream-telegram?postPath=canal/idMensagem[&botToken=...&apiId=...&apiHash=...]
app.get('/api/stream-telegram', async (req, res) => {
  const botToken = req.query.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const postPath = req.query.postPath;
  const customApiId = req.query.apiId ? Number(req.query.apiId) : undefined;
  const customApiHash = req.query.apiHash || undefined;

  if (!botToken) {
    return res.status(400).json({ error: 'Token do Bot do Telegram é obrigatório (?botToken=... ou env TELEGRAM_BOT_TOKEN)' });
  }

  if (!postPath || !postPath.includes('/')) {
    return res.status(400).json({ error: 'Caminho do post é obrigatório (?postPath=canal/id_mensagem)' });
  }

  const [channelUsername, messageIdStr] = postPath.split('/');
  const messageId = parseInt(messageIdStr, 10);

  if (isNaN(messageId)) {
    return res.status(400).json({ error: 'ID da mensagem inválido' });
  }

  try {
    const client = await getTelegramClient(botToken, customApiId, customApiHash);

    // Canais privados (id numérico -100...) são resolvidos via bigInt; canais
    // públicos por @username.
    const isNumericChannelId = /^-?\d+$/.test(channelUsername);

    let entity;
    if (isNumericChannelId) {
      // GramJS não resolve um canal privado só pelo ID cru numa sessão nova:
      // ele precisa ter o access_hash em cache, que só existe depois de o
      // client "ver" os diálogos do bot pelo menos uma vez.
      const normalizedTarget = channelUsername.replace(/^-100/, '').replace(/^-/, '');
      let resolved = null;
      for await (const dialog of client.iterDialogs({ limit: 200 })) {
        const dialogId = dialog.id ? dialog.id.toString().replace(/^-100/, '').replace(/^-/, '') : '';
        if (dialogId === normalizedTarget) {
          resolved = dialog.entity;
          break;
        }
      }
      if (!resolved) {
        return res.status(404).json({
          error: 'Canal não encontrado entre os diálogos do bot. Confirme que o bot é membro/admin desse canal.',
        });
      }
      entity = resolved;
    } else {
      entity = await client.getEntity(channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`);
    }

    const messages = await client.getMessages(entity, { ids: [messageId] });

    if (!messages || messages.length === 0 || !messages[0] || !messages[0].media) {
      return res.status(404).json({ error: 'Mensagem ou vídeo não encontrado no Telegram' });
    }

    const message = messages[0];
    const media = message.media;
    const document = media.document || (media.webpage && media.webpage.document);

    if (!document) {
      return res.status(404).json({ error: 'A mensagem do Telegram não possui uma mídia de vídeo anexada' });
    }

    const fileSize = Number(document.size);
    const mimeType = document.mimeType || 'video/mp4';

    const range = req.headers.range;
    const CHUNK_SIZE = 1024 * 1024;

    let start = 0;
    let end = fileSize - 1;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + CHUNK_SIZE - 1, fileSize - 1);
    } else {
      end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1);
    }

    if (start >= fileSize || end >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const contentLength = end - start + 1;

    res.writeHead(range ? 206 : 200, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': contentLength,
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    });

    // MTProto exige offset/limit múltiplos de 4096; usamos blocos de 128KB
    // alinhados, igual ao empireuploadsfinal/server.ts.
    const BLOCK_SIZE = 128 * 1024;
    const alignStart = Math.floor(start / BLOCK_SIZE) * BLOCK_SIZE;

    const fileLocation = new Api.InputDocumentFileLocation({
      id: document.id,
      accessHash: document.accessHash,
      fileReference: document.fileReference,
      thumbSize: '',
    });

    let currentOffset = alignStart;

    while (currentOffset <= end) {
      const result = await client.invoke(
        new Api.upload.GetFile({
          location: fileLocation,
          offset: bigInt(currentOffset),
          limit: BLOCK_SIZE,
        }),
      );

      if (!result || !result.bytes || result.bytes.length === 0) {
        break;
      }

      const blockBuffer = Buffer.from(result.bytes);
      const blockStart = currentOffset;
      const blockEnd = currentOffset + blockBuffer.length - 1;

      const overlapStart = Math.max(start, blockStart);
      const overlapEnd = Math.min(end, blockEnd);

      if (overlapStart <= overlapEnd) {
        const sliceFrom = overlapStart - blockStart;
        const sliceTo = overlapEnd - blockStart + 1;
        res.write(blockBuffer.subarray(sliceFrom, sliceTo));
      }

      currentOffset += BLOCK_SIZE;
    }

    res.end();
  } catch (err) {
    console.error('Erro no proxy de streaming Telegram MTProto:', err);
    if (!res.headersSent) {
      const errMsg = err?.errorMessage || err?.message || String(err);
      let userFriendlyError = 'Erro ao fazer streaming do vídeo do Telegram.';
      if (errMsg.includes('API_ID_INVALID')) {
        userFriendlyError = 'API_ID_INVALID: as credenciais default do Telegram foram recusadas. Informe seu próprio API ID e API Hash (my.telegram.org).';
      } else if (errMsg.includes('BOT_METHOD_INVALID') || errMsg.includes('CHAT_ADMIN_REQUIRED')) {
        userFriendlyError = 'O Bot precisa ter permissão de acesso ao canal do Telegram para ler as mensagens e mídias.';
      }
      res.status(400).json({ error: userFriendlyError, details: errMsg });
    } else {
      res.end();
    }
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`legacy-telegram-proxy (MTProto) rodando na porta ${PORT}`);
});
