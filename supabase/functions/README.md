# ⚡ Supabase Edge Functions Documentation

Este diretório contém as **Edge Functions** (serverless Deno runtimes) que lidam com a lógica confidencial de backend, integrações com APIs e processamento pesado de inteligência artificial do **Capital Cipher AI**.

---

## 📋 Sumário de Funções

| Função | Descrição | Nível de Acesso |
|--------|-----------|-----------------|
| [**`bybit-api`**](./bybit-api) | Proxy seguro e mecanismo de controle de risco para ordens de trading na Bybit. | Autenticado (JWT do usuário) |
| [**`elevenlabs-tts`**](./elevenlabs-tts) | Conversão de texto para voz (Text-to-Speech) para alertas e avisos do painel. | Autenticado (JWT do usuário) |
| [**`market-analysis`**](./market-analysis) | Processa indicadores técnicos clássicos de mercado (RSI, EMA, Bollinger, MACD). | Autenticado (JWT do usuário) |
| [**`multi-pair-analysis`**](./multi-pair-analysis) | Escaneia múltiplos pares em busca de melhores oportunidades de trade sincronizadas. | Autenticado (JWT do usuário) |
| [**`neural-training`**](./neural-training) | Treina a rede neural do robô com base em experiências e histórico de trades passados. | Autenticado (JWT do usuário) |
| [**`trading-ai`**](./trading-ai) | Cérebro de IA do robô. Toma decisões (`BUY`/`SELL`/`HOLD`) com base em indicadores. | Autenticado (JWT do usuário) |

---

## 🛠️ Detalhes das Funções

### 1. `bybit-api`
Responsável por fazer a ponte entre o frontend e a Bybit, funcionando como o **Risk Engine** principal. Nenhuma ordem vai para a Bybit sem passar pelas validações server-side desta função.

- **Método**: `POST`
- **Headers**:
  - `Authorization: Bearer <USER_JWT>`
- **Payload de Entrada**:
  ```json
  {
    "action": "placeOrder" | "cancelOrder" | "setLeverage" | "closePosition",
    "symbol": "BTCUSDT",
    "side": "BUY" | "SELL",
    "quantity": 0.05,
    "leverage": 5,
    "stopLoss": 92000.0,
    "takeProfit": 98000.0,
    "orderId": "opcional-para-cancelamento"
  }
  ```
- **Fluxo de Segurança**:
  1. Valida o JWT do usuário e carrega o perfil do banco.
  2. Verifica se o robô está configurado como `live` (se estiver como `paper`, rejeita e executa no simulador).
  3. Verifica se o drawdown atual ou perda diária ultrapassaram os limites definidos em `profiles.bot_config`.
  4. Executa a ordem na Bybit utilizando as chaves seguras do banco.

---

### 2. `elevenlabs-tts`
Gera áudio em formato de voz a partir de logs ou sinais de trade, dando alertas sonoros realistas para o usuário no dashboard.

- **Método**: `POST`
- **Payload de Entrada**:
  ```json
  {
    "text": "Alerta: Posição de compra aberta para BTCUSDT a noventa e cinco mil dólares.",
    "voiceId": "opcional-id-da-voz"
  }
  ```
- **Resposta**: Retorna o arquivo de áudio binário diretamente (`audio/mpeg`).

---

### 3. `market-analysis`
Computa indicadores técnicos a partir de dados brutos de preços.

- **Método**: `POST`
- **Payload de Entrada**:
  ```json
  {
    "symbol": "ETHUSDT",
    "timeframe": "1h" | "15m" | "4h",
    "limit": 100
  }
  ```
- **Resposta**:
  ```json
  {
    "symbol": "ETHUSDT",
    "indicators": {
      "rsi": 58.4,
      "macd": { "line": 12.5, "signal": 10.2, "hist": 2.3 },
      "bollinger": { "upper": 3250.0, "middle": 3200.0, "lower": 3150.0 },
      "ema200": 3180.5
    }
  }
  ```

---

### 4. `multi-pair-analysis`
Analisa múltiplos pares de trading em lote para identificar qual deles apresenta as melhores métricas combinadas de entrada ou saída de trade.

- **Método**: `POST`
- **Payload de Entrada**:
  ```json
  {
    "symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
    "timeframe": "15m"
  }
  ```
- **Resposta**: Retorna um array ordenado das melhores oportunidades com pontuações de confiança e tendência.

---

### 5. `neural-training`
Mecanismo de Backprop / Otimização da IA. Carrega as experiências salvas em `trade_experiences`, calcula melhorias de pesos da rede neural e as armazena de volta na tabela `neural_network_state`.

- **Método**: `POST`
- **Payload de Entrada**:
  ```json
  {
    "epochs": 10,
    "learningRate": 0.01
  }
  ```
- **Resposta**: Resumo do ciclo de treinamento com acurácia obtida antes e depois das atualizações.

---

### 6. `trading-ai`
Recebe dados analíticos do mercado e executa inferência sobre os pesos atuais do modelo do usuário para emitir uma recomendação formal de trade autônomo.

- **Método**: `POST`
- **Payload de Entrada**:
  ```json
  {
    "symbol": "SOLUSDT",
    "marketData": { "price": 180.5, "change24h": 2.5 },
    "indicators": { "rsi": 72.0, "volume": 120000.0 }
  }
  ```
- **Resposta**:
  ```json
  {
    "decision": "BUY" | "SELL" | "HOLD" | "SKIP",
    "confidence": 88.5,
    "reasoning": "Forte rejeição no suporte combinado com fluxo comprador crescente e Stoch RSI ascendente."
  }
  ```

---

## 🔒 Segurança e CORS
Todas as Edge Functions possuem cabeçalhos CORS restritivos. Elas respondem apenas a requisições autenticadas (exceto a requisição prévia de voo `OPTIONS`) e exigem um cabeçalho de autenticação válido com token JWT válido emitido pelo Supabase Auth.
