import { useCallback, useRef } from 'react';
import type { Trade, MarketData, BotStats, AIDecision, LogEntry } from '@/types/trading';
import { getGlobalSentiment } from './useNewsSentiment';

export const TRADING_PAIRS: Record<string, number> = {
  'BTCUSDT': 95000,
  'ETHUSDT': 3200,
  'SOLUSDT': 180,
  'BNBUSDT': 680,
  'XRPUSDT': 2.15,
  'DOGEUSDT': 0.32,
  'ADAUSDT': 0.95,
  'AVAXUSDT': 38,
  'LINKUSDT': 22,
  'MATICUSDT': 0.48,
};

type VoiceAlertCallback = {
  onTradeOpened?: (symbol: string, side: 'LONG' | 'SHORT', confidence: number) => void;
  onTradeClosed?: (symbol: string, pnl: number, reason: string) => void;
};

let voiceCallbacks: VoiceAlertCallback = {};

export const setVoiceAlertCallbacks = (callbacks: VoiceAlertCallback) => {
  voiceCallbacks = callbacks;
};

// Simulated prices that update realistically
const livePrices: Record<string, number> = { ...TRADING_PAIRS };

// Track open positions for simulation
let openPositions: Trade[] = [];
let totalPnL = 0;
let dailyPnL = 0;
let totalTradesCount = 0;
let winCount = 0;

const generateMarketData = (symbol: string): MarketData => {
  const basePrice = TRADING_PAIRS[symbol] || 100;
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

const generateLogEntry = (customMessage?: { level: LogEntry['level'], message: string }): LogEntry => {
  const messages = [
    { level: 'INFO' as const, message: 'Analisando volume institucional...' },
    { level: 'INFO' as const, message: 'Verificando correlação entre ativos...' },
    { level: 'AI' as const, message: 'Detectado padrão de acúmulo institucional' },
    { level: 'AI' as const, message: 'Análise multi-timeframe concluída' },
    { level: 'WARN' as const, message: 'Volatilidade elevada, ajustando posição' },
    { level: 'INFO' as const, message: 'Monitorando níveis de liquidez...' },
  ];
  
  const entry = customMessage || messages[Math.floor(Math.random() * messages.length)];
  
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    level: entry.level,
    message: entry.message,
  };
};

const executeAITrade = (decision: AIDecision): Trade | null => {
  if (decision.action !== 'BUY' && decision.action !== 'SELL') return null;
  if (decision.confidence < 70) return null;
  if (openPositions.length >= 3) return null;
  
  const side: Trade['side'] = decision.action === 'BUY' ? 'LONG' : 'SHORT';
  const strategies: Trade['strategy'][] = ['SCALP', 'DAYTRADE', 'SWING'];
  const basePrice = livePrices[decision.symbol] || 100;
  const entryPrice = basePrice;
  
  const trade: Trade = {
    id: crypto.randomUUID(),
    symbol: decision.symbol,
    side,
    strategy: strategies[Math.floor(Math.random() * strategies.length)],
    entryPrice,
    quantity: Math.random() * 0.3 + 0.1,
    leverage: Math.floor(Math.random() * 5) + 3,
    stopLoss: entryPrice * (side === 'LONG' ? 0.985 : 1.015),
    takeProfit: entryPrice * (side === 'LONG' ? 1.025 : 0.975),
    status: 'OPEN',
    openedAt: new Date(),
  };
  
  openPositions.push(trade);
  return trade;
};

const checkTradeExits = (): Trade[] => {
  const closedTrades: Trade[] = [];
  
  openPositions = openPositions.filter(trade => {
    const currentPrice = livePrices[trade.symbol] || trade.entryPrice;
    const priceChange = (currentPrice - trade.entryPrice) / trade.entryPrice;
    const pnlMultiplier = trade.side === 'LONG' ? 1 : -1;
    const unrealizedPnL = priceChange * pnlMultiplier;
    
    // Check stop loss or take profit
    const hitStopLoss = unrealizedPnL <= -0.015;
    const hitTakeProfit = unrealizedPnL >= 0.025;
    const randomExit = Math.random() > 0.92;
    
    if (hitStopLoss || hitTakeProfit || randomExit) {
      const pnlPercent = unrealizedPnL * 100 * trade.leverage;
      const pnlValue = trade.entryPrice * trade.quantity * unrealizedPnL * trade.leverage;
      
      const closedTrade: Trade = {
        ...trade,
        exitPrice: currentPrice,
        pnl: pnlValue,
        pnlPercentage: pnlPercent,
        status: 'CLOSED',
        closedAt: new Date(),
      };
      
      totalPnL += pnlValue;
      dailyPnL += pnlValue;
      totalTradesCount++;
      if (pnlValue > 0) winCount++;
      
      closedTrades.push(closedTrade);
      return false;
    }
    return true;
  });
  
  return closedTrades;
};

