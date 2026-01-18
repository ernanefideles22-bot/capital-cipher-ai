import { useState, useEffect, useCallback, useRef } from 'react';
import type { MarketData } from '@/types/trading';

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

export type SparklineData = number[];

export function useRealtimePrices(options: UseRealtimePricesOptions = {}) {
  const { enabled = true, intervalMs = 2000 } = options;
  const [prices, setPrices] = useState<Record<string, MarketData>>({});
  const [sparklines, setSparklines] = useState<Record<string, SparklineData>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevPrices = useRef<Record<string, number>>({});
  const [priceAnimations, setPriceAnimations] = useState<Record<string, 'up' | 'down' | null>>({});
  const sparklinesFetchedRef = useRef(false);

  // Fetch sparkline data (5-minute klines for last hour = 12 candles)
  const fetchSparklines = useCallback(async () => {
    try {
      const sparklineData: Record<string, SparklineData> = {};
      
      // Fetch klines for each pair in parallel
      await Promise.all(
        TRADING_PAIRS.map(async (symbol) => {
          try {
            const response = await fetch(
              `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=5&limit=20`
            );
            
            if (!response.ok) return;
            
            const data = await response.json();
            
            if (data.retCode === 0 && data.result?.list) {
              // Kline format: [startTime, open, high, low, close, volume, turnover]
              // We want close prices, reversed to be chronological
              const closes = data.result.list
                .map((k: string[]) => parseFloat(k[4]))
                .reverse();
              sparklineData[symbol] = closes;
            }
          } catch (err) {
            console.error(`Error fetching sparkline for ${symbol}:`, err);
          }
        })
      );
      
      setSparklines(sparklineData);
    } catch (err) {
      console.error('Error fetching sparklines:', err);
    }
  }, []);

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

          // Update sparkline with latest price
          setSparklines(prev => {
            if (prev[symbol] && prev[symbol].length > 0) {
              const updated = [...prev[symbol]];
              updated[updated.length - 1] = currentPrice;
              return { ...prev, [symbol]: updated };
            }
            return prev;
          });
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

  // Initial fetch sparklines once
  useEffect(() => {
    if (!enabled || sparklinesFetchedRef.current) return;
    
    sparklinesFetchedRef.current = true;
    fetchSparklines();
    
    // Refresh sparklines every 5 minutes
    const sparklineInterval = setInterval(fetchSparklines, 5 * 60 * 1000);
    
    return () => clearInterval(sparklineInterval);
  }, [enabled, fetchSparklines]);

  // Initial fetch and polling for prices
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
    sparklines,
    loading,
    lastUpdate,
    error,
    priceAnimations,
    refetch: fetchPrices,
  };
}
