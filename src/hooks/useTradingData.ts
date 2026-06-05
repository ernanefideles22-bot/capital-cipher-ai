import { useState, useEffect, useCallback, useRef } from 'react';
import type { Trade, MarketData, BotStats, AIDecision, LogEntry, BotConfig } from '@/types/trading';
import { useWebSocket, WebSocketMessage } from './useWebSocket';
import { useTradingSimulation, TRADING_PAIRS } from './useTradingSimulation';

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
