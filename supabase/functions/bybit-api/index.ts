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
const BYBIT_ENVIRONMENT = Deno.env.get("BYBIT_ENVIRONMENT") || "testnet";
const ENABLE_REAL_TRADING = Deno.env.get("ENABLE_REAL_TRADING") === "true";
const MAX_LEVERAGE = Number(Deno.env.get("MAX_LEVERAGE") || "3");
const REQUIRE_STOP_LOSS = Deno.env.get("REQUIRE_STOP_LOSS") !== "false";
const REQUIRE_TAKE_PROFIT = Deno.env.get("REQUIRE_TAKE_PROFIT") !== "false";
const GLOBAL_KILL_SWITCH = Deno.env.get("GLOBAL_KILL_SWITCH") === "true";

const BYBIT_BASE_URL = BYBIT_ENVIRONMENT === "mainnet"
  ? "https://api.bybit.com"
  : "https://api-testnet.bybit.com";

const READ_ACTIONS = new Set([
  "getWalletBalance",
  "getTickers",
  "getKline",
  "getPositions",
  "getOrders",
  "getOrderHistory",
  "getClosedPnL",
  "testConnection",
]);

const SENSITIVE_ACTIONS = new Set([
  "placeOrder",
  "cancelOrder",
  "setLeverage",
]);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeErrorMessage(message: string): string {
  let safe = message;
  if (BYBIT_API_KEY) safe = safe.replaceAll(BYBIT_API_KEY, "[REDACTED]");
  if (BYBIT_API_SECRET) safe = safe.replaceAll(BYBIT_API_SECRET, "[REDACTED]");
  return safe;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value.trim().toUpperCase();
}

