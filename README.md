# Capital Cipher AI

Capital Cipher AI é o protótipo legado de dashboard do projeto. O código útil está sendo migrado para o `capital-cipher-platform`, que é a implementação ativa e opera somente em modo PAPER.

> CONGELAMENTO DE SEGURANÇA: execução real, acesso privado à exchange e todas as Edge Functions estão desativados neste repositório. Não configure credenciais de provedores.

## Status do projeto

Estado atual: legado congelado e mantido temporariamente como fonte de componentes visuais. Todas as Edge Functions respondem com bloqueio permanente, o banco possui uma migração final de endurecimento RLS e o frontend não possui mais um cliente capaz de enviar ordens.

Consulte [`SECURITY_FREEZE.md`](./SECURITY_FREEZE.md) para os passos operacionais de implantação, rotação de credenciais e verificação.

## Stack principal

- Vite
- React 18
- TypeScript
- Tailwind CSS
- shadcn-ui
- Supabase
- React Query
- React Router
- lightweight-charts
- Recharts
- Vitest

## Funcionalidades principais

- Autenticação de usuário via Supabase.
- Rotas protegidas.
- Dashboard de mercado.
- Visualização de preço e gráfico.
- Painéis de performance, backtesting e configurações.
- Modo demo com dados simulados.
- Painéis legados para visualização, logs, decisões e oportunidades em simulação.
- Dados públicos de mercado para referência visual.
- Modo PAPER/DEMO sem acesso privado à exchange.

## Requisitos

- Node.js 20 ou superior recomendado.
- npm.
- Projeto Supabase configurado.
- Variáveis de ambiente locais.

## Instalação local

```bash
git clone https://github.com/ernanefideles22-bot/capital-cipher-ai.git
cd capital-cipher-ai
npm install
npm run dev
```

O servidor de desenvolvimento normalmente ficará disponível em:

```bash
http://localhost:5173
```

## Scripts disponíveis

```bash
npm run dev        # inicia o servidor Vite
npm run build      # gera build de produção
npm run build:dev  # gera build em modo development
npm run lint       # executa ESLint
npm run test       # executa testes com Vitest
npm run test:watch # executa testes em modo watch
npm run preview    # pré-visualiza build local
```

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto.

Exemplo mínimo:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_DEFAULT_TRADING_MODE=paper
```

Nunca coloque chaves secretas da Bybit ou de qualquer exchange no frontend. Chaves sensíveis devem ficar apenas em ambiente seguro de backend, como Supabase Edge Functions ou outro serviço server-side controlado.

## Modos de operação

### Demo

Modo seguro para desenvolvimento visual e simulação. Deve ser o modo padrão.

### Paper trading

É o único modo operacional permitido neste legado. Testnet e live serão implementados futuramente no `capital-cipher-platform`, depois do motor central de risco, OMS, reconciliação e auditoria.

## Segurança operacional

O frontend não é autoridade de segurança. Neste repositório, ações sensíveis retornam um bloqueio local e as Edge Functions correspondentes retornam HTTP 410. O bloqueio só estará completo no ambiente hospedado depois que as funções congeladas forem implantadas e as credenciais históricas forem revogadas.

## Deploy

O projeto pode ser publicado em plataformas compatíveis com Vite, como Vercel, Netlify, Cloudflare Pages ou Lovable. Antes de publicar, configure corretamente as variáveis de ambiente da plataforma.

Para build local:

```bash
npm run build
npm run preview
```

## Próximos passos recomendados

1. Implantar as Edge Functions congeladas e validar HTTP 410.
2. Revogar e rotacionar credenciais históricas de exchange.
3. Migrar os componentes visuais aprovados para `capital-cipher-platform`.
4. Arquivar este repositório quando os critérios de `SECURITY_FREEZE.md` forem atendidos.

## Licença

Uso privado do proprietário do repositório, salvo definição posterior de licença.
