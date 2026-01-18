import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useBybitAPI } from './useBybitAPI';

interface WalletInfo {
  totalEquity: number;
  totalWalletBalance: number;
  totalAvailableBalance: number;
  totalPnL: number;
}

interface BybitAccountState {
  loading: boolean;
  connected: boolean | null;
  wallet: WalletInfo | null;
  positions: any[];
  lastUpdate: Date | null;
  isRealMode: boolean;
  refreshData: () => Promise<void>;
  toggleMode: () => void;
}

// Singleton state for sharing across components
let sharedState: BybitAccountState | null = null;
let listeners: Set<() => void> = new Set();

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

export function useBybitAccount(): BybitAccountState {
  const { loading, connected, testConnection, getWalletBalance, getPositions } = useBybitAPI();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRealMode, setIsRealMode] = useState(() => {
    const saved = localStorage.getItem('bybit-mode');
    return saved === 'real';
  });
  const [, forceUpdate] = useState({});

  // Subscribe to changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const refreshData = useCallback(async () => {
    if (!isRealMode) return;
    
    const isConnected = await testConnection();
    
    if (isConnected) {
      const walletData = await getWalletBalance();
      if (walletData) {
        setWallet(walletData);
      }
      
      const positionsData = await getPositions();
      setPositions(positionsData);
      setLastUpdate(new Date());
    }
  }, [isRealMode, testConnection, getWalletBalance, getPositions]);

  const toggleMode = useCallback(() => {
    setIsRealMode(prev => {
      const newMode = !prev;
      localStorage.setItem('bybit-mode', newMode ? 'real' : 'demo');
      notifyListeners();
      return newMode;
    });
  }, []);

  // Initial fetch and auto-refresh
  useEffect(() => {
    if (isRealMode) {
      refreshData();
      const interval = setInterval(refreshData, 30000);
      return () => clearInterval(interval);
    }
  }, [isRealMode, refreshData]);

  return {
    loading,
    connected: isRealMode ? connected : null,
    wallet: isRealMode ? wallet : null,
    positions: isRealMode ? positions : [],
    lastUpdate,
    isRealMode,
    refreshData,
    toggleMode,
  };
}