const generateTrade = (): Trade => {
  const symbols = Object.keys(TRADING_PAIRS);
  const strategies: Trade['strategy'][] = ['SCALP', 'DAYTRADE', 'SWING'];
  const sides: Trade['side'][] = ['LONG', 'SHORT'];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const basePrice = TRADING_PAIRS[symbol];
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
  const symbols = Object.keys(TRADING_PAIRS);
  const newsSentiment = getGlobalSentiment();
  
  let action: AIDecision['action'];
  let confidenceBoost = 0;
  let sentimentReasoning = '';
  
  if (newsSentiment.overallSentiment === 'bullish' && newsSentiment.confidence > 60) {
    const rand = Math.random();
    if (rand > 0.3) {
      action = 'BUY';
      confidenceBoost = (newsSentiment.confidence - 50) * 0.3;
      sentimentReasoning = ' | 📰 Sentimento de notícias BULLISH (+' + Math.round(confidenceBoost) + '% confiança)';
    } else if (rand > 0.15) {
      action = 'HOLD';
    } else {
      action = 'SKIP';
    }
  } else if (newsSentiment.overallSentiment === 'bearish' && newsSentiment.confidence > 60) {
    const rand = Math.random();
    if (rand > 0.3) {
      action = 'SELL';
      confidenceBoost = (newsSentiment.confidence - 50) * 0.3;
      sentimentReasoning = ' | 📰 Sentimento de notícias BEARISH (+' + Math.round(confidenceBoost) + '% confiança)';
    } else if (rand > 0.15) {
      action = 'HOLD';
    } else {
      action = 'SKIP';
    }
  } else {
    const actions: AIDecision['action'][] = ['BUY', 'SELL', 'HOLD', 'SKIP'];
    const weights = [0.2, 0.2, 0.35, 0.25];
    const rand = Math.random();
    let cumulative = 0;
    action = 'HOLD';
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (rand < cumulative) {
        action = actions[i];
        break;
      }
    }
    if (newsSentiment.overallSentiment === 'neutral') {
      sentimentReasoning = ' | 📰 Mercado neutro, aguardando sinais';
    }
  }
  
  const reasonings = [
    'Acúmulo institucional detectado com volume crescente',
    'Distribuição em zona premium, aguardando confirmação',
    'Quebra de estrutura com volume validado',
    'Divergência de volume identificada, sinal de reversão',
    'Suporte forte com rejeição de preço',
    'Liquidity grab detectado, possível reversão',
  ];
  
  const baseReasoning = reasonings[Math.floor(Math.random() * reasonings.length)];
  const baseConfidence = Math.random() * 35 + 55;
  
  let institutionalFlow = Math.random() * 200 - 100;
  if (newsSentiment.overallSentiment === 'bullish') {
    institutionalFlow = Math.abs(institutionalFlow) * 0.5 + 20;
  } else if (newsSentiment.overallSentiment === 'bearish') {
    institutionalFlow = -Math.abs(institutionalFlow) * 0.5 - 20;
  }
  
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    symbol: symbols[Math.floor(Math.random() * symbols.length)],
    action,
    confidence: Math.min(98, baseConfidence + confidenceBoost),
    reasoning: baseReasoning + sentimentReasoning,
    indicators: {
      institutionalFlow,
      volumeCluster: Math.random() > 0.5,
      trendStrength: newsSentiment.overallSentiment === 'neutral' 
        ? Math.random() * 50 + 20 
        : Math.random() * 40 + 50,
      riskScore: newsSentiment.overallSentiment === 'neutral'
        ? Math.random() * 40 + 40
        : Math.random() * 30 + 20,
    },
  };
};

