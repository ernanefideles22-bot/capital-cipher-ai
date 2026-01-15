import { useState, useEffect, useCallback } from 'react';
import type { Trade, MarketData, BotStats, AIDecision, LogEntry, BotConfig, BotStatus } from '@/types/trading';

// Simulated data generators for demo purposes
const generateMarketData = (symbol: string): MarketData => {
  const basePrice = symbol === 'BTCUSDT' ? 95000 : symbol === 'ETHUSDT' ? 3200 : 180;
  const variation = (Math.random() - 0.5) * basePrice * 0.002;
  const price = basePrice + variation;
  const change24h = (Math.random() - 0.5) * basePrice * 0.05;
  
  return {
    symbol,
    price,
    change24h,
    changePercentage24h: (change24h / basePrice) * 100,
    high24h: price * 1.02,
    low24h: price * 0.98,
    volume24h: Math.random() * 1000000000,
    timestamp: Date.now(),
  };
};

const generateLogEntry = (): LogEntry => {
  const levels: LogEntry['level'][] = ['INFO', 'SUCCESS', 'WARN', 'AI'];
  const messages = [
    { level: 'INFO', message: 'Analisando volume institucional em BTCUSDT...' },
    { level: 'SUCCESS', message: 'Trade fechado com +2.3% de lucro' },
    { level: 'AI', message: 'Detectado acúmulo institucional no suporte de $94,500' },
    { level: 'WARN', message: 'Volatilidade alta detectada, reduzindo exposição' },
    { level: 'AI', message: 'Divergência bullish confirmada no timeframe 15m' },
    { level: 'INFO', message: 'Stop loss ajustado para breakeven' },
    { level: 'SUCCESS', message: 'Take profit parcial executado em 50%' },
    { level: 'AI', message: 'Zona premium identificada, aguardando pullback' },
  ];
  
  const entry = messages[Math.floor(Math.random() * messages.length)];
  
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    level: entry.level as LogEntry['level'],
    message: entry.message,
  };
};

const generateTrade = (): Trade => {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  const strategies: Trade['strategy'][] = ['SCALP', 'DAYTRADE', 'SWING'];
  const sides: Trade['side'][] = ['LONG', 'SHORT'];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const basePrice = symbol === 'BTCUSDT' ? 95000 : symbol === 'ETHUSDT' ? 3200 : 180;
  const entryPrice = basePrice * (1 + (Math.random() - 0.5) * 0.01);
  const side = sides[Math.floor(Math.random() * sides.length)];
  const pnlMultiplier = side === 'LONG' ? 1 : -1;
  const pnlPercentage = (Math.random() - 0.3) * 5 * pnlMultiplier;
  
  return {
    id: crypto.randomUUID(),
    symbol,
    side,
    strategy: strategies[Math.floor(Math.random() * strategies.length)],
    entryPrice,
    exitPrice: entryPrice * (1 + pnlPercentage / 100),
    quantity: Math.random() * 0.5 + 0.1,
    leverage: Math.floor(Math.random() * 10) + 3,
    stopLoss: entryPrice * (side === 'LONG' ? 0.98 : 1.02),
    takeProfit: entryPrice * (side === 'LONG' ? 1.04 : 0.96),
    pnl: entryPrice * (pnlPercentage / 100) * (Math.random() * 0.5 + 0.1),
    pnlPercentage,
    status: Math.random() > 0.3 ? 'CLOSED' : 'OPEN',
    openedAt: new Date(Date.now() - Math.random() * 86400000 * 7),
    closedAt: Math.random() > 0.3 ? new Date() : undefined,
  };
};

const generateAIDecision = (): AIDecision => {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  const actions: AIDecision['action'][] = ['BUY', 'SELL', 'HOLD', 'SKIP'];
  const reasonings = [
    'Acúmulo institucional detectado com volume crescente',
    'Distribuição em zona premium, aguardando confirmação',
    'Quebra de estrutura com volume validado',
    'Falso rompimento identificado - liquidity grab',
    'Divergência preço/volume confirmada em múltiplos TFs',
  ];
  
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    symbol: symbols[Math.floor(Math.random() * symbols.length)],
    action: actions[Math.floor(Math.random() * actions.length)],
    confidence: Math.random() * 40 + 60,
    reasoning: reasonings[Math.floor(Math.random() * reasonings.length)],
    indicators: {
      institutionalFlow: Math.random() * 200 - 100,
      volumeCluster: Math.random() > 0.5,
      trendStrength: Math.random() * 100,
      riskScore: Math.random() * 100,
    },
  };
};

export const useTradingData = () => {
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [botStats, setBotStats] = useState<BotStats>({
    status: 'RUNNING',
    totalTrades: 247,
    winRate: 68.5,
    totalPnL: 12450.67,
    dailyPnL: 892.34,
    weeklyPnL: 3420.12,
    monthlyPnL: 12450.67,
    currentDrawdown: 3.2,
    maxDrawdown: 8.5,
    sharpeRatio: 2.34,
    profitFactor: 1.87,
  });
  const [trades, setTrades] = useState<Trade[]>(() => 
    Array.from({ length: 15 }, generateTrade)
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [aiDecisions, setAIDecisions] = useState<AIDecision[]>(() =>
    Array.from({ length: 5 }, generateAIDecision)
  );
  const [config, setConfig] = useState<BotConfig>({
    mode: 'paper',
    marketMode: 'FUTURES',
    leverage: 5,
    maxDrawdown: 10,
    maxConcurrentTrades: 3,
    riskPerTrade: 2,
    assets: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
  });

  // Simulate real-time market data updates
  useEffect(() => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    
    const updateMarket = () => {
      const newData: Record<string, MarketData> = {};
      symbols.forEach(symbol => {
        newData[symbol] = generateMarketData(symbol);
      });
      setMarketData(newData);
    };

    updateMarket();
    const interval = setInterval(updateMarket, 2000);
    return () => clearInterval(interval);
  }, []);

  // Simulate log entries
  useEffect(() => {
    const addLog = () => {
      setLogs(prev => [generateLogEntry(), ...prev.slice(0, 99)]);
    };

    const interval = setInterval(addLog, 5000);
    addLog(); // Initial log
    return () => clearInterval(interval);
  }, []);

  // Simulate AI decisions
  useEffect(() => {
    const addDecision = () => {
      setAIDecisions(prev => [generateAIDecision(), ...prev.slice(0, 9)]);
    };

    const interval = setInterval(addDecision, 15000);
    return () => clearInterval(interval);
  }, []);

  const toggleBotStatus = useCallback(() => {
    setBotStats(prev => ({
      ...prev,
      status: prev.status === 'RUNNING' ? 'PAUSED' : 'RUNNING',
    }));
  }, []);

  const updateConfig = useCallback((newConfig: Partial<BotConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  return {
    marketData,
    botStats,
    trades,
    logs,
    aiDecisions,
    config,
    toggleBotStatus,
    updateConfig,
  };
};
