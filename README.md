# Capital Cipher AI

Capital Cipher AI é um dashboard web para análise, monitoramento e automação de trading cripto. O projeto usa React, Vite, TypeScript, Tailwind CSS, shadcn-ui, Supabase e integração com Bybit.

> Aviso: este projeto envolve lógica de trading. Não use capital real antes de validar autenticação, chaves, limites de risco, execução de ordens, logs e comportamento em testnet/paper trading.

## Status do projeto

Estado atual: protótipo funcional de frontend com recursos de dashboard, autenticação, modo demo e integração planejada/implementada com serviços externos.

Antes de produção, ainda é necessário endurecer a camada de segurança, principalmente qualquer fluxo que possa enviar ordens reais para exchange.

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
- Modo real conectado a dados/ações da Bybit, quando configurado.
- Painéis para posições, ordens, logs, decisões de IA e oportunidades.
- Estrutura para bot autônomo de trading.

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
VITE_ENABLE_REAL_TRADING=false
VITE_DEFAULT_TRADING_MODE=demo
```

Nunca coloque chaves secretas da Bybit ou de qualquer exchange no frontend. Chaves sensíveis devem ficar apenas em ambiente seguro de backend, como Supabase Edge Functions ou outro serviço server-side controlado.

## Modos de operação

### Demo

Modo seguro para desenvolvimento visual e simulação. Deve ser o modo padrão.

### Testnet / Paper trading

Modo obrigatório antes de qualquer operação com dinheiro real. Use para validar ordens, stop loss, take profit, alavancagem, limites e falhas de API.

### Real trading

Modo de alto risco. Só deve ser habilitado após validação completa em testnet e com travas server-side.

Requisitos mínimos antes de liberar real trading:

- Flag explícita de ambiente para habilitar operação real.
- Validação server-side de todas as ordens.
- Whitelist de ações permitidas.
- Limite de risco por trade.
- Limite de drawdown diário.
- Stop loss obrigatório.
- Kill switch global.
- Logs auditáveis de todas as ações.
- Proteção contra ordens duplicadas.
- Separação clara entre testnet e mainnet.

## Segurança operacional

O frontend não deve ser a autoridade de segurança. Qualquer regra crítica precisa ser validada no backend/Edge Function.

Ações sensíveis, como `placeOrder`, `cancelOrder`, `setLeverage`, `closePosition` e `closeAllPositions`, devem passar por validação server-side antes de chegar na exchange.

## Deploy

O projeto pode ser publicado em plataformas compatíveis com Vite, como Vercel, Netlify, Cloudflare Pages ou Lovable. Antes de publicar, configure corretamente as variáveis de ambiente da plataforma.

Para build local:

```bash
npm run build
npm run preview
```

## Próximos passos recomendados

1. Criar `.env.example` seguro.
2. Travar real trading por padrão no frontend.
3. Auditar a Supabase Edge Function `bybit-api`.
4. Criar risk engine server-side.
5. Adicionar testes mínimos para impedir operação real acidental.
6. Documentar deploy e operação por ambiente: demo, testnet e produção.

## Licença

Uso privado do proprietário do repositório, salvo definição posterior de licença.
