## Como o Queridômetro funciona hoje

**Frontend** (`src/routes/games.queridometro.tsx`):
- Ao abrir, chama `api.getQueridometroStatus(tgId)` → action `queridometro_status` no Apps Script.
- Espera receber: `semana`, `votosRestantes`, `meusArtistas`, `ranking`, `reacoesRecebidas[]`.
- A aba **Recebidos** renderiza `reacoesRecebidas` (de/emoji/valor/data).

**Backend** (Apps Script — fora do repo):
- `queridometro_status` provavelmente filtra reações onde `para` ∈ artistas do `tgId` chamador e devolve em `reacoesRecebidas`. Se o usuário não tem artista vinculado, ou se a aba de reações está vazia, vem `[]` e o frontend mostra "Nenhum emoji recebido".

## Por que a aba está vazia

Uma das três causas:
1. O Apps Script não está populando `reacoesRecebidas` (action não implementada ou retornando outro nome de campo).
2. Está filtrando por artistas do `tgId` e o usuário atual não possui artista vinculado / não recebeu emoji ainda.
3. A planilha de votos (`QUERIDOMETRO_VOTOS` ou equivalente) não está sendo lida — `queridometro_votar` grava mas `queridometro_status` não lê.

Sem rodar o endpoint, não dá pra cravar qual das três — mas o efeito visto ("nada aparece") é o mesmo dos três.

## O que você quer mudar

Listagem **pública e anônima** de todos os emojis recebidos (qualquer artista, sem mostrar quem enviou).

## Plano

### 1. Backend (Apps Script — você aplica na planilha)
Ajustar `queridometro_status` para devolver, além do que já manda, um novo campo `reacoesPublicas[]` com **todas** as reações da semana corrente, no formato:

```
{ para: "<artista destino>", fotoPara: "<url>", emoji: "🔥", data: "<iso>" }
```

Regras:
- **Nunca** incluir `de`, `tgIdOrigem`, `valor` (o valor é segredo do jogo) nem qualquer coisa que identifique o remetente.
- Ordenar por data desc, limitar a ~100 últimas pra não pesar.
- Manter `reacoesRecebidas` como está (uso futuro / debug), mas a UI deixa de depender dele.

Te mando o snippet pronto pra colar na próxima rodada (ele lê a aba que já existe — preciso só confirmar o nome: `QUERIDOMETRO_VOTOS`?).

### 2. Frontend (`src/routes/games.queridometro.tsx`)
- Renomear a aba **Recebidos** para **Mural** (ou manter "Recebidos" se preferir).
- Passar a consumir `reacoesPublicas` em vez de `reacoesRecebidas`.
- Card mostra: foto + nome do artista que **recebeu**, emoji grande, data relativa. **Sem** "de Fulano", **sem** valor numérico.
- Adicionar tipagem em `src/lib/api.ts` (`reacoesPublicas?: ReacaoPublica[]`).
- Estado vazio: "Ainda ninguém mandou emoji essa semana".

### 3. Verificação
- Abrir a aba Mural com um usuário sem artista vinculado → deve listar do mesmo jeito.
- Conferir no DevTools que a resposta não traz nenhum campo identificando remetente.

## Pendências antes de implementar
1. Confirma o nome da aba onde os votos são gravados (`QUERIDOMETRO_VOTOS`?).
2. "Mural" público mostra **só a semana atual** ou histórico completo (últimas 100)?
3. Quer manter a aba **Recebidos** privada (só seus artistas, com valor) **junto** com o Mural público, ou substituir de vez?
