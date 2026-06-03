## Objetivo
Adicionar acesso ao app Empire TV (https://empiretv.vercel.app/) através de uma nova entrada no menu hambúrguer, sem nenhum risco de quebrar o que já funciona.

## Por que não quebra nada
A integração será feita exatamente no mesmo padrão que vocês já usam para o `/charts` (arquivo `src/routes/charts.tsx`): uma rota nova, isolada, que carrega o site externo dentro de um `<iframe>`. Como o app Empire TV roda no Vercel (servidor separado), nada do código de transmissão entra no projeto Lovable. Se algo der errado lá, fica restrito à página `/tv` e não afeta o resto.

## Mudanças (mínimas, 2 arquivos)

**1. Criar `src/routes/tv.tsx`** — nova rota `/tv`
- Componente idêntico ao `charts.tsx`: um `<iframe>` em tela cheia apontando para `https://empiretv.vercel.app/`
- Inclui `allow="autoplay; camera; microphone; fullscreen"` (necessário para transmissões)
- Metadata SEO próprio (title "Empire TV")

**2. Editar `src/routes/__root.tsx`** — adicionar item no menu hambúrguer
- Adicionar uma nova `<MenuCategory>` chamada "Empire TV" (ou incluir como item em "Empire Extras", se preferir), com `{ to: "/tv", label: "Empire TV", icon: Tv }`
- Importar o ícone `Tv` do `lucide-react`
- **Nenhuma outra linha alterada** — todas as categorias existentes (Studio, Market, Coliseum, Extras) permanecem intactas

## Sobre o Telegram WebApp
Você não precisa se preocupar: como o Empire TV vai estar embutido via iframe dentro da própria rota `/tv` do app principal, o Telegram trata como navegação interna normal. Não precisa de "abrir outro app" — o usuário nem sai do mini-app.

> **Observação técnica**: se o Vercel estiver configurado para enviar header `X-Frame-Options: DENY` ou CSP `frame-ancestors`, o iframe ficará em branco (sem quebrar nada — só não aparece o conteúdo). Como o `/charts` de vocês já funciona com o mesmo padrão, é provável que funcione. Se não funcionar, a correção é simples: adicionar no `next.config.js` do Empire TV no GitHub um header permitindo o frame do domínio do Lovable. Eu te aviso após testar.

## Custo
~1 crédito. São duas edições pequenas e diretas, sem instalação de dependências nem migrations.
