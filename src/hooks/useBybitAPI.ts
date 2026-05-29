import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BybitResponse {
  retCode: number;
  retMsg?: string;
  result?: any;
  time?: number;
  error?: string;
}

interface WalletBalance {
  totalEquity: number;
  totalWalletBalance: number;
  totalAvailableBalance: number;
  totalPnL: number;
}

interface Position {
  symbol: string;
  side: 'Buy' | 'Sell';
  size: string;
  avgPrice: string;
  unrealisedPnl: string;
  leverage: string;
  takeProfit: string;
  stopLoss: string;
}

interface ClosedTrade {
  symbol: string;
  side: string;
  closedPnl: string;
  avgEntryPrice: string;
  avgExitPrice: string;
  qty: string;
  createdTime: string;
  updatedTime: string;
}

interface OrderHistory {
  orderId: string;
  symbol: string;
  side: string;
  orderType: string;
  qty: string;
  price: string;
  avgPrice: string;
  orderStatus: string;
  createdTime: string;
  updatedTime: string;
  takeProfit: string;
  stopLoss: string;
  cumExecQty: string;
  cumExecValue: string;
}

const REAL_TRADING_ENABLED = import.meta.env.VITE_ENABLE_REAL_TRADING === 'true';
const REAL_TRADING_DISABLED_MESSAGE = 'Real trading is disabled. Set VITE_ENABLE_REAL_TRADING=true only after server-side risk controls are active.';

function blockedRealTradingResponse(action: string): BybitResponse {
  return {
    retCode: -9001,
    retMsg: REAL_TRADING_DISABLED_MESSAGE,
    error: `Blocked sensitive Bybit action: ${action}`,
    time: Date.now(),
  };
}

// Global rate limiting and caching
const requestQueue: Array<{
  action: string;
  params: Record<string, any>;
  resolve: (value: BybitResponse | null) => void;
  reject: (reason?: any) => void;
}> = [];

let isProcessingQueue = false;
const MIN_REQUEST_INTERVAL = 150; // 150ms between requests to avoid rate limiting
let lastRequestTime = 0;

// Request deduplication cache
interface CacheEntry {
  data: BybitResponse | null;
  timestamp: number;
}
const requestCache = new Map<string, CacheEntry>();
const CACHE_TTL = 2000; // 2 second cache for most requests
const CACHE_TTL_SHORT = 500; // 0.5 second for frequently changing data

// Pending requests deduplication
const pendingRequests = new Map<string, Promise<BybitResponse | null>>();

function getCacheKey(action: string, params: Record<string, any>): string {
  return `${action}:${JSON.stringify(params)}`;
}

function getCacheTTL(action: string): number {
  // Use shorter TTL for frequently changing data
  if (['getPositions', 'getWalletBalance', 'getOrders'].includes(action)) {
    return CACHE_TTL_SHORT;
  }
  return CACHE_TTL;
}

async function processQueue(): Promise<void> {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (!request) continue;
    
    const { action, params, resolve, reject } = request;
    
    // Rate limiting: wait if needed
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    
    try {
      lastRequestTime = Date.now();
      
      const { data, error: fnError } = await supabase.functions.invoke('bybit-api', {
        body: { action, params },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      // Cache the result
      const cacheKey = getCacheKey(action, params);
      requestCache.set(cacheKey, {
        data: data as BybitResponse,
        timestamp: Date.now(),
      });

      resolve(data as BybitResponse);
    } catch (err: any) {
      reject(err);
    }
  }
  
  isProcessingQueue = false;
}

async function queueRequest(action: string, params: Record<string, any>): Promise<BybitResponse | null> {
  const cacheKey = getCacheKey(action, params);
  
  // Check cache first
  const cached = requestCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < getCacheTTL(action)) {
    return cached.data;
  }
  
  // Check if there's already a pending request for the same action/params
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }
  
  // Create a new promise for this request
  const promise = new Promise<BybitResponse | null>((resolve, reject) => {
    requestQueue.push({ action, params, resolve, reject });
    processQueue();
  });
  
  // Store as pending
  pendingRequests.set(cacheKey, promise);
  
  // Clean up pending request after it resolves
  promise.finally(() => {
    pendingRequests.delete(cacheKey);
  });
  
  return promise;
}