function requirePositiveNumber(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${field}`);
  }
  return parsed;
}

function validateSymbol(value: unknown): string {
  const symbol = requireString(value, "symbol");
  if (!/^[A-Z0-9]{6,20}$/.test(symbol) || !symbol.endsWith("USDT")) {
    throw new Error("Invalid symbol. Only USDT linear symbols are allowed.");
  }
  return symbol;
}

function validateSide(value: unknown): "Buy" | "Sell" {
  if (value !== "Buy" && value !== "Sell") {
    throw new Error("Invalid side");
  }
  return value;
}

function validateOrderType(value: unknown): "Market" | "Limit" {
  if (value === undefined || value === null) return "Market";
  if (value !== "Market" && value !== "Limit") {
    throw new Error("Invalid orderType");
  }
  return value;
}

function validateLeverage(value: unknown): number {
  const leverage = requirePositiveNumber(value, "leverage");
  if (!Number.isInteger(leverage) || leverage > MAX_LEVERAGE) {
    throw new Error(`Invalid leverage. Max allowed leverage is ${MAX_LEVERAGE}x.`);
  }
  return leverage;
}

function assertActionAllowed(action: unknown): string {
  if (typeof action !== "string") throw new Error("Invalid action");
  if (!READ_ACTIONS.has(action) && !SENSITIVE_ACTIONS.has(action)) {
    throw new Error(`Unknown action: ${action}`);
  }
  if (GLOBAL_KILL_SWITCH && SENSITIVE_ACTIONS.has(action)) {
    throw new Error("Global kill switch is enabled. Trading actions are blocked.");
  }
  if (SENSITIVE_ACTIONS.has(action) && !ENABLE_REAL_TRADING) {
    throw new Error("Real trading is disabled server-side. Set ENABLE_REAL_TRADING=true only after risk controls are active.");
  }
  return action;
}

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
    const body = JSON.stringify(params);
    headers["X-BAPI-SIGN"] = await generateSignaturePost(body, timestamp, recvWindow);
    url = `${BYBIT_BASE_URL}${endpoint}`;
    fetchOptions = { method, headers, body };
  } else {
    headers["X-BAPI-SIGN"] = await generateSignature(params, timestamp, recvWindow);
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");
    url = `${BYBIT_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ""}`;
    fetchOptions = { method, headers };
  }

  console.log(`Bybit API call: ${method} ${endpoint} env=${BYBIT_ENVIRONMENT}`);
  const response = await fetch(url, fetchOptions);
  const result = await response.json();
  console.log(`Bybit API response: retCode=${result.retCode}, retMsg=${result.retMsg}`);
  return result;
}

async function authenticateUser(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) return null;
  return { userId: user.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await authenticateUser(req);
    if (!auth) return jsonResponse({ error: "Unauthorized", retCode: -1 }, 401);

    if (!BYBIT_API_KEY || !BYBIT_API_SECRET) {
      return jsonResponse({ error: "API credentials not configured", retCode: -1 }, 500);
    }

    const body = await req.json();
    if (!isPlainObject(body)) throw new Error("Invalid request body");

    const action = assertActionAllowed(body.action);
    const params = isPlainObject(body.params) ? body.params : {};

    let result;

    switch (action) {
      case "getWalletBalance":
        result = await bybitRequest("/v5/account/wallet-balance", "GET", {
          accountType: typeof params.accountType === "string" ? params.accountType : "UNIFIED",
        });
        break;

      case "getTickers":
        result = await bybitRequest("/v5/market/tickers", "GET", {
          category: "linear",
          symbol: validateSymbol(params.symbol),
        });
        break;

      case "getKline":
        result = await bybitRequest("/v5/market/kline", "GET", {
          category: "linear",
          symbol: validateSymbol(params.symbol),
          interval: typeof params.interval === "string" ? params.interval : "15",
          limit: Math.min(Number(params.limit || 200), 1000),
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
          limit: Math.min(Number(params.limit || 50), 200),
        });
        break;

      case "getClosedPnL":
        result = await bybitRequest("/v5/position/closed-pnl", "GET", {
          category: "linear",
          limit: Math.min(Number(params.limit || 50), 200),
        });
        break;

      case "placeOrder": {
        const symbol = validateSymbol(params.symbol);
        const side = validateSide(params.side);
        const orderType = validateOrderType(params.orderType);
        const qty = requirePositiveNumber(params.qty, "qty");
        const reduceOnly = params.reduceOnly === true || params.reduceOnly === "true";

        if (!reduceOnly && REQUIRE_STOP_LOSS && !params.stopLoss) {
          throw new Error("stopLoss is required for opening orders");
        }
        if (!reduceOnly && REQUIRE_TAKE_PROFIT && !params.takeProfit) {
          throw new Error("takeProfit is required for opening orders");
        }

        const orderParams: Record<string, string | number> = {
          category: "linear",
          symbol,
          side,
          orderType,
          qty: qty.toString(),
          timeInForce: "GTC",
          positionIdx: 0,
        };

        if (reduceOnly) orderParams.reduceOnly = "true";
        if (params.takeProfit) orderParams.takeProfit = requirePositiveNumber(params.takeProfit, "takeProfit").toString();
        if (params.stopLoss) orderParams.stopLoss = requirePositiveNumber(params.stopLoss, "stopLoss").toString();
        if (orderType === "Limit") orderParams.price = requirePositiveNumber(params.price, "price").toString();

        console.log(`Placing Bybit order: ${side} ${symbol} qty=${qty} reduceOnly=${reduceOnly}`);
        result = await bybitRequest("/v5/order/create", "POST", orderParams);
        break;
      }

      case "cancelOrder":
        result = await bybitRequest("/v5/order/cancel", "POST", {
          category: "linear",
          symbol: validateSymbol(params.symbol),
          orderId: requireString(params.orderId, "orderId"),
        });
        break;

      case "setLeverage": {
        const leverage = validateLeverage(params.leverage);
        result = await bybitRequest("/v5/position/set-leverage", "POST", {
          category: "linear",
          symbol: validateSymbol(params.symbol),
          buyLeverage: leverage.toString(),
          sellLeverage: leverage.toString(),
        });
        break;
      }

      case "testConnection":
        result = await bybitRequest("/v5/user/query-api", "GET", {});
        break;
    }

    return jsonResponse(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Request failed";
    const safeErrorMessage = sanitizeErrorMessage(errorMessage);
    console.error("Bybit API error occurred");
    return jsonResponse({ error: safeErrorMessage, retCode: -1 }, 500);
  }
});
