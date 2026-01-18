import { useState, useEffect, useCallback } from 'react';
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
  isRefreshing: boolean;
  refreshData: () => Promise<void>;
  toggleMode: () => void;
}

// Simple singleton listener set to keep mode in sync across hook instances
let listeners: Set<() => void> = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, forceUpdate] = useState({});

  // Subscribe to changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const refreshData = useCallback(async () => {
    if (!isRealMode) return;
    
    setIsRefreshing(true);
    try {
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
    } finally {
      setIsRefreshing(false);
    }
  }, [isRealMode, testConnection, getWalletBalance, getPositions]);

  // Toggle mode without side-effects in the state updater (prevents React queue corruption)
  const toggleMode = useCallback(() => {
    setIsRealMode((prev) => !prev);
  }, []);

  // Persist + notify other hook instances after the mode actually changes
  useEffect(() => {
    localStorage.setItem('bybit-mode', isRealMode ? 'real' : 'demo');
    notifyListeners();
  }, [isRealMode]);

  // Initial fetch and auto-refresh every 3 seconds
  useEffect(() => {
    if (!isRealMode) return;
    
    // Initial fetch
    refreshData();
    
    // Auto-refresh every 3 seconds
    const interval = setInterval(() => {
      refreshData();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [isRealMode, refreshData]);

  return {
    loading,
    connected: isRealMode ? connected : null,
    wallet: isRealMode ? wallet : null,
    positions: isRealMode ? positions : [],
    lastUpdate,
    isRealMode,
    isRefreshing,
    refreshData,
    toggleMode,
  };
}
