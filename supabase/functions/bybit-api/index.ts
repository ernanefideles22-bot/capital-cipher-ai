import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BYBIT_API_KEY = Deno.env.get("BYBIT_API_KEY") || "";
const BYBIT_API_SECRET = Deno.env.get("BYBIT_API_SECRET") || "";
const BYBIT_BASE_URL = "https://api.bybit.com";

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
  
  const signature = await generateSignature(params, timestamp, recvWindow);
  
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  
  const url = `${BYBIT_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ""}`;
  
  const headers = {
    "X-BAPI-API-KEY": BYBIT_API_KEY,
    "X-BAPI-SIGN": signature,
    "X-BAPI-TIMESTAMP": timestamp.toString(),
    "X-BAPI-RECV-WINDOW": recvWindow.toString(),
    "Content-Type": "application/json",
  };
  
  const response = await fetch(url, { method, headers });
  return await response.json();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params = {} } = await req.json();

    let result;

    switch (action) {
      case "getWalletBalance":
        result = await bybitRequest("/v5/account/wallet-balance", "GET", {
          accountType: params.accountType || "UNIFIED",
        });
        break;

      case "getTickers":
        result = await bybitRequest("/v5/market/tickers", "GET", {
          category: params.category || "linear",
          symbol: params.symbol,
        });
        break;

      case "getKline":
        result = await bybitRequest("/v5/market/kline", "GET", {
          category: "linear",
          symbol: params.symbol,
          interval: params.interval || "15",
          limit: params.limit || 200,
        });
        break;

      case "getPositions":
        result = await bybitRequest("/v5/position/list", "GET", {
          category: "linear",
          settleCoin: "USDT",
        });
        break;

      case "getOrders":
        result = await bybitRequest("/v5/order/realtime", "GET", {
          category: "linear",
          settleCoin: "USDT",
        });
        break;

      case "getOrderHistory":
        result = await bybitRequest("/v5/order/history", "GET", {
          category: "linear",
          limit: params.limit || 50,
        });
        break;

      case "getClosedPnL":
        result = await bybitRequest("/v5/position/closed-pnl", "GET", {
          category: "linear",
          limit: params.limit || 50,
        });
        break;

      case "placeOrder":
        const orderParams = {
          category: "linear",
          symbol: params.symbol,
          side: params.side,
          orderType: params.orderType || "Market",
          qty: params.qty.toString(),
          timeInForce: "GTC",
          positionIdx: 0,
        };
        
        if (params.takeProfit) {
          Object.assign(orderParams, { takeProfit: params.takeProfit.toString() });
        }
        if (params.stopLoss) {
          Object.assign(orderParams, { stopLoss: params.stopLoss.toString() });
        }
        
        result = await bybitRequest("/v5/order/create", "POST", orderParams);
        break;

      case "cancelOrder":
        result = await bybitRequest("/v5/order/cancel", "POST", {
          category: "linear",
          symbol: params.symbol,
          orderId: params.orderId,
        });
        break;

      case "setLeverage":
        result = await bybitRequest("/v5/position/set-leverage", "POST", {
          category: "linear",
          symbol: params.symbol,
          buyLeverage: params.leverage.toString(),
          sellLeverage: params.leverage.toString(),
        });
        break;

      case "testConnection":
        result = await bybitRequest("/v5/user/query-api", "GET", {});
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Bybit API error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, retCode: -1 }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});