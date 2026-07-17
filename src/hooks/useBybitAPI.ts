import { useCallback, useState } from 'react';

interface BybitResponse {
  retCode: number;
  retMsg: string;
  error: string;
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

export const LEGACY_EXCHANGE_ACCESS_FROZEN =
  'Acesso privado à exchange está desativado neste aplicativo legado. Use capital-cipher-platform em modo PAPER.';

function blockedResponse(action: string): BybitResponse {
  return {
    retCode: -9001,
    retMsg: LEGACY_EXCHANGE_ACCESS_FROZEN,
    error: `Blocked legacy exchange action: ${action}`,
    time: Date.now(),
  };
}

export function useBybitAPI() {
  const [error, setError] = useState<string | null>(LEGACY_EXCHANGE_ACCESS_FROZEN);

  const block = useCallback(async (action: string): Promise<BybitResponse> => {
    setError(LEGACY_EXCHANGE_ACCESS_FROZEN);
    return blockedResponse(action);
  }, []);

  const testConnection = useCallback(async (): Promise<boolean> => {
    setError(LEGACY_EXCHANGE_ACCESS_FROZEN);
    return false;
  }, []);

  const getWalletBalance = useCallback(async (): Promise<WalletBalance | null> => null, []);
  const getTicker = useCallback(async (_symbol: string): Promise<null> => null, []);
  const getPositions = useCallback(async (): Promise<Position[]> => [], []);
  const getClosedPnL = useCallback(async (_limit = 50): Promise<ClosedTrade[]> => [], []);
  const getOrderHistory = useCallback(async (_limit = 50): Promise<OrderHistory[]> => [], []);
  const getActiveOrders = useCallback(async (): Promise<OrderHistory[]> => [], []);
  const getKlines = useCallback(
    async (_symbol: string, _interval = '15', _limit = 200): Promise<unknown[]> => [],
    [],
  );

  const placeOrder = useCallback(
    async (
      _symbol: string,
      _side: 'Buy' | 'Sell',
      _qty: number,
      _options?: {
        orderType?: 'Market' | 'Limit';
        price?: number;
        takeProfit?: number;
        stopLoss?: number;
      },
    ) => block('placeOrder'),
    [block],
  );

  const cancelOrder = useCallback(
    async (_symbol: string, _orderId: string) => block('cancelOrder'),
    [block],
  );

  const setLeverage = useCallback(
    async (_symbol: string, _leverage: number) => block('setLeverage'),
    [block],
  );

  const closePosition = useCallback(
    async (_symbol: string, _side: 'Buy' | 'Sell', _qty: number) => block('closePosition'),
    [block],
  );

  const closeAllPositions = useCallback(async () => {
    setError(LEGACY_EXCHANGE_ACCESS_FROZEN);
    return {
      success: 0,
      failed: 1,
      errors: [LEGACY_EXCHANGE_ACCESS_FROZEN],
    };
  }, []);

  const clearCache = useCallback(() => undefined, []);

  return {
    loading: false,
    error,
    connected: false,
    realTradingEnabled: false,
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
