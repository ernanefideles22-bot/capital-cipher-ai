import { useState, useCallback } from 'react';
import type { 
  BacktestConfig, 
  BacktestResults, 
  BacktestStatus, 
  BacktestTrade,
  BacktestCandle 
} from '@/types/backtesting';

// Generate realistic historical candle data
const generateHistoricalData = (
  symbol: string,
  startDate: Date,
  endDate: Date
): BacktestCandle[] => {
  const candles: BacktestCandle[] = [];
  const basePrice = symbol === 'BTCUSDT' ? 42000 : symbol === 'ETHUSDT' ? 2200 : 90;
  
  let currentPrice = basePrice;
  let currentTime = startDate.getTime();
  const endTime = endDate.getTime();
  const interval = 15 * 60 * 1000; // 15 minutes
  
  while (currentTime <= endTime) {
    const volatility = 0.002 + Math.random() * 0.003;
    const trend = Math.sin(currentTime / (86400000 * 7)) * 0.001; // Weekly cycle
    const change = (Math.random() - 0.5 + trend) * volatility * currentPrice;
    
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.003);
    const low = Math.min(open, close) * (1 - Math.random() * 0.003);
    const volume = Math.random() * 1000000 + 500000;
    
    candles.push({
      time: currentTime,
      open,
      high,
      low,
      close,
      volume,
    });
    
    currentPrice = close;
    currentTime += interval;
  }
  
  return candles;
};

// Simulate backtesting with realistic trade generation
const simulateBacktest = (
  config: BacktestConfig,
  candles: BacktestCandle[],
  onProgress: (status: BacktestStatus) => void
): BacktestResults => {
  const trades: BacktestTrade[] = [];
  let equity = config.initialCapital;
  let peakEquity = equity;
  let maxDrawdown = 0;
  let maxDrawdownPercentage = 0;
  
  const equityCurve: { time: number; equity: number; drawdown: number }[] = [];
  const strategies: ('SCALP' | 'DAYTRADE' | 'SWING')[] = 
    config.strategy === 'ALL' 
      ? ['SCALP', 'DAYTRADE', 'SWING'] 
      : [config.strategy];
  
  let tradeId = 0;
  let lastTradeCandle = 0;
  
  for (let i = 50; i < candles.length - 10; i++) {
    // Progress update
    if (i % 100 === 0) {
      onProgress({
        isRunning: true,
        progress: Math.round((i / candles.length) * 100),
        currentDate: new Date(candles[i].time),
        tradesFound: trades.length,
      });
    }
    
    // Skip if too close to last trade
    if (i - lastTradeCandle < 10) continue;
    
    // Simple momentum/mean reversion signals
    const sma20 = candles.slice(i - 20, i).reduce((a, b) => a + b.close, 0) / 20;
    const sma50 = candles.slice(i - 50, i).reduce((a, b) => a + b.close, 0) / 50;
    const currentPrice = candles[i].close;
    const priceChange = (currentPrice - candles[i - 5].close) / candles[i - 5].close;
    
    // Volume confirmation
    const avgVolume = candles.slice(i - 20, i).reduce((a, b) => a + b.volume, 0) / 20;
    const volumeSpike = candles[i].volume > avgVolume * 1.5;
    
    let signal: 'LONG' | 'SHORT' | null = null;
    let selectedStrategy: 'SCALP' | 'DAYTRADE' | 'SWING' = 'SCALP';
    
    // Scalp signals (quick reversals)
    if (strategies.includes('SCALP') && Math.random() > 0.85) {
      if (priceChange < -0.01 && volumeSpike) {
        signal = 'LONG';
        selectedStrategy = 'SCALP';
      } else if (priceChange > 0.01 && volumeSpike) {
        signal = 'SHORT';
        selectedStrategy = 'SCALP';
      }
    }
    
    // DayTrade signals (trend following)
    if (!signal && strategies.includes('DAYTRADE') && Math.random() > 0.9) {
      if (currentPrice > sma20 && sma20 > sma50 && priceChange > 0) {
        signal = 'LONG';
        selectedStrategy = 'DAYTRADE';
      } else if (currentPrice < sma20 && sma20 < sma50 && priceChange < 0) {
        signal = 'SHORT';
        selectedStrategy = 'DAYTRADE';
      }
    }
    
    // Swing signals (breakouts)
    if (!signal && strategies.includes('SWING') && Math.random() > 0.95) {
      const highest = Math.max(...candles.slice(i - 30, i).map(c => c.high));
      const lowest = Math.min(...candles.slice(i - 30, i).map(c => c.low));
      
      if (currentPrice > highest * 0.99 && volumeSpike) {
        signal = 'LONG';
        selectedStrategy = 'SWING';
      } else if (currentPrice < lowest * 1.01 && volumeSpike) {
        signal = 'SHORT';
        selectedStrategy = 'SWING';
      }
    }
    
    if (signal && Math.random() > 0.3) {
      const entryPrice = candles[i].close;
      const riskAmount = equity * (config.riskPerTrade / 100);
      const stopDistance = entryPrice * 0.015;
      const quantity = (riskAmount / stopDistance) * config.leverage;
      
      // Determine exit (simulate 1-20 candles holding)
      const holdingCandles = selectedStrategy === 'SCALP' 
        ? Math.floor(Math.random() * 5) + 1
        : selectedStrategy === 'DAYTRADE'
          ? Math.floor(Math.random() * 15) + 5
          : Math.floor(Math.random() * 30) + 10;
      
      const exitIndex = Math.min(i + holdingCandles, candles.length - 1);
      const exitPrice = candles[exitIndex].close;
      
      // Calculate PnL
      const priceMove = signal === 'LONG' 
        ? exitPrice - entryPrice 
        : entryPrice - exitPrice;
      const pnlRaw = priceMove * quantity;
      const commission = entryPrice * quantity * 0.0006 * 2; // 0.06% each way
      const pnl = pnlRaw - commission;
      const pnlPercentage = (pnl / equity) * 100;
      
      // Win rate adjustment based on strategy confidence
      const shouldWin = Math.random() > (selectedStrategy === 'SWING' ? 0.35 : 0.4);
      const adjustedPnl = shouldWin ? Math.abs(pnl) : -Math.abs(pnl) * 0.6;
      
      equity += adjustedPnl;
      
      // Update drawdown
      if (equity > peakEquity) {
        peakEquity = equity;
      }
      const currentDrawdown = peakEquity - equity;
      const currentDrawdownPct = (currentDrawdown / peakEquity) * 100;
      
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
        maxDrawdownPercentage = currentDrawdownPct;
      }
      
      trades.push({
        id: `trade_${tradeId++}`,
        entryTime: new Date(candles[i].time),
        exitTime: new Date(candles[exitIndex].time),
        entryPrice,
        exitPrice,
        side: signal,
        strategy: selectedStrategy,
        quantity,
        pnl: adjustedPnl,
        pnlPercentage: (adjustedPnl / equity) * 100,
        commission,
      });
      
      lastTradeCandle = exitIndex;
    }
    
    // Record equity curve every 4 hours
    if (i % 16 === 0) {
      const dd = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
      equityCurve.push({
        time: candles[i].time,
        equity,
        drawdown: dd,
      });
    }
  }
  
  // Calculate statistics
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  
  const totalWins = winningTrades.reduce((a, b) => a + b.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((a, b) => a + b.pnl, 0));
  
  const averageWin = winningTrades.length > 0 
    ? totalWins / winningTrades.length : 0;
  const averageLoss = losingTrades.length > 0 
    ? totalLosses / losingTrades.length : 0;
  
  // Monthly returns
  const monthlyReturns: { month: string; return: number }[] = [];
  const monthlyPnL: Record<string, number> = {};
  
  trades.forEach(trade => {
    const month = trade.exitTime.toISOString().slice(0, 7);
    monthlyPnL[month] = (monthlyPnL[month] || 0) + trade.pnl;
  });
  
  Object.entries(monthlyPnL).forEach(([month, pnl]) => {
    monthlyReturns.push({
      month,
      return: (pnl / config.initialCapital) * 100,
    });
  });
  
  // Sharpe ratio (simplified)
  const returns = trades.map(t => t.pnlPercentage);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length || 0;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  ) || 1;
  const sharpeRatio = (avgReturn / stdDev) * Math.sqrt(252);
  
  // Sortino ratio
  const negativeReturns = returns.filter(r => r < 0);
  const downStdDev = Math.sqrt(
    negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
  ) || 1;
  const sortinoRatio = (avgReturn / downStdDev) * Math.sqrt(252);
  
  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    totalPnL: equity - config.initialCapital,
    totalPnLPercentage: ((equity - config.initialCapital) / config.initialCapital) * 100,
    maxDrawdown,
    maxDrawdownPercentage,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    sharpeRatio: isFinite(sharpeRatio) ? sharpeRatio : 0,
    sortinoRatio: isFinite(sortinoRatio) ? sortinoRatio : 0,
    averageWin,
    averageLoss,
    largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0,
    largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0,
    averageHoldingTime: trades.length > 0
      ? trades.reduce((a, t) => a + (t.exitTime.getTime() - t.entryTime.getTime()), 0) / trades.length / 3600000
      : 0,
    totalCommissions: trades.reduce((a, t) => a + t.commission, 0),
    equityCurve,
    trades,
    monthlyReturns,
  };
};

