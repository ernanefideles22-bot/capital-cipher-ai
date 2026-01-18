import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Generate signature for Bybit API (POST uses JSON body in signature)
async function generateSignaturePost(body: string, timestamp: number, recvWindow: number): Promise<string> {
  const signPayload = `${timestamp}${BYBIT_API_KEY}${recvWindow}${body}`;
  
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
  
  const headers: Record<string, string> = {
    "X-BAPI-API-KEY": BYBIT_API_KEY,
    "X-BAPI-TIMESTAMP": timestamp.toString(),
    "X-BAPI-RECV-WINDOW": recvWindow.toString(),
    "Content-Type": "application/json",
  };

  let url: string;
  let fetchOptions: RequestInit;

  if (method === "POST") {
    // POST: body is JSON, signature uses the JSON body
    const body = JSON.stringify(params);
    const signature = await generateSignaturePost(body, timestamp, recvWindow);
    headers["X-BAPI-SIGN"] = signature;
    url = `${BYBIT_BASE_URL}${endpoint}`;
    fetchOptions = { method, headers, body };
  } else {
    // GET: params in query string, signature uses query string
    const signature = await generateSignature(params, timestamp, recvWindow);
    headers["X-BAPI-SIGN"] = signature;
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");
    url = `${BYBIT_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ""}`;
    fetchOptions = { method, headers };
  }
  
  console.log(`Bybit API call: ${method} ${endpoint}`);
  const response = await fetch(url, fetchOptions);
  const result = await response.json();
  console.log(`Bybit API response: retCode=${result.retCode}, retMsg=${result.retMsg}`);
  return result;
}

// Authenticate user via JWT
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const auth = await authenticateUser(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", retCode: -1 }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if Bybit API credentials are configured
    if (!BYBIT_API_KEY || !BYBIT_API_SECRET) {
      return new Response(
        JSON.stringify({ error: "API credentials not configured", retCode: -1 }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
    // Never log or expose sensitive information in errors
    const errorMessage = error instanceof Error ? error.message : "Request failed";
    
    // Sanitize error message to prevent credential leakage
    const safeErrorMessage = errorMessage
      .replace(new RegExp(BYBIT_API_KEY, 'g'), '[REDACTED]')
      .replace(new RegExp(BYBIT_API_SECRET, 'g'), '[REDACTED]');
    
    console.error("Bybit API error occurred");
    
    return new Response(
      JSON.stringify({ error: safeErrorMessage, retCode: -1 }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
