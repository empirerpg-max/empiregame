# legacy-telegram-proxy

Serviço Node standalone que faz streaming de vídeos do Telegram via **MTProto**
(GramJS), usando exatamente a mesma lógica do `empireuploadsfinal/server.ts`.

## Por que isso existe

O app principal (`empiregame`) roda no Cloudflare Workers, que não suporta
sockets TCP persistentes — necessários para o protocolo MTProto do Telegram.
Vídeos legados, cadastrados antes da migração para a Bot API, foram salvos
com **ID de mensagem** (formato MTProto: `canal/id`), não com `file_id` da
Bot API. Este serviço roda num servidor Node de verdade (a mesma VPS do
`telegram-bot-api`) e expõe um endpoint HTTP simples que o Worker chama via
`fetch` para esses vídeos específicos.

## Rodando na VPS

```bash
git clone https://github.com/empirerpg-max/empiregame.git
cd empiregame/legacy-telegram-proxy
npm install
cp .env.example .env
# edite o .env: TELEGRAM_BOT_TOKEN=<mesmo token do bot já usado>
npm start
```

### Como serviço permanente (systemd)

```bash
sudo tee /etc/systemd/system/legacy-telegram-proxy.service > /dev/null <<'EOF'
[Unit]
Description=Legacy Telegram MTProto Streaming Proxy
After=network.target

[Service]
WorkingDirectory=/home/opc/empiregame/legacy-telegram-proxy
ExecStart=/usr/bin/node server.js
EnvironmentFile=/home/opc/empiregame/legacy-telegram-proxy/.env
Restart=always
User=opc

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable legacy-telegram-proxy
sudo systemctl start legacy-telegram-proxy
sudo systemctl status legacy-telegram-proxy
```

Ajuste `WorkingDirectory`/`EnvironmentFile` se o clone estiver em outro
caminho, e libere a porta (padrão `8083`) no firewall interno e na Security
List da Oracle, do mesmo jeito que foi feito para a porta do
`telegram-bot-api`:

```bash
sudo firewall-cmd --permanent --add-port=8083/tcp
sudo firewall-cmd --reload
```

## Endpoint

`GET /api/stream-telegram?postPath=<canal_ou_id>/<id_mensagem>&botToken=...`

- `postPath`: `channel_id/message_id` (ex: `-1002092995685/28`) ou
  `@username/message_id` para canais públicos.
- Suporta `Range` (streaming HTTP 206), igual ao `empireuploadsfinal`.

## Teste rápido

```bash
curl "http://SEU_IP:8083/api/health"
curl -I "http://SEU_IP:8083/api/stream-telegram?postPath=-1002092995685/28"
```
