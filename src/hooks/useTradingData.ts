import { useState, useEffect, useCallback, useRef } from 'react';
import type { Trade, MarketData, BotStats, AIDecision, LogEntry, BotConfig } from '@/types/trading';
import { useWebSocket, WebSocketMessage } from './useWebSocket';
import { useTradingSimulation, TRADING_PAIRS } from './useTradingSimulation';
import { wsMarketDataSchema, wsBotStatsSchema, wsTradeSchema, wsLogSchema, wsAIDecisionSchema } from '@/lib/validations';

export { setVoiceAlertCallbacks } from './useTradingSimulation';

// WebSocket URL - configure this to match your Python bot
const WS_URL = import.meta.env.VITE_BOT_WS_URL || 'ws://localhost:8765';

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
  const [config, setConfig] = useState<BotConfig>(() => {
    // Load saved config from localStorage
    try {
      const saved = localStorage.getItem('bot_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          mode: parsed.mode === 'paper' || parsed.mode === 'live' ? parsed.mode : 'paper',
          marketMode: parsed.marketMode === 'SPOT' || parsed.marketMode === 'FUTURES' ? parsed.marketMode : 'FUTURES',
          leverage: typeof parsed.leverage === 'number' ? parsed.leverage : 5,
          maxDrawdown: typeof parsed.maxDrawdown === 'number' ? parsed.maxDrawdown : 10,
          maxConcurrentTrades: typeof parsed.maxConcurrentTrades === 'number' ? parsed.maxConcurrentTrades : 3,
          riskPerTrade: typeof parsed.riskPerTrade === 'number' ? parsed.riskPerTrade : 2,
          assets: Array.isArray(parsed.assets) ? parsed.assets : Object.keys(TRADING_PAIRS),
        };
      }
    } catch {
      // ignore
    }
    return {
      mode: 'paper',
      marketMode: 'FUTURES',
      leverage: 5,
      maxDrawdown: 10,
      maxConcurrentTrades: 3,
      riskPerTrade: 2,
      assets: Object.keys(TRADING_PAIRS),
    };
  });

  const prevModeRef = useRef<boolean>(isRealMode);

  const { startSimulation, stopSimulation, clearSimulatedData } = useTradingSimulation({
    isRealMode,
    setMarketData,
    setTrades,
    setAIDecisions,
    setBotStats,
    setLogs,
  });

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    const { type, data } = message;

    if (!data) return;

    switch (type) {
      case 'market_data': {
        const parsed = wsMarketDataSchema.safeParse(data);
        if (!parsed.success) {
          console.warn('Invalid market_data WS message:', parsed.error.format());
          return;
        }
        const validatedData = parsed.data;
        setMarketData(prev => ({
          ...prev,
          [validatedData.symbol]: {
            symbol: validatedData.symbol,
            price: validatedData.price,
            change24h: validatedData.change_24h,
            changePercentage24h: validatedData.change_percentage_24h,
            high24h: validatedData.high_24h || validatedData.price,
            low24h: validatedData.low_24h || validatedData.price,
            volume24h: validatedData.volume_24h,
            timestamp: validatedData.timestamp,
          },
        }));
        break;
      }

      case 'bot_stats': {
        const parsed = wsBotStatsSchema.safeParse(data);
        if (!parsed.success) {
          console.warn('Invalid bot_stats WS message:', parsed.error.format());
          return;
        }
        const validatedData = parsed.data;
        setBotStats({
          status: validatedData.status,
          totalTrades: validatedData.total_trades,
          winRate: validatedData.win_rate,
          totalPnL: validatedData.total_pnl,
          dailyPnL: validatedData.daily_pnl,
          weeklyPnL: validatedData.weekly_pnl,
          monthlyPnL: validatedData.monthly_pnl,
          currentDrawdown: validatedData.current_drawdown,
          maxDrawdown: validatedData.max_drawdown,
          sharpeRatio: validatedData.sharpe_ratio,
          profitFactor: validatedData.profit_factor,
        });
        break;
      }

      case 'trade': {
        const parsed = wsTradeSchema.safeParse(data);
        if (!parsed.success) {
          console.warn('Invalid trade WS message:', parsed.error.format());
          return;
        }
        const validatedData = parsed.data;
        setTrades(prev => {
          const newTrade: Trade = {
            id: validatedData.id,
            symbol: validatedData.symbol,
            side: validatedData.side,
            strategy: validatedData.strategy,
            entryPrice: validatedData.entry_price,
            exitPrice: validatedData.exit_price,
            quantity: validatedData.quantity,
            leverage: validatedData.leverage,
            stopLoss: validatedData.stop_loss,
            takeProfit: validatedData.take_profit,
            pnl: validatedData.pnl,
            pnlPercentage: validatedData.pnl_percentage,
            status: validatedData.status,
            openedAt: new Date(validatedData.opened_at),
            closedAt: validatedData.closed_at ? new Date(validatedData.closed_at) : undefined,
          };
          
          const existingIndex = prev.findIndex(t => t.id === newTrade.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = newTrade;
            return updated;
          }
          return [newTrade, ...prev.slice(0, 49)];
        });
        break;
      }

      case 'log': {
        const parsed = wsLogSchema.safeParse(data);
        if (!parsed.success) {
          console.warn('Invalid log WS message:', parsed.error.format());
          return;
        }
        const validatedData = parsed.data;
        setLogs(prev => [{
          id: crypto.randomUUID(),
          timestamp: new Date(validatedData.timestamp),
          level: validatedData.level,
          message: validatedData.message,
        }, ...prev.slice(0, 99)]);
        break;
      }

      case 'ai_decision': {
        const parsed = wsAIDecisionSchema.safeParse(data);
        if (!parsed.success) {
          console.warn('Invalid ai_decision WS message:', parsed.error.format());
          return;
        }
        const validatedData = parsed.data;
        setAIDecisions(prev => [{
          id: crypto.randomUUID(),
          timestamp: new Date(validatedData.timestamp),
          symbol: validatedData.symbol,
          action: validatedData.action,
          confidence: validatedData.confidence,
          reasoning: validatedData.reasoning,
          indicators: {
            institutionalFlow: validatedData.institutional_flow,
            volumeCluster: validatedData.volume_cluster,
            trendStrength: validatedData.trend_strength,
            riskScore: validatedData.risk_score,
          },
        }, ...prev.slice(0, 9)]);
        break;
      }

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
        if (data.market_data) {
          const newMarketData: Record<string, MarketData> = {};
          Object.entries(data.market_data).forEach(([symbol, md]: [string, any]) => {
            const parsed = wsMarketDataSchema.safeParse({ ...md, symbol });
            if (parsed.success) {
              const validatedData = parsed.data;
              newMarketData[symbol] = {
                symbol,
                price: validatedData.price,
                change24h: validatedData.change_24h,
                changePercentage24h: validatedData.change_percentage_24h,
                high24h: validatedData.high_24h || validatedData.price,
                low24h: validatedData.low_24h || validatedData.price,
                volume24h: validatedData.volume_24h,
                timestamp: validatedData.timestamp,
              };
            }
          });
          setMarketData(newMarketData);
        }
        if (data.trades && Array.isArray(data.trades)) {
          const validatedTrades: Trade[] = [];
          data.trades.forEach((t: any) => {
            const parsed = wsTradeSchema.safeParse(t);
            if (parsed.success) {
              const validatedData = parsed.data;
              validatedTrades.push({
                id: validatedData.id,
                symbol: validatedData.symbol,
                side: validatedData.side,
                strategy: validatedData.strategy,
                entryPrice: validatedData.entry_price,
                exitPrice: validatedData.exit_price,
                quantity: validatedData.quantity,
                leverage: validatedData.leverage,
                stopLoss: validatedData.stop_loss,
                takeProfit: validatedData.take_profit,
                pnl: validatedData.pnl,
                pnlPercentage: validatedData.pnl_percentage,
                status: validatedData.status,
                openedAt: new Date(validatedData.opened_at),
                closedAt: validatedData.closed_at ? new Date(validatedData.closed_at) : undefined,
              });
            }
          });
          setTrades(validatedTrades);
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
      stopSimulation();
      // Request full state sync
      sendMessage({ type: 'get_state' });
    },
    onDisconnect: () => {
      setIsConnected(false);
      // Start simulation fallback
      if (!isRealMode) {
        startSimulation();
      }
    },
    onError: () => {
      setConnectionError('Falha ao conectar ao bot. Usando dados simulados.');
    },
  });

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
      stopSimulation();
    };
  }, [status, isRealMode, startSimulation, stopSimulation]);

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