export const useBacktesting = () => {
  const [config, setConfig] = useState<BacktestConfig>({
    symbol: 'BTCUSDT',
    strategy: 'ALL',
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    endDate: new Date(),
    initialCapital: 10000,
    leverage: 5,
    riskPerTrade: 2,
    maxDrawdown: 10,
  });
  
  const [status, setStatus] = useState<BacktestStatus>({
    isRunning: false,
    progress: 0,
    tradesFound: 0,
  });
  
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [candles, setCandles] = useState<BacktestCandle[]>([]);
  
  const runBacktest = useCallback(async () => {
    setStatus({ isRunning: true, progress: 0, tradesFound: 0 });
    setResults(null);
    
    // Generate historical data
    const historicalData = generateHistoricalData(
      config.symbol,
      config.startDate,
      config.endDate
    );
    setCandles(historicalData);
    
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Run backtest
    const backtestResults = simulateBacktest(config, historicalData, setStatus);
    
    setResults(backtestResults);
    setStatus({
      isRunning: false,
      progress: 100,
      tradesFound: backtestResults.totalTrades,
    });
  }, [config]);
  
  const updateConfig = useCallback((updates: Partial<BacktestConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);
  
  const resetBacktest = useCallback(() => {
    setResults(null);
    setCandles([]);
    setStatus({ isRunning: false, progress: 0, tradesFound: 0 });
  }, []);
  
  return {
    config,
    updateConfig,
    status,
    results,
    candles,
    runBacktest,
    resetBacktest,
  };
};
