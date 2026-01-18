import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BYBIT_API_KEY = Deno.env.get("BYBIT_API_KEY") || "";
const BYBIT_API_SECRET = Deno.env.get("BYBIT_API_SECRET") || "";
const BYBIT_BASE_URL = "https://api.bybit.com";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

// Generate signature for Bybit API
async function generateSignature(params: Record<string, string | number>, timestamp: number, recvWindow: number): Promise<string> {
  const queryString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  
  const signPayload = `${timestamp}${BYBIT_API_KEY}${recvWindow}${queryString}`;
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(BYBIT_API_SECRET);
  const messageData = encoder.encode(signPayload);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return new TextDecoder().decode(encode(new Uint8Array(signature)));
}

// Make authenticated request to Bybit
async function bybitRequest(endpoint: string, method: string = "GET", params: Record<string, string | number> = {}) {
  const timestamp = Date.now();
  const recvWindow = 5000;
  
  let url: string;
  let body: string | undefined;
  let signPayload: string;
  
  if (method === "POST") {
    // For POST requests, body is JSON and signature includes body
    const jsonBody = JSON.stringify(params);
    signPayload = `${timestamp}${BYBIT_API_KEY}${recvWindow}${jsonBody}`;
    url = `${BYBIT_BASE_URL}${endpoint}`;
    body = jsonBody;
  } else {
    // For GET requests, params go in query string
    const queryString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    signPayload = `${timestamp}${BYBIT_API_KEY}${recvWindow}${queryString}`;
    url = `${BYBIT_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ""}`;
  }
  
  // Generate signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(BYBIT_API_SECRET);
  const messageData = encoder.encode(signPayload);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const signature = new TextDecoder().decode(encode(new Uint8Array(signatureBuffer)));
  
  const headers: Record<string, string> = {
    "X-BAPI-API-KEY": BYBIT_API_KEY,
    "X-BAPI-SIGN": signature,
    "X-BAPI-TIMESTAMP": timestamp.toString(),
    "X-BAPI-RECV-WINDOW": recvWindow.toString(),
    "Content-Type": "application/json",
  };
  
  console.log(`Bybit ${method} ${endpoint}`, method === "POST" ? body : params);
  
  const response = await fetch(url, { 
    method, 
    headers,
    ...(body ? { body } : {}),
  });
  
  const result = await response.json();
  console.log(`Bybit response:`, result);
  return result;
}

// Fetch market data from Bybit
async function getMarketData(symbol: string) {
  const [ticker, klines] = await Promise.all([
    bybitRequest("/v5/market/tickers", "GET", { category: "linear", symbol }),
    bybitRequest("/v5/market/kline", "GET", { category: "linear", symbol, interval: "15", limit: 50 }),
  ]);
  
  return {
    ticker: ticker?.result?.list?.[0] || null,
    klines: klines?.result?.list || [],
  };
}

// Calculate technical indicators
function calculateIndicators(klines: any[]) {
  if (klines.length < 14) return null;
  
  // Klines format: [startTime, open, high, low, close, volume, turnover]
  const closes = klines.map(k => parseFloat(k[4])).reverse();
  const highs = klines.map(k => parseFloat(k[2])).reverse();
  const lows = klines.map(k => parseFloat(k[3])).reverse();
  const volumes = klines.map(k => parseFloat(k[5])).reverse();
  
  // Calculate RSI (14 periods)
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);
  
  const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  // Calculate EMAs
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  
  // Calculate MACD
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12 - ema26;
  
  // Volume trend
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = currentVolume / avgVolume;
  
  // Price momentum
  const priceChange1h = ((closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5]) * 100;
  const priceChange4h = ((closes[closes.length - 1] - closes[closes.length - 17]) / closes[closes.length - 17]) * 100;
  
  return {
    rsi: Math.round(rsi * 100) / 100,
    ema9: Math.round(ema9 * 100) / 100,
    ema21: Math.round(ema21 * 100) / 100,
    macd: Math.round(macd * 100) / 100,
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    priceChange1h: Math.round(priceChange1h * 100) / 100,
    priceChange4h: Math.round(priceChange4h * 100) / 100,
    currentPrice: closes[closes.length - 1],
    trend: ema9 > ema21 ? "bullish" : "bearish",
  };
}

function calculateEMA(data: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  
  return ema;
}

