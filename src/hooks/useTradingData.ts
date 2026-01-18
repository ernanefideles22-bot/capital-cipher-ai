import { useState, useEffect, useCallback, useRef } from 'react';
import type { Trade, MarketData, BotStats, AIDecision, LogEntry, BotConfig } from '@/types/trading';
import { useWebSocket, WebSocketMessage } from './useWebSocket';
import { getGlobalSentiment, type NewsSentiment } from './useNewsSentiment';
// Voice alert callback type - will be set by Index page
type VoiceAlertCallback = {
  onTradeOpened?: (symbol: string, side: 'LONG' | 'SHORT', confidence: number) => void;
  onTradeClosed?: (symbol: string, pnl: number, reason: string) => void;
};

let voiceCallbacks: VoiceAlertCallback = {};

export const setVoiceAlertCallbacks = (callbacks: VoiceAlertCallback) => {
  voiceCallbacks = callbacks;
};

// WebSocket URL - configure this to match your Python bot
const WS_URL = import.meta.env.VITE_BOT_WS_URL || 'ws://localhost:8765';

// All trading pairs with their base prices
const TRADING_PAIRS: Record<string, number> = {
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

// Fallback simulated data generators (used when not connected)
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

// Simulated prices that update realistically
const livePrices: Record<string, number> = { ...TRADING_PAIRS };

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

// Track open positions for simulation
let openPositions: Trade[] = [];
let totalPnL = 0;
let dailyPnL = 0;
let totalTradesCount = 0;
let winCount = 0;

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
  
  // Get current news sentiment to influence AI decisions
  const newsSentiment = getGlobalSentiment();
  
  // Determine action based on news sentiment
  let action: AIDecision['action'];
  let confidenceBoost = 0;
  let sentimentReasoning = '';
  
  if (newsSentiment.overallSentiment === 'bullish' && newsSentiment.confidence > 60) {
    // Strong bullish sentiment - favor BUY actions
    const rand = Math.random();
    if (rand > 0.3) {
      action = 'BUY';
      confidenceBoost = (newsSentiment.confidence - 50) * 0.3; // Up to +15% confidence
      sentimentReasoning = ' | 📰 Sentimento de notícias BULLISH (+' + Math.round(confidenceBoost) + '% confiança)';
    } else if (rand > 0.15) {
      action = 'HOLD';
    } else {
      action = 'SKIP';
    }
  } else if (newsSentiment.overallSentiment === 'bearish' && newsSentiment.confidence > 60) {
    // Strong bearish sentiment - favor SELL actions
    const rand = Math.random();
    if (rand > 0.3) {
      action = 'SELL';
      confidenceBoost = (newsSentiment.confidence - 50) * 0.3; // Up to +15% confidence
      sentimentReasoning = ' | 📰 Sentimento de notícias BEARISH (+' + Math.round(confidenceBoost) + '% confiança)';
    } else if (rand > 0.15) {
      action = 'HOLD';
    } else {
      action = 'SKIP';
    }
  } else {
    // Neutral sentiment - random but more cautious
    const actions: AIDecision['action'][] = ['BUY', 'SELL', 'HOLD', 'SKIP'];
    const weights = [0.2, 0.2, 0.35, 0.25]; // More HOLD/SKIP when neutral
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
  const baseConfidence = Math.random() * 35 + 55; // 55-90%
  
  // Adjust institutional flow based on sentiment
  let institutionalFlow = Math.random() * 200 - 100;
  if (newsSentiment.overallSentiment === 'bullish') {
    institutionalFlow = Math.abs(institutionalFlow) * 0.5 + 20; // Positive flow
  } else if (newsSentiment.overallSentiment === 'bearish') {
    institutionalFlow = -Math.abs(institutionalFlow) * 0.5 - 20; // Negative flow
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
        : Math.random() * 40 + 50, // Higher trend strength when sentiment is clear
      riskScore: newsSentiment.overallSentiment === 'neutral'
        ? Math.random() * 40 + 40 // Higher risk when neutral
        : Math.random() * 30 + 20, // Lower risk when sentiment is clear
    },
  };
};

// Empty stats for real mode (will come from actual trades)
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

interface UseTradingDataOptions {
  isRealMode?: boolean;
}

