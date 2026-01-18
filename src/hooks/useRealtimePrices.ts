import { useState, useEffect, useCallback, useRef } from 'react';
import type { MarketData } from '@/types/trading';
import { supabase } from '@/integrations/supabase/client';

// Trading pairs to monitor
const TRADING_PAIRS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'MATICUSDT',
];

interface PriceData {
  symbol: string;
  lastPrice: string;
  price24hPcnt: string;
  highPrice24h: string;
  lowPrice24h: string;
  volume24h: string;
  turnover24h: string;
}

interface UseRealtimePricesOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export function useRealtimePrices(options: UseRealtimePricesOptions = {}) {
  const { enabled = true, intervalMs = 2000 } = options;
  const [prices, setPrices] = useState<Record<string, MarketData>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevPrices = useRef<Record<string, number>>({});
  const [priceAnimations, setPriceAnimations] = useState<Record<string, 'up' | 'down' | null>>({});

  const fetchPrices = useCallback(async () => {
    try {
      // Use Bybit public API for tickers
      const response = await fetch(
        'https://api.bybit.com/v5/market/tickers?category=linear'
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }

      const data = await response.json();
      
      if (data.retCode !== 0) {
        throw new Error(data.retMsg || 'API error');
      }

      const tickers = data.result?.list || [];
      const newPrices: Record<string, MarketData> = {};
      const animations: Record<string, 'up' | 'down' | null> = {};

      TRADING_PAIRS.forEach(symbol => {
        const ticker = tickers.find((t: PriceData) => t.symbol === symbol);
        if (ticker) {
          const currentPrice = parseFloat(ticker.lastPrice);
          const prevPrice = prevPrices.current[symbol];

          // Detect price change direction
          if (prevPrice !== undefined) {
            if (currentPrice > prevPrice) {
              animations[symbol] = 'up';
            } else if (currentPrice < prevPrice) {
              animations[symbol] = 'down';
            }
          }

          prevPrices.current[symbol] = currentPrice;

          newPrices[symbol] = {
            symbol,
            price: currentPrice,
            change24h: currentPrice * (parseFloat(ticker.price24hPcnt) / 100),
            changePercentage24h: parseFloat(ticker.price24hPcnt) * 100,
            high24h: parseFloat(ticker.highPrice24h),
            low24h: parseFloat(ticker.lowPrice24h),
            volume24h: parseFloat(ticker.turnover24h),
            timestamp: Date.now(),
          };
        }
      });

      setPrices(prev => ({ ...prev, ...newPrices }));
      setPriceAnimations(animations);
      setLastUpdate(new Date());
      setError(null);
      setLoading(false);

      // Clear animations after 300ms
      setTimeout(() => {
        setPriceAnimations({});
      }, 300);

    } catch (err: any) {
      console.error('Error fetching prices:', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchPrices();

    // Set up polling interval
    const interval = setInterval(fetchPrices, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, intervalMs, fetchPrices]);

  return {
    prices,
    loading,
    lastUpdate,
    error,
    priceAnimations,
    refetch: fetchPrices,
  };
}