// Analyze with Lovable AI
async function analyzeWithAI(symbol: string, indicators: any, positions: any[], config: any) {
  const systemPrompt = `You are a professional crypto trading AI analyst. Your job is to analyze market data and provide trading decisions.

RULES:
- Be conservative with entries, look for high-probability setups
- Always consider risk management (max ${config.maxDrawdown}% drawdown allowed)
- Current leverage: ${config.leverage}x
- Max position size: ${config.positionSize}% of balance
- Only trade when confidence is above 70%

RESPONSE FORMAT (JSON only, no markdown):
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": 0-100,
  "reasoning": "brief explanation",
  "entry": number or null,
  "takeProfit": number or null,
  "stopLoss": number or null,
  "riskRewardRatio": number or null
}`;

  const userPrompt = `Analyze ${symbol} for trading opportunity:

CURRENT INDICATORS:
- Price: $${indicators.currentPrice}
- RSI (14): ${indicators.rsi}
- EMA 9: $${indicators.ema9}
- EMA 21: $${indicators.ema21}
- MACD: ${indicators.macd}
- Volume Ratio: ${indicators.volumeRatio}x average
- 1h Change: ${indicators.priceChange1h}%
- 4h Change: ${indicators.priceChange4h}%
- Trend: ${indicators.trend}

CURRENT POSITIONS: ${positions.length > 0 ? JSON.stringify(positions) : "None"}

Provide your analysis and trading decision.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("AI Gateway error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
    }
    
    return null;
  } catch (error) {
    console.error("AI analysis error:", error);
    return null;
  }
}

// Execute trade on Bybit
async function executeTrade(symbol: string, decision: any, config: any) {
  if (decision.action === "HOLD" || decision.confidence < 70) {
    return { executed: false, reason: "Confidence too low or HOLD signal" };
  }

  // Get wallet balance first
  const wallet = await bybitRequest("/v5/account/wallet-balance", "GET", { accountType: "UNIFIED" });
  const availableBalance = parseFloat(wallet?.result?.list?.[0]?.totalAvailableBalance || "0");
  
  if (availableBalance < 10) {
    return { executed: false, reason: "Insufficient balance" };
  }

  // Calculate position size
  const positionValue = availableBalance * (config.positionSize / 100);
  const qty = Math.floor((positionValue / decision.entry) * 1000) / 1000;
  
  if (qty < 0.001) {
    return { executed: false, reason: "Position size too small" };
  }

  // Place order
  const orderParams: Record<string, string | number> = {
    category: "linear",
    symbol: symbol,
    side: decision.action === "BUY" ? "Buy" : "Sell",
    orderType: "Market",
    qty: qty.toString(),
    timeInForce: "GTC",
    positionIdx: 0,
  };

  if (decision.takeProfit) {
    orderParams.takeProfit = decision.takeProfit.toString();
  }
  if (decision.stopLoss) {
    orderParams.stopLoss = decision.stopLoss.toString();
  }

  const result = await bybitRequest("/v5/order/create", "POST", orderParams);
  
  return {
    executed: result?.retCode === 0,
    orderId: result?.result?.orderId,
    reason: result?.retMsg || "Order placed",
    details: {
      symbol,
      side: decision.action,
      qty,
      entry: decision.entry,
      takeProfit: decision.takeProfit,
      stopLoss: decision.stopLoss,
    }
  };
}

// Authenticate user
async function authenticateUser(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  return { userId: user.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticateUser(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!BYBIT_API_KEY || !BYBIT_API_SECRET) {
      return new Response(
        JSON.stringify({ error: "Bybit API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Lovable AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, symbol = "BTCUSDT", config = {} } = await req.json();
    
    const defaultConfig = {
      leverage: 10,
      positionSize: 5,
      maxDrawdown: 10,
      ...config,
    };

    switch (action) {
      case "analyze": {
        console.log(`Analyzing ${symbol}...`);
        
        // Get market data
        const marketData = await getMarketData(symbol);
        if (!marketData.ticker) {
          throw new Error("Failed to fetch market data");
        }
        
        // Calculate indicators
        const indicators = calculateIndicators(marketData.klines);
        if (!indicators) {
          throw new Error("Insufficient data for analysis");
        }
        
        // Get current positions
        const positionsResult = await bybitRequest("/v5/position/list", "GET", { category: "linear", settleCoin: "USDT" });
        const positions = positionsResult?.result?.list?.filter((p: any) => parseFloat(p.size) > 0) || [];
        
        // AI Analysis
        const decision = await analyzeWithAI(symbol, indicators, positions, defaultConfig);
        
        return new Response(
          JSON.stringify({
            success: true,
            symbol,
            indicators,
            decision,
            positions,
            ticker: {
              price: parseFloat(marketData.ticker.lastPrice),
              change24h: parseFloat(marketData.ticker.price24hPcnt) * 100,
              volume24h: parseFloat(marketData.ticker.volume24h),
              high24h: parseFloat(marketData.ticker.highPrice24h),
              low24h: parseFloat(marketData.ticker.lowPrice24h),
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "execute": {
        console.log(`Executing trade for ${symbol}...`);
        
        const { decision } = await req.json();
        if (!decision) {
          throw new Error("No decision provided");
        }
        
        const result = await executeTrade(symbol, decision, defaultConfig);
        
        return new Response(
          JSON.stringify({ success: true, ...result }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "autoTrade": {
        console.log(`Auto trading ${symbol}...`);
        
        // Get market data
        const marketData = await getMarketData(symbol);
        if (!marketData.ticker) {
          throw new Error("Failed to fetch market data");
        }
        
        // Calculate indicators
        const indicators = calculateIndicators(marketData.klines);
        if (!indicators) {
          throw new Error("Insufficient data for analysis");
        }
        
        // Get current positions
        const positionsResult = await bybitRequest("/v5/position/list", "GET", { category: "linear", settleCoin: "USDT" });
        const positions = positionsResult?.result?.list?.filter((p: any) => parseFloat(p.size) > 0) || [];
        
        // AI Analysis
        const decision = await analyzeWithAI(symbol, indicators, positions, defaultConfig);
        
        let tradeResult = null;
        if (decision && decision.action !== "HOLD" && decision.confidence >= 70) {
          tradeResult = await executeTrade(symbol, decision, defaultConfig);
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            symbol,
            indicators,
            decision,
            tradeResult,
            ticker: {
              price: parseFloat(marketData.ticker.lastPrice),
              change24h: parseFloat(marketData.ticker.price24hPcnt) * 100,
              volume24h: parseFloat(marketData.ticker.volume24h),
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    console.error("Trading AI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});