export function useBybitAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  
  // Debounce ref to prevent rapid successive calls
  const lastCallRef = useRef<Record<string, number>>({});

  const blockIfRealTradingDisabled = useCallback((action: string): BybitResponse | null => {
    if (REAL_TRADING_ENABLED) {
      return null;
    }

    const blocked = blockedRealTradingResponse(action);
    setError(blocked.retMsg || REAL_TRADING_DISABLED_MESSAGE);
    return blocked;
  }, []);

  const callBybitAPI = useCallback(
    async (action: string, params: Record<string, any> = {}, options?: { skipDebounce?: boolean }): Promise<BybitResponse | null> => {
      const cacheKey = getCacheKey(action, params);
      
      // Debounce check (except for order placement)
      if (!options?.skipDebounce && !['placeOrder', 'cancelOrder', 'setLeverage'].includes(action)) {
        const lastCall = lastCallRef.current[cacheKey] || 0;
        const now = Date.now();
        if (now - lastCall < 500) {
          // Return cached data if available
          const cached = requestCache.get(cacheKey);
          if (cached) {
            return cached.data;
          }
        }
        lastCallRef.current[cacheKey] = now;
      }
      
      setLoading(true);
      setError(null);

      try {
        const data = await queueRequest(action, params);

        // Return payload even on Bybit retCode errors so callers can show exact retMsg/retCode.
        if (data?.retCode !== 0 && data?.retCode !== undefined) {
          const msg = data?.retMsg || data?.error || 'Bybit API error';
          // Don't set error for rate limiting - it will resolve on retry
          if (data.retCode !== 10006) {
            setError(msg);
          }
          return data;
        }

        return data;
      } catch (err: any) {
        const msg = err?.message || 'Erro desconhecido';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const testConnection = useCallback(async (): Promise<boolean> => {
    const result = await callBybitAPI('testConnection');
    const isConnected = result?.retCode === 0;
    setConnected(isConnected);
    return isConnected;
  }, [callBybitAPI]);

  const getWalletBalance = useCallback(async (): Promise<WalletBalance | null> => {
    const result = await callBybitAPI('getWalletBalance', { accountType: 'UNIFIED' });

    if (result?.result?.list?.[0]) {
      const account = result.result.list[0];
      return {
        totalEquity: parseFloat(account.totalEquity || '0'),
        totalWalletBalance: parseFloat(account.totalWalletBalance || '0'),
        totalAvailableBalance: parseFloat(account.totalAvailableBalance || '0'),
        totalPnL: parseFloat(account.totalPerpUPL || '0'),
      };
    }
    return null;
  }, [callBybitAPI]);

  const getTicker = useCallback(
    async (symbol: string) => {
      const result = await callBybitAPI('getTickers', { category: 'linear', symbol });
      return result?.result?.list?.[0] || null;
    },
    [callBybitAPI]
  );

  const getPositions = useCallback(async (): Promise<Position[]> => {
    const result = await callBybitAPI('getPositions');
    return result?.result?.list?.filter((p: any) => parseFloat(p.size) > 0) || [];
  }, [callBybitAPI]);

  const getClosedPnL = useCallback(async (limit: number = 50): Promise<ClosedTrade[]> => {
    const result = await callBybitAPI('getClosedPnL', { limit });
    return result?.result?.list || [];
  }, [callBybitAPI]);

  const getOrderHistory = useCallback(async (limit: number = 50): Promise<OrderHistory[]> => {
    const result = await callBybitAPI('getOrderHistory', { limit });
    return result?.result?.list || [];
  }, [callBybitAPI]);

  const getActiveOrders = useCallback(async (): Promise<OrderHistory[]> => {
    const result = await callBybitAPI('getOrders');
    return result?.result?.list || [];
  }, [callBybitAPI]);

  const placeOrder = useCallback(
    async (
      symbol: string,
      side: 'Buy' | 'Sell',
      qty: number,
      options?: {
        orderType?: 'Market' | 'Limit';
        price?: number;
        takeProfit?: number;
        stopLoss?: number;
      }
    ) => {
      const blocked = blockIfRealTradingDisabled('placeOrder');
      if (blocked) return blocked;

      // Always skip cache/debounce for order placement
      return callBybitAPI('placeOrder', {
        symbol,
        side,
        qty,
        ...options,
      }, { skipDebounce: true });
    },
    [callBybitAPI, blockIfRealTradingDisabled]
  );

  const cancelOrder = useCallback(
    async (symbol: string, orderId: string) => {
      const blocked = blockIfRealTradingDisabled('cancelOrder');
      if (blocked) return blocked;

      return callBybitAPI('cancelOrder', { symbol, orderId }, { skipDebounce: true });
    },
    [callBybitAPI, blockIfRealTradingDisabled]
  );

  const setLeverage = useCallback(
    async (symbol: string, leverage: number) => {
      const blocked = blockIfRealTradingDisabled('setLeverage');
      if (blocked) return blocked;

      return callBybitAPI('setLeverage', { symbol, leverage }, { skipDebounce: true });
    },
    [callBybitAPI, blockIfRealTradingDisabled]
  );

  const closePosition = useCallback(
    async (symbol: string, side: 'Buy' | 'Sell', qty: number) => {
      const blocked = blockIfRealTradingDisabled('closePosition');
      if (blocked) return blocked;

      // To close a position, we place an opposite market order
      const closeSide = side === 'Buy' ? 'Sell' : 'Buy';
      return callBybitAPI('placeOrder', {
        symbol,
        side: closeSide,
        qty,
        orderType: 'Market',
        reduceOnly: true,
      }, { skipDebounce: true });
    },
    [callBybitAPI, blockIfRealTradingDisabled]
  );

  const closeAllPositions = useCallback(async (): Promise<{ success: number; failed: number; errors: string[] }> => {
    if (!REAL_TRADING_ENABLED) {
      setError(REAL_TRADING_DISABLED_MESSAGE);
      return { success: 0, failed: 1, errors: [REAL_TRADING_DISABLED_MESSAGE] };
    }

    const positions = await getPositions();
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process positions sequentially to avoid rate limiting
    for (const pos of positions) {
      const qty = parseFloat(pos.size);
      if (qty > 0) {
        // Wait a bit between close orders to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
        
        const result = await closePosition(pos.symbol, pos.side, qty);
        if (result?.retCode === 0) {
          success++;
        } else {
          failed++;
          errors.push(`${pos.symbol}: ${result?.retMsg || 'Unknown error'}`);
        }
      }
    }

    return { success, failed, errors };
  }, [getPositions, closePosition]);

  const getKlines = useCallback(
    async (symbol: string, interval: string = '15', limit: number = 200) => {
      const result = await callBybitAPI('getKline', { symbol, interval, limit });
      return result?.result?.list || [];
    },
    [callBybitAPI]
  );

  // Clear cache function for manual refresh
  const clearCache = useCallback(() => {
    requestCache.clear();
  }, []);

  return {
    loading,
    error,
    connected,
    realTradingEnabled: REAL_TRADING_ENABLED,
    testConnection,
    getWalletBalance,
    getTicker,
    getPositions,
    getClosedPnL,
    getOrderHistory,
    getActiveOrders,
    placeOrder,
    cancelOrder,
    setLeverage,
    closePosition,
    closeAllPositions,
    getKlines,
    clearCache,
  };
}