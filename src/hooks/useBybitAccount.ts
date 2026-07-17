import { useCallback, useEffect } from 'react';

interface WalletInfo {
  totalEquity: number;
  totalWalletBalance: number;
  totalAvailableBalance: number;
  totalPnL: number;
}

interface PositionInfo {
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealisedPnl: string;
  leverage: string;
  positionValue: string;
  liqPrice: string;
}

interface BybitAccountState {
  loading: boolean;
  connected: boolean | null;
  wallet: WalletInfo | null;
  positions: PositionInfo[];
  lastUpdate: Date | null;
  isRealMode: boolean;
  isRefreshing: boolean;
  refreshData: () => Promise<void>;
  toggleMode: () => void;
}

export function useBybitAccount(): BybitAccountState {
  useEffect(() => {
    localStorage.setItem('bybit-mode', 'paper');
  }, []);

  const refreshData = useCallback(async () => undefined, []);
  const toggleMode = useCallback(() => {
    localStorage.setItem('bybit-mode', 'paper');
  }, []);

  return {
    loading: false,
    connected: false,
    wallet: null,
    positions: [],
    lastUpdate: null,
    isRealMode: false,
    isRefreshing: false,
    refreshData,
    toggleMode,
  };
}
