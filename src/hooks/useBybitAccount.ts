import { useState, useEffect, useCallback, useRef } from 'react';
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

// Global state to prevent multiple instances from fetching simultaneously
let isFetchingGlobal = false;
let lastGlobalFetch = 0;
const MIN_FETCH_INTERVAL = 3000; // Minimum 3 seconds between fetches

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
  const mountedRef = useRef(true);

  // Subscribe to changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => { 
      listeners.delete(listener);
      mountedRef.current = false;
    };
  }, []);

  const refreshData = useCallback(async () => {
    if (!isRealMode) return;
    
    // Prevent concurrent fetches across all instances
    const now = Date.now();
    if (isFetchingGlobal || (now - lastGlobalFetch) < MIN_FETCH_INTERVAL) {
      return;
    }
    
    isFetchingGlobal = true;
    lastGlobalFetch = now;
    setIsRefreshing(true);
    
    try {
      // First test connection
      const isConnected = await testConnection();
      
      if (isConnected && mountedRef.current) {
        // Fetch wallet and positions sequentially to avoid rate limiting
        const walletData = await getWalletBalance();
        if (walletData && mountedRef.current) {
          setWallet(walletData);
        }
        
        // Small delay between calls
        await new Promise(r => setTimeout(r, 100));
        
        const positionsData = await getPositions();
        if (mountedRef.current) {
          setPositions(positionsData);
          setLastUpdate(new Date());
        }
      }
    } finally {
      isFetchingGlobal = false;
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
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

  // Initial fetch and auto-refresh every 5 seconds (reduced from 2s to avoid rate limiting)
  useEffect(() => {
    if (!isRealMode) return;
    
    mountedRef.current = true;
    
    // Initial fetch with small delay to let component mount
    const initialFetch = setTimeout(() => {
      refreshData();
    }, 500);
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      refreshData();
    }, 5000);
    
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
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
