# Google Sheets no Worker

Este projeto usa uma Google Service Account no backend para ler e escrever nas planilhas do Empire Play.

O Worker aceita duas formas de configuracao:

- `GOOGLE_SERVICE_ACCOUNT_JSON`
- ou `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

A opcao recomendada e `GOOGLE_SERVICE_ACCOUNT_JSON`, porque reduz erro manual.

## Planilhas que precisam ser compartilhadas

Compartilhe o email da Service Account com acesso nas 3 planilhas:

- Planilha Principal: `1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo`
- Planilha de Registros e Charts: `1wNbtP78MrtrOc2Jb1ejXcHVjqndR2Vm4-3EIVqa8aOg`
- Planilha de Edicao Charts: `1GPajSCp1TkJDEDOGZIrXxgZuNuRs7545buFntyDlpL8`

Sem esse compartilhamento, a autenticacao pode funcionar, mas as leituras da planilha falham com erro de permissao.

## 1. Criar a Service Account

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie ou selecione um projeto.
3. Ative a `Google Sheets API`.
4. Va em `IAM e administrador` > `Contas de servico`.
5. Crie uma nova conta de servico para o Worker.
6. Gere uma chave JSON para essa conta e baixe o arquivo.

Os campos mais importantes desse JSON sao:

- `client_email`
- `private_key`
- `private_key_id`
- `project_id`
- `token_uri`

## 2. Compartilhar as planilhas

Abra cada uma das 3 planilhas e clique em `Compartilhar`.

Adicione o `client_email` da Service Account, por exemplo:

```text
worker-empire-play@seu-projeto.iam.gserviceaccount.com
```

Permissao recomendada:

- `Leitor` se o ambiente so precisar consultar
- `Editor` se o ambiente tambem for gravar registros/charts

Como o backend do projeto ja possui helpers de leitura e escrita, a recomendacao pratica e usar somente essa conta de servico dedicada para essas planilhas.

## 3. Configuracao local

O runtime do projeto le essas variaveis no Worker/backend, nao no frontend.

Por isso:

- use `.env` para desenvolvimento local;
- nao use prefixo `VITE_`;
- nunca commite o arquivo com credenciais reais.

### Opcao A: JSON unico

Essa e a forma recomendada.

No seu `.env`, adicione:

```dotenv
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"seu-projeto","private_key_id":"sua-key-id","private_key":"-----BEGIN PRIVATE KEY-----\nSUA_CHAVE\n-----END PRIVATE KEY-----\n","client_email":"worker@seu-projeto.iam.gserviceaccount.com","client_id":"1234567890","token_uri":"https://oauth2.googleapis.com/token"}'
```

Observacoes:

- mantenha o JSON em uma linha so;
- preserve o `\n` dentro do `private_key`;
- use aspas simples ao redor da variavel para evitar quebra do shell.

### Opcao B: campos separados

Use esta opcao apenas se preferir administrar cada campo isoladamente.

```dotenv
GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL=worker@seu-projeto.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE\n-----END PRIVATE KEY-----\n"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID=sua-key-id
GOOGLE_SERVICE_ACCOUNT_PROJECT_ID=seu-projeto
GOOGLE_SERVICE_ACCOUNT_TOKEN_URI=https://oauth2.googleapis.com/token
```

Observacoes:

- o campo critico e `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`;
- se as quebras de linha forem perdidas, a assinatura JWT falha;
- `GOOGLE_SERVICE_ACCOUNT_TOKEN_URI` pode ficar no valor padrao do Google.

## 4. Configuracao no Cloudflare Worker

Em producao, cadastre as credenciais como `secrets` do Worker.

Recomendacao:

- use `secret` para qualquer dado sensivel;
- nao coloque a chave privada dentro de `wrangler.jsonc`;
- prefira `GOOGLE_SERVICE_ACCOUNT_JSON` em producao tambem.

### Opcao A: JSON unico

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
```

Depois cole o conteudo do JSON da Service Account quando o Wrangler pedir.

### Opcao B: campos separados

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_PROJECT_ID
```

Se quiser sobrescrever o endpoint do token:

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_TOKEN_URI
```

Na pratica, esse ultimo normalmente nao e necessario, porque o backend ja usa `https://oauth2.googleapis.com/token` por padrao.

## 5. Como o projeto usa essas variaveis

O Worker aceita essas chaves em runtime em [server.ts](file:///workspace/src/server.ts#L23-L32).

A autenticacao JWT da Service Account e montada em [service-account.ts](file:///workspace/backend/src/google/service-account.ts#L72-L208).

As 3 planilhas configuradas no projeto estao em [sheets.ts](file:///workspace/backend/src/google/sheets.ts#L12-L139).

## 6. Checklist de validacao

Depois de configurar as variaveis e compartilhar as planilhas:

1. Suba o projeto localmente.
2. Teste `GET /api/user/me?telegram_id=<id>`.
3. Teste `GET /api/top-playlists`.
4. Confirme que nao ha erro de:
   - credencial ausente;
   - token Google invalido;
   - permissao negada na planilha.

Se houver erro de permissao, quase sempre o problema e um destes:

- a planilha nao foi compartilhada com o `client_email`;
- a chave JSON pertence a outra conta de servico;
- o `private_key` foi colado sem preservar `\n`.

## 7. Boas praticas

- nunca commite a chave JSON;
- nunca exponha essas variaveis com prefixo `VITE_`;
- use uma conta de servico exclusiva para o Worker;
- rotacione a chave se ela ja tiver sido enviada em chat, commit ou painel inseguro;
- mantenha o acesso compartilhado apenas nas planilhas que o Worker realmente usa.
