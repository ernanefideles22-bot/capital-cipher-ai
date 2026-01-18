import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

// Callback for when a trade is executed
export type OnTradeExecutedCallback = (trade: TradeResult) => Promise<void>;

// Callback for when bot is stopped
export type OnBotStoppedCallback = (reason: string) => void;

const DEFAULT_CONFIG: TradingConfig = {
  leverage: 10,
  positionSize: 5,
  maxDrawdown: 10,
  maxDailyLoss: 500, // USD
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

export function useTradingAI(options: UseTradingAIOptions = {}) {
  const { onTradeExecuted, onBotStopped, externalRunning, currentDrawdown = 0, dailyPnL = 0 } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<TradingConfig>(DEFAULT_CONFIG);
  const [isRunning, setIsRunning] = useState(false);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<{
    symbol: string;
    indicators: MarketIndicators | null;
    decision: AIDecision | null;
    ticker: TickerData | null;
    positions: Position[];
    timestamp: Date;
  } | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeResult[]>([]);
  const [logs, setLogs] = useState<{ time: Date; message: string; type: 'info' | 'success' | 'error' | 'warning' }[]>([]);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => [...prev.slice(-99), { time: new Date(), message, type }]);
  }, []);

  // Check rules and stop bot if necessary
  const checkStopRules = useCallback(() => {
    // Check max drawdown rule
    if (currentDrawdown >= config.maxDrawdown) {
      const reason = `Drawdown máximo atingido (${currentDrawdown.toFixed(1)}% >= ${config.maxDrawdown}%)`;
      return reason;
    }

    // Check max daily loss rule
    if (dailyPnL <= -config.maxDailyLoss) {
      const reason = `Perda diária máxima atingida ($${Math.abs(dailyPnL).toFixed(2)} >= $${config.maxDailyLoss})`;
      return reason;
    }

    return null;
  }, [currentDrawdown, dailyPnL, config.maxDrawdown, config.maxDailyLoss]);

  // Auto-stop when rules are violated
  useEffect(() => {
    if (isRunning) {
      const reason = checkStopRules();
      if (reason) {
        stopAutoTrading(reason);
      }
    }
  }, [isRunning, currentDrawdown, dailyPnL]);

  // Sync with external running state
  useEffect(() => {
    if (externalRunning !== undefined && externalRunning !== isRunning) {
      if (externalRunning) {
        startAutoTrading();
      } else {
        stopAutoTrading('Parado externamente');
      }
    }
  }, [externalRunning]);

  const analyze = useCallback(async (symbol: string): Promise<{
    indicators: MarketIndicators | null;
    decision: AIDecision | null;
    ticker: TickerData | null;
    positions: Position[];
  } | null> => {
    setLoading(true);
    setError(null);
    addLog(`Analisando ${symbol}...`, 'info');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('trading-ai', {
        body: { action: 'analyze', symbol, config },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      const result = {
        indicators: data.indicators,
        decision: data.decision,
        ticker: data.ticker,
        positions: data.positions || [],
      };

      setLastAnalysis({
        symbol,
        ...result,
        timestamp: new Date(),
      });

      if (data.decision) {
        const actionEmoji = data.decision.action === 'BUY' ? '🟢' : data.decision.action === 'SELL' ? '🔴' : '⚪';
        addLog(`${actionEmoji} ${symbol}: ${data.decision.action} (${data.decision.confidence}% confiança)`, 
          data.decision.action !== 'HOLD' ? 'success' : 'info');
      }

      return result;
    } catch (err: any) {
      setError(err.message);
      addLog(`Erro ao analisar ${symbol}: ${err.message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [config, addLog]);

  const autoTrade = useCallback(async (symbol: string): Promise<TradeResult | null> => {
    setLoading(true);
    addLog(`Auto-trade iniciado para ${symbol}...`, 'info');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('trading-ai', {
        body: { action: 'autoTrade', symbol, config },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Auto-trade failed');
      }

      setLastAnalysis({
        symbol,
        indicators: data.indicators,
        decision: data.decision,
        ticker: data.ticker,
        positions: data.positions || [],
        timestamp: new Date(),
      });

      if (data.tradeResult) {
        setTradeHistory(prev => [...prev.slice(-49), data.tradeResult]);
        
        if (data.tradeResult.executed) {
          const side = data.tradeResult.details?.side;
          addLog(`✅ Trade executado: ${side} ${symbol} @ $${data.tradeResult.details?.entry}`, 'success');
          toast.success(`Trade executado: ${side} ${symbol}`);
          
          // Call the callback to save the trade to database
          if (onTradeExecuted) {
            try {
              await onTradeExecuted(data.tradeResult);
              addLog(`💾 Trade salvo no banco de dados`, 'info');
            } catch (saveErr: any) {
              addLog(`⚠️ Erro ao salvar trade: ${saveErr.message}`, 'error');
            }
          }
        } else {
          addLog(`⏸️ Trade não executado: ${data.tradeResult.reason}`, 'warning');
        }
        
        return data.tradeResult;
      }

      return null;
    } catch (err: any) {
      setError(err.message);
      addLog(`Erro no auto-trade ${symbol}: ${err.message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [config, addLog, onTradeExecuted]);

  const startAutoTrading = useCallback(() => {
    if (isRunning) return;
    
    setIsRunning(true);
    addLog('🤖 Bot de trading iniciado', 'success');
    toast.success('Bot de trading iniciado!');

    const runCycle = async () => {
      for (const symbol of config.symbols) {
        if (config.autoTrade) {
          await autoTrade(symbol);
        } else {
          await analyze(symbol);
        }
        // Small delay between symbols
        await new Promise(r => setTimeout(r, 2000));
      }
    };

    // Run immediately
    runCycle();

    // Then run at intervals
    intervalRef.current = setInterval(runCycle, config.intervalSeconds * 1000);
  }, [isRunning, config, autoTrade, analyze, addLog]);

  const stopAutoTrading = useCallback((reason?: string) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    const stopMsg = reason || 'Parado pelo usuário';
    setStopReason(stopMsg);
    addLog(`🛑 Bot de trading parado: ${stopMsg}`, 'warning');
    toast.info(`Bot parado: ${stopMsg}`);
    
    // Notify external callback
    if (onBotStopped && reason) {
      onBotStopped(reason);
    }
  }, [addLog, onBotStopped]);

  const updateConfig = useCallback((updates: Partial<TradingConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    addLog(`Configuração atualizada: ${JSON.stringify(updates)}`, 'info');
  }, [addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    loading,
    error,
    config,
    isRunning,
    stopReason,
    lastAnalysis,
    tradeHistory,
    logs,
    analyze,
    autoTrade,
    startAutoTrading,
    stopAutoTrading,
    updateConfig,
  };
}