const emptyStats: BotStats = {
  status: 'PAUSED',
  totalTrades: 0,
  winRate: 0,
  totalPnL: 0,
  dailyPnL: 0,
  weeklyPnL: 0,
  monthlyPnL: 0,
  currentDrawdown: 0,
  maxDrawdown: 10,
  sharpeRatio: 0,
  profitFactor: 0,
};

interface UseTradingSimulationOptions {
  isRealMode: boolean;
  setMarketData: React.Dispatch<React.SetStateAction<Record<string, MarketData>>>;
  setTrades: React.Dispatch<React.SetStateAction<Trade[]>>;
  setAIDecisions: React.Dispatch<React.SetStateAction<AIDecision[]>>;
  setBotStats: React.Dispatch<React.SetStateAction<BotStats>>;
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
}

export function useTradingSimulation({
  isRealMode,
  setMarketData,
  setTrades,
  setAIDecisions,
  setBotStats,
  setLogs,
}: UseTradingSimulationOptions) {
  const simulationRef = useRef<NodeJS.Timeout | null>(null);

  const startSimulation = useCallback(() => {
    if (simulationRef.current) return;

    openPositions = [];
    totalPnL = 5000;
    dailyPnL = 0;
    totalTradesCount = 150;
    winCount = 102;

    const symbols = Object.keys(TRADING_PAIRS);
    symbols.forEach(symbol => {
      livePrices[symbol] = TRADING_PAIRS[symbol];
    });

    const initialMarket: Record<string, MarketData> = {};
    symbols.forEach(symbol => {
      initialMarket[symbol] = generateMarketData(symbol);
    });
    setMarketData(initialMarket);
    setTrades(Array.from({ length: 10 }, generateTrade));
    setAIDecisions(Array.from({ length: 3 }, generateAIDecision));
    setBotStats({
      status: 'RUNNING',
      totalTrades: totalTradesCount,
      winRate: (winCount / totalTradesCount) * 100,
      totalPnL: totalPnL,
      dailyPnL: dailyPnL,
      weeklyPnL: 2340.50,
      monthlyPnL: totalPnL,
      currentDrawdown: 2.1,
      maxDrawdown: 6.8,
      sharpeRatio: 2.15,
      profitFactor: 1.92,
    });

    setLogs(prev => [
      generateLogEntry({ level: 'SUCCESS', message: '🤖 Bot IA iniciado - Modo simulação ativo' }),
      ...prev.slice(0, 99)
    ]);

    simulationRef.current = setInterval(() => {
      symbols.forEach(symbol => {
        const basePrice = TRADING_PAIRS[symbol];
        const trend = Math.sin(Date.now() / 50000) * 0.0002;
        livePrices[symbol] = livePrices[symbol] * (1 + (Math.random() - 0.5 + trend) * 0.002);
        livePrices[symbol] = Math.max(basePrice * 0.9, Math.min(basePrice * 1.1, livePrices[symbol]));
      });

      setMarketData(prev => {
        const updated = { ...prev };
        symbols.forEach(symbol => {
          const price = livePrices[symbol];
          const basePrice = TRADING_PAIRS[symbol];
          updated[symbol] = {
            symbol,
            price,
            change24h: price - basePrice,
            changePercentage24h: ((price - basePrice) / basePrice) * 100,
            high24h: Math.max(price * 1.01, prev[symbol]?.high24h || price),
            low24h: Math.min(price * 0.99, prev[symbol]?.low24h || price),
            volume24h: Math.random() * 1000000000 + 500000000,
            timestamp: Date.now(),
          };
        });
        return updated;
      });

      const closedTrades = checkTradeExits();
      if (closedTrades.length > 0) {
        closedTrades.forEach(trade => {
          const isProfit = (trade.pnl || 0) > 0;
          setLogs(prev => [
            generateLogEntry({
              level: isProfit ? 'SUCCESS' : 'WARN',
              message: `${isProfit ? '✅' : '❌'} ${trade.symbol} ${trade.side} fechado: ${isProfit ? '+' : ''}$${(trade.pnl || 0).toFixed(2)} (${(trade.pnlPercentage || 0).toFixed(2)}%)`
            }),
            ...prev.slice(0, 99)
          ]);

          const reason = isProfit ? 'TP' : 'SL';
          voiceCallbacks.onTradeClosed?.(trade.symbol, trade.pnl || 0, reason);
        });

        setTrades(prev => [...closedTrades, ...prev.slice(0, 49)]);
      }

      if (Math.random() > 0.4) {
        const decision = generateAIDecision();
        setAIDecisions(prev => [decision, ...prev.slice(0, 9)]);

        if (decision.action === 'BUY' || decision.action === 'SELL') {
          setLogs(prev => [
            generateLogEntry({
              level: 'AI',
              message: `🧠 Analisando ${decision.symbol}: ${decision.action} (${decision.confidence.toFixed(0)}% confiança)`
            }),
            ...prev.slice(0, 99)
          ]);

          const newTrade = executeAITrade(decision);
          if (newTrade) {
            setLogs(prev => [
              generateLogEntry({
                level: 'SUCCESS',
                message: `🚀 TRADE ABERTO: ${newTrade.symbol} ${newTrade.side} @ $${newTrade.entryPrice.toFixed(2)} | SL: $${newTrade.stopLoss.toFixed(2)} | TP: $${newTrade.takeProfit.toFixed(2)}`
              }),
              ...prev.slice(0, 99)
            ]);

            voiceCallbacks.onTradeOpened?.(newTrade.symbol, newTrade.side, decision.confidence / 100);

            setTrades(prev => [newTrade, ...prev.slice(0, 49)]);
          }
        } else if (decision.action === 'HOLD' && decision.confidence > 75) {
          setLogs(prev => [
            generateLogEntry({
              level: 'INFO',
              message: `⏸️ ${decision.symbol}: Aguardando melhor entrada`
            }),
            ...prev.slice(0, 99)
          ]);
        }
      }

      if (openPositions.length > 0) {
        setTrades(prev => {
          const closedTrades = prev.filter(t => t.status === 'CLOSED');
          const updatedOpen = openPositions.map(trade => {
            const currentPrice = livePrices[trade.symbol] || trade.entryPrice;
            const priceChange = (currentPrice - trade.entryPrice) / trade.entryPrice;
            const pnlMultiplier = trade.side === 'LONG' ? 1 : -1;
            const unrealizedPnL = priceChange * pnlMultiplier * trade.leverage;
            return {
              ...trade,
              pnl: trade.entryPrice * trade.quantity * unrealizedPnL,
              pnlPercentage: unrealizedPnL * 100,
            };
          });
          return [...updatedOpen, ...closedTrades.slice(0, 49 - updatedOpen.length)];
        });
      }

      const winRate = totalTradesCount > 0 ? (winCount / totalTradesCount) * 100 : 0;
      const currentDrawdown = Math.max(0, Math.random() * 3 + (totalPnL < 0 ? 2 : 0));

      setBotStats(prev => ({
        ...prev,
        totalTrades: totalTradesCount,
        winRate: parseFloat(winRate.toFixed(1)),
        totalPnL: parseFloat(totalPnL.toFixed(2)),
        dailyPnL: parseFloat(dailyPnL.toFixed(2)),
        currentDrawdown: parseFloat(currentDrawdown.toFixed(1)),
        sharpeRatio: parseFloat((1.5 + (winRate / 50)).toFixed(2)),
        profitFactor: parseFloat((0.8 + (winRate / 40)).toFixed(2)),
      }));

    }, 1500);
  }, [setMarketData, setTrades, setAIDecisions, setBotStats, setLogs]);

  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      clearInterval(simulationRef.current);
      simulationRef.current = null;
    }
  }, []);

  const clearSimulatedData = useCallback(() => {
    stopSimulation();
    openPositions = [];
    totalPnL = 0;
    dailyPnL = 0;
    totalTradesCount = 0;
    winCount = 0;

    setTrades([]);
    setLogs([generateLogEntry({ level: 'INFO', message: '🔄 Modo REAL ativado - Apenas dados reais da Bybit' })]);
    setAIDecisions([]);
    setBotStats({ ...emptyStats, status: 'PAUSED' });
  }, [stopSimulation, setTrades, setLogs, setAIDecisions, setBotStats]);

  return {
    startSimulation,
    stopSimulation,
    clearSimulatedData,
    isSimulating: !!simulationRef.current,
  };
}
