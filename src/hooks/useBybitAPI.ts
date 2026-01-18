import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BybitResponse {
  retCode: number;
  retMsg: string;
  result: any;
  time: number;
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

export function useBybitAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  const callBybitAPI = useCallback(async (action: string, params: Record<string, any> = {}): Promise<BybitResponse | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('bybit-api', {
        body: { action, params },
      });
      
      if (fnError) {
        throw new Error(fnError.message);
      }
      
      if (data.retCode !== 0) {
        throw new Error(data.retMsg || 'Bybit API error');
      }
      
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

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

  const getTicker = useCallback(async (symbol: string) => {
    const result = await callBybitAPI('getTickers', { category: 'linear', symbol });
    return result?.result?.list?.[0] || null;
  }, [callBybitAPI]);

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

  const placeOrder = useCallback(async (
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
    return callBybitAPI('placeOrder', {
      symbol,
      side,
      qty,
      ...options,
    });
  }, [callBybitAPI]);

  const cancelOrder = useCallback(async (symbol: string, orderId: string) => {
    return callBybitAPI('cancelOrder', { symbol, orderId });
  }, [callBybitAPI]);

  const setLeverage = useCallback(async (symbol: string, leverage: number) => {
    return callBybitAPI('setLeverage', { symbol, leverage });
  }, [callBybitAPI]);

  const getKlines = useCallback(async (symbol: string, interval: string = '15', limit: number = 200) => {
    const result = await callBybitAPI('getKline', { symbol, interval, limit });
    return result?.result?.list || [];
  }, [callBybitAPI]);

  return {
    loading,
    error,
    connected,
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
    getKlines,
  };
}