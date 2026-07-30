# Plano: Configuração da Service Account no Worker

## Summary

Objetivo: documentar e padronizar a configuração das credenciais do Google Sheets no Worker do projeto `empiregame`, de forma que o backend do Empire Play consiga autenticar via Service Account tanto em desenvolvimento quanto em deploy.

Resultado esperado:
- existir uma instrução clara para configurar `GOOGLE_SERVICE_ACCOUNT_JSON` ou o par `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`;
- ficar explícito como conceder acesso da Service Account às 3 planilhas exigidas;
- o fluxo local e o fluxo de produção ficarem reproduzíveis para qualquer pessoa do time;
- a validação final confirmar que o Worker sobe com as variáveis corretas e que os endpoints novos conseguem autenticar no Google Sheets.

## Current State Analysis

- O Worker principal do projeto está em [server.ts](file:///workspace/src/server.ts#L1-L210).
- O runtime já espera as chaves:
  - `GOOGLE_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL`
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID`
  - `GOOGLE_SERVICE_ACCOUNT_PROJECT_ID`
  - `GOOGLE_SERVICE_ACCOUNT_TOKEN_URI`
  Isso aparece em [server.ts](file:///workspace/src/server.ts#L23-L32).
- A autenticação JWT da conta de serviço já está implementada em [service-account.ts](file:///workspace/backend/src/google/service-account.ts#L72-L208).
- O cliente de planilhas já usa essas credenciais para ler e escrever nas 3 planilhas em [sheets.ts](file:///workspace/backend/src/google/sheets.ts#L12-L139).
- O arquivo [wrangler.jsonc](file:///workspace/wrangler.jsonc#L1-L7) ainda não documenta variáveis/secrets.
- O arquivo [.env.example](file:///workspace/.env.example#L1-L8) hoje só cobre Supabase e ainda não orienta a configuração Google.
- O projeto usa Vite/TanStack Start via [vite.config.ts](file:///workspace/vite.config.ts#L1-L37), mas as variáveis de Service Account são consumidas no Worker, não no frontend.

## Proposed Changes

### 1. Atualizar `.env.example`

Arquivo: [ .env.example ](file:///workspace/.env.example)

O que mudar:
- adicionar placeholders para:
  - `GOOGLE_SERVICE_ACCOUNT_JSON`
  - `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL`
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID`
  - `GOOGLE_SERVICE_ACCOUNT_PROJECT_ID`
  - `GOOGLE_SERVICE_ACCOUNT_TOKEN_URI`
- explicar no próprio arquivo que:
  - deve-se usar **uma** das duas estratégias;
  - `GOOGLE_SERVICE_ACCOUNT_JSON` é a opção mais simples;
  - o `private_key` precisa manter quebras de linha corretas, ou entrar com `\n` escapado quando for usado como variável única.

Por que:
- hoje o repositório não ensina como preencher as credenciais que o backend já exige.

Como:
- acrescentar uma seção comentada “Google Sheets Service Account”.
- incluir exemplo curto de formato:
  - JSON inteiro em uma única variável;
  - ou `client_email` + `private_key`.

### 2. Documentar o fluxo de configuração local

Arquivo proposto: `README` novo ou seção em documento de setup do projeto.

O que incluir:
- passo a passo para criar a conta de serviço no Google Cloud;
- ativar `Google Sheets API`;
- baixar a chave JSON;
- compartilhar as 3 planilhas com o e-mail da Service Account:
  - `1XYa6Pzd-lou3fzqaZgjhBYNb3Je2PB9Slu7ozzOghUo`
  - `1wNbtP78MrtrOc2Jb1ejXcHVjqndR2Vm4-3EIVqa8aOg`
  - `1GPajSCp1TkJDEDOGZIrXxgZuNuRs7545buFntyDlpL8`
- exemplo de preenchimento no `.env` local.

Por que:
- a necessidade principal do pedido é operacional: “como vou fazer isso aqui”.
- isso não deve depender de memória tribal.

Como:
- descrever duas receitas:
  - opção A: colar `GOOGLE_SERVICE_ACCOUNT_JSON` no `.env`;
  - opção B: extrair campos individuais do JSON e colar o `private_key` com `\n`.
- explicar que essas variáveis são server-side e não devem usar prefixo `VITE_`.

### 3. Documentar o fluxo de produção no Cloudflare Worker

Arquivo proposto: mesmo documento de setup/deploy ou seção própria.

O que incluir:
- como cadastrar secrets no Worker com Wrangler CLI:
  - `wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON`
  - ou os secrets separados (`GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, etc.)
- explicar quando usar `secret` versus `vars`.

Por que:
- o backend lê os valores do `env` do Worker em produção; sem isso, os endpoints devolvem erro de configuração.

Como:
- recomendar:
  - usar `wrangler secret put` para `GOOGLE_SERVICE_ACCOUNT_JSON`;
  - manter `token_uri` como padrão quando não precisar sobrescrever;
  - evitar colocar a chave privada em `wrangler.jsonc`.
- deixar explícito que o `wrangler.jsonc` deste projeto não precisa carregar a chave inline.

### 4. Registrar decisões de segurança

Arquivo proposto: mesmo documento de configuração.

O que incluir:
- não commitar o JSON da conta de serviço;
- não expor essas variáveis com prefixo `VITE_`;
- usar permissão mínima prática na conta de serviço;
- compartilhar as planilhas apenas com esse e-mail de serviço;
- rotacionar a chave se ela já tiver sido exposta.

Por que:
- as credenciais concedem acesso direto às planilhas do Empire Play.

Como:
- acrescentar uma seção “Boas práticas e riscos”.

### 5. Adicionar checklist de validação operacional

Arquivos relevantes para validar:
- [server.ts](file:///workspace/src/server.ts#L184-L210)
- [service-account.ts](file:///workspace/backend/src/google/service-account.ts#L166-L208)
- [http.ts](file:///workspace/backend/src/empire-play/http.ts#L43-L135)

O que validar:
- o Worker sobe com as variáveis carregadas;
- a conta de serviço consegue trocar JWT por access token;
- `GET /api/user/me?telegram_id=<id>` deixa de retornar erro de configuração;
- `GET /api/top-playlists` responde com dados das abas.

Por que:
- a configuração só está correta quando autenticação e leitura das planilhas funcionam de ponta a ponta.

Como:
- rodar localmente com `.env` preenchido;
- testar os endpoints REST manualmente;
- repetir em staging/produção após cadastrar os secrets no Worker.

## Assumptions & Decisions

- O projeto continuará usando o Worker em [server.ts](file:///workspace/src/server.ts#L184-L210) como ponto de entrada HTTP.
- As credenciais do Google serão tratadas apenas no backend/Worker.
- A estratégia preferida para simplificar setup e reduzir erro humano será `GOOGLE_SERVICE_ACCOUNT_JSON`.
- A estratégia com variáveis separadas continuará suportada como fallback, porque já existe no código.
- O `GOOGLE_SERVICE_ACCOUNT_TOKEN_URI` pode continuar opcional, usando o default `https://oauth2.googleapis.com/token`.
- A permissão nas planilhas será concedida manualmente via compartilhamento com o e-mail da Service Account.

## Verification Steps

1. Confirmar que o `.env.example` documenta todas as chaves aceitas pelo backend.
2. Confirmar que o documento de setup/deploy explica:
   - criação da Service Account;
   - compartilhamento das 3 planilhas;
   - configuração local;
   - configuração no Cloudflare Worker.
3. Validar localmente com `.env` real:
   - `GET /api/user/me?telegram_id=...`
   - `GET /api/top-playlists`
4. Validar no deploy após cadastrar os secrets no Worker.
5. Confirmar que nenhuma credencial foi commitada no repositório.
