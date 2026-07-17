import { useCallback, useState } from 'react';
import { toast } from 'sonner';

export interface AIDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  entry: number | null;
  takeProfit: number | null;
  stopLoss: number | null;
  riskRewardRatio: number | null;
}

export interface MarketIndicators {
  rsi: number;
  ema9: number;
  ema21: number;
  macd: number;
  volumeRatio: number;
  priceChange1h: number;
  priceChange4h: number;
  currentPrice: number;
  trend: 'bullish' | 'bearish';
}

export interface TickerData {
  price: number;
  change24h: number;
  volume24h: number;
  high24h?: number;
  low24h?: number;
}

export interface Position {
  symbol: string;
  side: 'Buy' | 'Sell';
  size: string;
  avgPrice: string;
  unrealisedPnl: string;
}

export interface TradeResult {
  executed: boolean;
  orderId?: string;
  reason: string;
  details?: {
    symbol: string;
    side: string;
    qty: number;
    entry: number;
    takeProfit: number | null;
    stopLoss: number | null;
  };
}

export interface TradingConfig {
  leverage: number;
  positionSize: number;
  maxDrawdown: number;
  maxDailyLoss: number;
  autoTrade: boolean;
  symbols: string[];
  intervalSeconds: number;
}

export type OnTradeExecutedCallback = (trade: TradeResult) => Promise<void>;
export type OnBotStoppedCallback = (reason: string) => void;

const LEGACY_TRADING_FROZEN =
  'Trading por IA está desativado neste aplicativo legado. Use capital-cipher-platform em modo PAPER.';

const DEFAULT_CONFIG: TradingConfig = {
  leverage: 1,
  positionSize: 0,
  maxDrawdown: 0,
  maxDailyLoss: 0,
  autoTrade: false,
  symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
  intervalSeconds: 60,
};

interface UseTradingAIOptions {
  onTradeExecuted?: OnTradeExecutedCallback;
  onBotStopped?: OnBotStoppedCallback;
  externalRunning?: boolean;
  currentDrawdown?: number;
  dailyPnL?: number;
}

type LogEntry = {
  time: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
};

export function useTradingAI(options: UseTradingAIOptions = {}) {
  const { onBotStopped } = options;
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<TradingConfig>(DEFAULT_CONFIG);
  const [stopReason, setStopReason] = useState<string | null>(LEGACY_TRADING_FROZEN);
  const [lastAnalysis, setLastAnalysis] = useState<{
    symbol: string;
    indicators: MarketIndicators | null;
    decision: AIDecision | null;
    ticker: TickerData | null;
    positions: Position[];
    timestamp: Date;
  } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: new Date(), message: LEGACY_TRADING_FROZEN, type: 'warning' },
  ]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs((previous) => [...previous.slice(-99), { time: new Date(), message, type }]);
  }, []);

  const analyze = useCallback(async (symbol: string) => {
    setLoading(true);
    const result = {
      indicators: null,
      decision: null,
      ticker: null,
      positions: [] as Position[],
    };
    setLastAnalysis({ symbol, ...result, timestamp: new Date() });
    addLog(`${symbol}: análise remota bloqueada pelo congelamento de segurança.`, 'warning');
    setLoading(false);
    return result;
  }, [addLog]);

  const autoTrade = useCallback(async (_symbol: string): Promise<TradeResult> => {
    setStopReason(LEGACY_TRADING_FROZEN);
    addLog(LEGACY_TRADING_FROZEN, 'error');
    return { executed: false, reason: LEGACY_TRADING_FROZEN };
  }, [addLog]);

  const startAutoTrading = useCallback(() => {
    setStopReason(LEGACY_TRADING_FROZEN);
    addLog(LEGACY_TRADING_FROZEN, 'error');
    toast.warning(LEGACY_TRADING_FROZEN);
    onBotStopped?.(LEGACY_TRADING_FROZEN);
  }, [addLog, onBotStopped]);

  const stopAutoTrading = useCallback((reason?: string) => {
    const message = reason || LEGACY_TRADING_FROZEN;
    setStopReason(message);
    addLog(`Bot parado: ${message}`, 'warning');
    if (reason) onBotStopped?.(reason);
  }, [addLog, onBotStopped]);

  const updateConfig = useCallback((updates: Partial<TradingConfig>) => {
    setConfig((previous) => ({ ...previous, ...updates, autoTrade: false, leverage: 1, positionSize: 0 }));
    addLog('Configuração mantida em modo PAPER; auto-trade permanece bloqueado.', 'warning');
  }, [addLog]);

  return {
    loading,
    error: LEGACY_TRADING_FROZEN,
    config,
    isRunning: false,
    stopReason,
    lastAnalysis,
    tradeHistory: [] as TradeResult[],
    logs,
    analyze,
    autoTrade,
    startAutoTrading,
    stopAutoTrading,
    updateConfig,
  };
}
