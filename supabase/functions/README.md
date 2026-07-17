# ⚡ Supabase Edge Functions Documentation

Este diretório contém as **Edge Functions** (serverless Deno runtimes) que lidam com a lógica confidencial de backend, integrações com APIs e processamento pesado de inteligência artificial do **Capital Cipher AI**.

---

## 📋 Sumário de Funções

| Função | Descrição | Nível de Acesso |
|--------|-----------|-----------------|
| [**`bybit-api`**](./bybit-api) | Endpoint legado congelado. Retorna HTTP 410 e não acessa exchanges. | Autenticado (JWT do usuário) |
| [**`elevenlabs-tts`**](./elevenlabs-tts) | Conversão de texto para voz (Text-to-Speech) para alertas e avisos do painel. | Autenticado (JWT do usuário) |
| [**`market-analysis`**](./market-analysis) | Processa indicadores técnicos clássicos de mercado (RSI, EMA, Bollinger, MACD). | Autenticado (JWT do usuário) |
| [**`multi-pair-analysis`**](./multi-pair-analysis) | Escaneia múltiplos pares em busca de melhores oportunidades de trade sincronizadas. | Autenticado (JWT do usuário) |
| [**`neural-training`**](./neural-training) | Treina a rede neural do robô com base em experiências e histórico de trades passados. | Autenticado (JWT do usuário) |
| [**`trading-ai`**](./trading-ai) | Endpoint legado congelado. Retorna HTTP 410 e não analisa nem executa operações. | Autenticado (JWT do usuário) |

---

## 🛠️ Detalhes das Funções

### 1. `bybit-api`
Endpoint desativado. Qualquer requisição autenticada recebe HTTP 410 com o código `LEGACY_EXCHANGE_ACCESS_FROZEN`. O código não lê credenciais, não consulta contas e não envia ordens.

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
Endpoint desativado. Qualquer requisição autenticada recebe HTTP 410 com o código `LEGACY_TRADING_FROZEN`. O código não chama modelos de IA, não lê posições e não envia ordens.

---

## 🔒 Segurança e CORS
Todas as Edge Functions exigem validação JWT no gateway conforme `supabase/config.toml`. O congelamento só estará ativo no ambiente hospedado depois da implantação das funções e da revogação das credenciais históricas.