export const useTradingData = (options: UseTradingDataOptions = {}) => {
  const { isRealMode = false } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [botStats, setBotStats] = useState<BotStats>({ ...emptyStats });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [aiDecisions, setAIDecisions] = useState<AIDecision[]>([]);
  const DEFAULT_CONFIG: BotConfig = {
    mode: 'paper',
    marketMode: 'FUTURES',
    leverage: 5,
    maxDrawdown: 10,
    maxConcurrentTrades: 3,
    riskPerTrade: 2,
    assets: Object.keys(TRADING_PAIRS),
  };

  const loadSavedConfig = (): BotConfig | null => {
    try {
      const raw = localStorage.getItem('bot_config');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      const mode = parsed.mode === 'paper' || parsed.mode === 'live' ? parsed.mode : DEFAULT_CONFIG.mode;
      const marketMode =
        parsed.marketMode === 'SPOT' || parsed.marketMode === 'FUTURES'
          ? parsed.marketMode
          : DEFAULT_CONFIG.marketMode;

      const leverage = typeof parsed.leverage === 'number' ? parsed.leverage : DEFAULT_CONFIG.leverage;
      const maxDrawdown = typeof parsed.maxDrawdown === 'number' ? parsed.maxDrawdown : DEFAULT_CONFIG.maxDrawdown;
      const maxConcurrentTrades =
        typeof parsed.maxConcurrentTrades === 'number'
          ? parsed.maxConcurrentTrades
          : DEFAULT_CONFIG.maxConcurrentTrades;
      const riskPerTrade = typeof parsed.riskPerTrade === 'number' ? parsed.riskPerTrade : DEFAULT_CONFIG.riskPerTrade;

      const assets =
        Array.isArray(parsed.assets) && parsed.assets.every((a: unknown) => typeof a === 'string')
          ? (parsed.assets as string[])
          : DEFAULT_CONFIG.assets;

      return {
        mode,
        marketMode,
        leverage,
        maxDrawdown,
        maxConcurrentTrades,
        riskPerTrade,
        assets,
      };
    } catch {
      return null;
    }
  };

  const [config, setConfig] = useState<BotConfig>(() => loadSavedConfig() ?? DEFAULT_CONFIG);

  useEffect(() => {
    try {
      localStorage.setItem('bot_config', JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);

  const simulationRef = useRef<NodeJS.Timeout | null>(null);
  const prevModeRef = useRef<boolean>(isRealMode);

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    const { type, data } = message;

    switch (type) {
      case 'market_data':
        setMarketData(prev => ({
          ...prev,
          [data.symbol]: {
            symbol: data.symbol,
            price: data.price,
            change24h: data.change_24h || 0,
            changePercentage24h: data.change_percentage_24h || 0,
            high24h: data.high_24h || data.price,
            low24h: data.low_24h || data.price,
            volume24h: data.volume_24h || 0,
            timestamp: data.timestamp || Date.now(),
          },
        }));
        break;

      case 'bot_stats':
        setBotStats({
          status: data.status?.toUpperCase() || 'PAUSED',
          totalTrades: data.total_trades || 0,
          winRate: data.win_rate || 0,
          totalPnL: data.total_pnl || 0,
          dailyPnL: data.daily_pnl || 0,
          weeklyPnL: data.weekly_pnl || 0,
          monthlyPnL: data.monthly_pnl || 0,
          currentDrawdown: data.current_drawdown || 0,
          maxDrawdown: data.max_drawdown || 10,
          sharpeRatio: data.sharpe_ratio || 0,
          profitFactor: data.profit_factor || 0,
        });
        break;

      case 'trade':
        setTrades(prev => {
          const newTrade: Trade = {
            id: data.id || crypto.randomUUID(),
            symbol: data.symbol,
            side: data.side?.toUpperCase() === 'BUY' ? 'LONG' : 'SHORT',
            strategy: data.strategy?.toUpperCase() || 'SCALP',
            entryPrice: data.entry_price,
            exitPrice: data.exit_price,
            quantity: data.quantity,
            leverage: data.leverage || 1,
            stopLoss: data.stop_loss,
            takeProfit: data.take_profit,
            pnl: data.pnl || 0,
            pnlPercentage: data.pnl_percentage || 0,
            status: data.status?.toUpperCase() || 'OPEN',
            openedAt: new Date(data.opened_at || Date.now()),
            closedAt: data.closed_at ? new Date(data.closed_at) : undefined,
          };
          
          // Update existing trade or add new
          const existingIndex = prev.findIndex(t => t.id === newTrade.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = newTrade;
            return updated;
          }
          return [newTrade, ...prev.slice(0, 49)];
        });
        break;

      case 'log':
        setLogs(prev => [{
          id: crypto.randomUUID(),
          timestamp: new Date(data.timestamp || Date.now()),
          level: data.level?.toUpperCase() || 'INFO',
          message: data.message,
        }, ...prev.slice(0, 99)]);
        break;

      case 'ai_decision':
        setAIDecisions(prev => [{
          id: crypto.randomUUID(),
          timestamp: new Date(data.timestamp || Date.now()),
          symbol: data.symbol,
          action: data.action?.toUpperCase() || 'HOLD',
          confidence: data.confidence || 0,
          reasoning: data.reasoning || '',
          indicators: {
            institutionalFlow: data.institutional_flow || 0,
            volumeCluster: data.volume_cluster || false,
            trendStrength: data.trend_strength || 0,
            riskScore: data.risk_score || 0,
          },
        }, ...prev.slice(0, 9)]);
        break;

      case 'config':
        setConfig({
          mode: data.testnet ? 'paper' : 'live',
          marketMode: data.market_mode?.toUpperCase() || 'FUTURES',
          leverage: data.default_leverage || 5,
          maxDrawdown: data.max_drawdown || 10,
          maxConcurrentTrades: data.max_concurrent_trades || 3,
          riskPerTrade: data.risk_per_trade || 2,
          assets: data.symbols || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
        });
        break;

      case 'full_state':
        // Handle initial full state sync
        if (data.market_data) {
          const newMarketData: Record<string, MarketData> = {};
          Object.entries(data.market_data).forEach(([symbol, md]: [string, any]) => {
            newMarketData[symbol] = {
              symbol,
              price: md.price,
              change24h: md.change_24h || 0,
              changePercentage24h: md.change_percentage_24h || 0,
              high24h: md.high_24h || md.price,
              low24h: md.low_24h || md.price,
              volume24h: md.volume_24h || 0,
              timestamp: md.timestamp || Date.now(),
            };
          });
          setMarketData(newMarketData);
        }
        if (data.trades) {
          setTrades(data.trades.map((t: any) => ({
            id: t.id || crypto.randomUUID(),
            symbol: t.symbol,
            side: t.side?.toUpperCase() === 'BUY' ? 'LONG' : 'SHORT',
            strategy: t.strategy?.toUpperCase() || 'SCALP',
            entryPrice: t.entry_price,
            exitPrice: t.exit_price,
            quantity: t.quantity,
            leverage: t.leverage || 1,
            stopLoss: t.stop_loss,
            takeProfit: t.take_profit,
            pnl: t.pnl || 0,
            pnlPercentage: t.pnl_percentage || 0,
            status: t.status?.toUpperCase() || 'OPEN',
            openedAt: new Date(t.opened_at || Date.now()),
            closedAt: t.closed_at ? new Date(t.closed_at) : undefined,
          })));
        }
        break;
    }
  }, []);

  const { status, sendMessage, connect } = useWebSocket({
    url: WS_URL,
    reconnect: true,
    reconnectInterval: 5000,
    maxReconnectAttempts: 20,
    onMessage: handleWebSocketMessage,
    onConnect: () => {
      setIsConnected(true);
      setConnectionError(null);
      // Clear simulation when connected
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
      // Request full state sync
      sendMessage({ type: 'get_state' });
    },
    onDisconnect: () => {
      setIsConnected(false);
      // Start simulation fallback
      startSimulation();
    },
    onError: () => {
      setConnectionError('Falha ao conectar ao bot. Usando dados simulados.');
    },
  });

  // Simulation fallback for when WebSocket is not connected
  const startSimulation = useCallback(() => {
    if (simulationRef.current) return;

    // Reset simulation state
    openPositions = [];
    totalPnL = 5000; // Start with some P&L
    dailyPnL = 0;
    totalTradesCount = 150;
    winCount = 102;

    // Initialize prices
    const symbols = Object.keys(TRADING_PAIRS);
    symbols.forEach(symbol => {
      livePrices[symbol] = TRADING_PAIRS[symbol];
    });

    // Initialize with simulated data for all pairs
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

    setLogs(prev => [generateLogEntry({ level: 'SUCCESS', message: '🤖 Bot IA iniciado - Modo simulação ativo' }), ...prev.slice(0, 99)]);

    // Main simulation loop - runs every 1.5 seconds
    simulationRef.current = setInterval(() => {
      // Update prices realistically
      symbols.forEach(symbol => {
        const basePrice = TRADING_PAIRS[symbol];
        const volatility = basePrice * 0.001;
        const trend = Math.sin(Date.now() / 50000) * 0.0002;
        livePrices[symbol] = livePrices[symbol] * (1 + (Math.random() - 0.5 + trend) * 0.002);
        // Keep prices within reasonable bounds
        livePrices[symbol] = Math.max(basePrice * 0.9, Math.min(basePrice * 1.1, livePrices[symbol]));
      });

      // Update market data display
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

      // Check for trade exits
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
          
          // Voice alert for trade closed
          const reason = isProfit ? 'TP' : 'SL';
          voiceCallbacks.onTradeClosed?.(trade.symbol, trade.pnl || 0, reason);
        });
        
        setTrades(prev => [...closedTrades, ...prev.slice(0, 49)]);
      }

      // AI makes decisions frequently
      if (Math.random() > 0.4) {
        const decision = generateAIDecision();
        setAIDecisions(prev => [decision, ...prev.slice(0, 9)]);

        // Log the decision
        if (decision.action === 'BUY' || decision.action === 'SELL') {
          setLogs(prev => [
            generateLogEntry({ 
              level: 'AI', 
              message: `🧠 Analisando ${decision.symbol}: ${decision.action} (${decision.confidence.toFixed(0)}% confiança)` 
            }), 
            ...prev.slice(0, 99)
          ]);

          // Execute trade if conditions are met
          const newTrade = executeAITrade(decision);
          if (newTrade) {
            setLogs(prev => [
              generateLogEntry({ 
                level: 'SUCCESS', 
                message: `🚀 TRADE ABERTO: ${newTrade.symbol} ${newTrade.side} @ $${newTrade.entryPrice.toFixed(2)} | SL: $${newTrade.stopLoss.toFixed(2)} | TP: $${newTrade.takeProfit.toFixed(2)}` 
              }), 
              ...prev.slice(0, 99)
            ]);
            
            // Voice alert for trade opened
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

      // Update open positions in trades list
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

      // Update bot stats
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
  }, []);

  // Stop simulation when switching to real mode
  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      clearInterval(simulationRef.current);
      simulationRef.current = null;
    }
  }, []);

  // Clear all simulated data when switching to real mode
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
  }, [stopSimulation]);

  // Handle mode changes
  useEffect(() => {
    if (prevModeRef.current !== isRealMode) {
      prevModeRef.current = isRealMode;
      
      if (isRealMode) {
        // Switching to real mode - clear all simulated data
        clearSimulatedData();
      } else {
        // Switching to demo mode - start simulation
        startSimulation();
      }
    }
  }, [isRealMode, clearSimulatedData, startSimulation]);

  // Start simulation on mount if not connected and in demo mode
  useEffect(() => {
    if (!isRealMode && (status === 'disconnected' || status === 'error')) {
      startSimulation();
    }
    
    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
      }
    };
  }, [status, startSimulation, isRealMode]);

  const toggleBotStatus = useCallback(() => {
    const newStatus = botStats.status === 'RUNNING' ? 'PAUSED' : 'RUNNING';
    
    if (isConnected) {
      sendMessage({
        type: 'command',
        action: newStatus === 'RUNNING' ? 'start' : 'pause',
      });
    }
    
    setBotStats(prev => ({
      ...prev,
      status: newStatus,
    }));
  }, [botStats.status, isConnected, sendMessage]);

  const updateConfig = useCallback((newConfig: Partial<BotConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };

      if (isConnected) {
        sendMessage({
          type: 'config_update',
          data: {
            // testnet = true only when mode is paper
            testnet: updated.mode === 'paper',
            market_mode: updated.marketMode.toLowerCase(),
            default_leverage: updated.leverage,
            max_drawdown: updated.maxDrawdown,
            max_concurrent_trades: updated.maxConcurrentTrades,
            risk_per_trade: updated.riskPerTrade,
            symbols: updated.assets,
          },
        });
      }

      return updated;
    });
  }, [isConnected, sendMessage]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    // Connection status
    isConnected,
    connectionStatus: status,
    connectionError,
    reconnect: connect,
    
    // Data
    marketData,
    botStats,
    trades,
    logs,
    aiDecisions,
    config,
    
    // Actions
    toggleBotStatus,
    updateConfig,
    sendCommand: sendMessage,
    clearLogs,
  };
};
