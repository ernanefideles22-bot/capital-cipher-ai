import { useState, useEffect, useCallback, useRef } from 'react';
import type { Trade, MarketData, BotStats, AIDecision, LogEntry, BotConfig } from '@/types/trading';
import { useWebSocket, WebSocketMessage } from './useWebSocket';

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

const generateLogEntry = (): LogEntry => {
  const messages = [
    { level: 'INFO' as const, message: 'Analisando volume institucional em BTCUSDT...' },
    { level: 'SUCCESS' as const, message: 'Trade fechado com +2.3% de lucro' },
    { level: 'AI' as const, message: 'Detectado acúmulo institucional no suporte de $94,500' },
    { level: 'WARN' as const, message: 'Volatilidade alta detectada, reduzindo exposição' },
  ];
  
  const entry = messages[Math.floor(Math.random() * messages.length)];
  
  return {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    level: entry.level,
    message: entry.message,
  };
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
  const actions: AIDecision['action'][] = ['BUY', 'SELL', 'HOLD', 'SKIP'];
  const reasonings = [
    'Acúmulo institucional detectado com volume crescente',
    'Distribuição em zona premium, aguardando confirmação',
    'Quebra de estrutura com volume validado',
    'Divergência de volume identificada, sinal de reversão',
    'Suporte forte com rejeição de preço',
    'Liquidity grab detectado, possível reversão',
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
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [botStats, setBotStats] = useState<BotStats>({
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
  });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [aiDecisions, setAIDecisions] = useState<AIDecision[]>([]);
  const [config, setConfig] = useState<BotConfig>({
    mode: 'paper',
    marketMode: 'FUTURES',
    leverage: 5,
    maxDrawdown: 10,
    maxConcurrentTrades: 3,
    riskPerTrade: 2,
    assets: Object.keys(TRADING_PAIRS),
  });

  const simulationRef = useRef<NodeJS.Timeout | null>(null);

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

    // Initialize with simulated data for all pairs
    const symbols = Object.keys(TRADING_PAIRS);
    const initialMarket: Record<string, MarketData> = {};
    symbols.forEach(symbol => {
      initialMarket[symbol] = generateMarketData(symbol);
    });
    setMarketData(initialMarket);
    setTrades(Array.from({ length: 15 }, generateTrade));
    setAIDecisions(Array.from({ length: 5 }, generateAIDecision));
    setBotStats({
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

    simulationRef.current = setInterval(() => {
      // Update market data for all pairs
      setMarketData(prev => {
        const updated = { ...prev };
        symbols.forEach(symbol => {
          updated[symbol] = generateMarketData(symbol);
        });
        return updated;
      });

      // Occasionally add logs and decisions
      if (Math.random() > 0.7) {
        setLogs(prev => [generateLogEntry(), ...prev.slice(0, 99)]);
      }
      if (Math.random() > 0.9) {
        setAIDecisions(prev => [generateAIDecision(), ...prev.slice(0, 9)]);
      }
    }, 2000);
  }, []);

  // Start simulation on mount if not connected
  useEffect(() => {
    if (status === 'disconnected' || status === 'error') {
      startSimulation();
    }
    
    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
      }
    };
  }, [status, startSimulation]);

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
            testnet: updated.mode === 'paper' || updated.mode === 'live',
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
  };
};
