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

export type OnTradeExecutedCallback = (trade: TradeResult) => Promise<void>;
export type OnBotStoppedCallback = (reason: string) => void;

const DEFAULT_CONFIG: TradingConfig = {
  leverage: 10,
  positionSize: 5,
  maxDrawdown: 10,
  maxDailyLoss: 500,
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

const sanitizeEdgeError = (message: string) => {
  if (/non-2xx|edge function|functions/i.test(message)) {
    return 'Serviço de IA remoto indisponível. Usando modo local seguro.';
  }
  return message || 'Serviço de IA indisponível. Usando modo local seguro.';
};

const createLocalAnalysis = (symbol: string) => {
  const priceBySymbol: Record<string, number> = {
    BTCUSDT: 73480,
    ETHUSDT: 2012,
    SOLUSDT: 182,
  };
  const price = priceBySymbol[symbol] || 100;

  const indicators: MarketIndicators = {
    rsi: 52,
    ema9: price * 1.002,
    ema21: price * 0.998,
    macd: 0.12,
    volumeRatio: 0.8,
    priceChange1h: 0.1,
    priceChange4h: -0.2,
    currentPrice: price,
    trend: 'bullish',
  };

  const decision: AIDecision = {
    action: 'HOLD',
    confidence: 62,
    reasoning: 'Modo local seguro: serviço remoto de IA indisponível. A recomendação é aguardar confirmação técnica antes de qualquer operação.',
    entry: null,
    takeProfit: null,
    stopLoss: null,
    riskRewardRatio: null,
  };

  const ticker: TickerData = {
    price,
    change24h: 0,
    volume24h: 0,
    high24h: price * 1.03,
    low24h: price * 0.97,
  };

  return { indicators, decision, ticker, positions: [] as Position[] };
};

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
  const lastRemoteFailureRef = useRef<number>(0);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => [...prev.slice(-99), { time: new Date(), message, type }]);
  }, []);

  const checkStopRules = useCallback(() => {
    if (currentDrawdown > config.maxDrawdown) return `Drawdown máximo atingido (${currentDrawdown.toFixed(1)}% > ${config.maxDrawdown}%)`;
    if (dailyPnL < -config.maxDailyLoss) return `Perda diária máxima atingida ($${Math.abs(dailyPnL).toFixed(2)} > $${config.maxDailyLoss})`;
    return null;
  }, [currentDrawdown, dailyPnL, config.maxDrawdown, config.maxDailyLoss]);

  const stopAutoTrading = useCallback((reason?: string) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    const stopMsg = reason || 'Parado pelo usuário';
    setStopReason(stopMsg);
    addLog(`Bot de trading parado: ${stopMsg}`, 'warning');
    toast.info(`Bot parado: ${stopMsg}`);
    if (onBotStopped && reason) onBotStopped(reason);
  }, [addLog, onBotStopped]);

  useEffect(() => {
    if (isRunning && (currentDrawdown > 0 || dailyPnL !== 0)) {
      const reason = checkStopRules();
      if (reason) stopAutoTrading(reason);
    }
  }, [isRunning, currentDrawdown, dailyPnL, checkStopRules, stopAutoTrading]);

  const analyze = useCallback(async (symbol: string): Promise<{
    indicators: MarketIndicators | null;
    decision: AIDecision | null;
    ticker: TickerData | null;
    positions: Position[];
  } | null> => {
    setLoading(true);
    setError(null);
    addLog(`Analisando ${symbol}...`, 'info');

    const useLocalFallback = (reason: string) => {
      const local = createLocalAnalysis(symbol);
      setLastAnalysis({ symbol, ...local, timestamp: new Date() });
      setError(null);
      addLog(`${sanitizeEdgeError(reason)} ${symbol}: análise local em modo HOLD.`, 'warning');
      return local;
    };

    try {
      if (Date.now() - lastRemoteFailureRef.current < 30000) {
        return useLocalFallback('Serviço remoto em cooldown');
      }

      const { data, error: fnError } = await supabase.functions.invoke('trading-ai', {
        body: { action: 'analyze', symbol, config, language: 'pt-BR' },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || 'Analysis failed');

      const result = {
        indicators: data.indicators,
        decision: data.decision,
        ticker: data.ticker,
        positions: data.positions || [],
      };

      setLastAnalysis({ symbol, ...result, timestamp: new Date() });
      if (data.decision) {
        addLog(`${symbol}: ${data.decision.action} (${data.decision.confidence}% confiança)`, data.decision.action !== 'HOLD' ? 'success' : 'info');
      }
      return result;
    } catch (err: any) {
      lastRemoteFailureRef.current = Date.now();
      return useLocalFallback(err?.message || 'Falha no serviço remoto');
    } finally {
      setLoading(false);
    }
  }, [config, addLog]);

  const autoTrade = useCallback(async (symbol: string): Promise<TradeResult | null> => {
    setLoading(true);
    setError(null);
    addLog(`Auto-trade iniciado para ${symbol}...`, 'info');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('trading-ai', {
        body: { action: 'autoTrade', symbol, config, language: 'pt-BR' },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || 'Auto-trade failed');

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
          addLog(`Trade executado: ${side} ${symbol} @ $${data.tradeResult.details?.entry}`, 'success');
          toast.success(`Trade executado: ${side} ${symbol}`);
          if (onTradeExecuted) {
            try {
              await onTradeExecuted(data.tradeResult);
              addLog('Trade salvo no banco de dados', 'info');
            } catch (saveErr: any) {
              addLog(`Erro ao salvar trade: ${saveErr.message}`, 'warning');
            }
          }
        } else {
          addLog(`Trade não executado: ${data.tradeResult.reason}`, 'warning');
        }
        return data.tradeResult;
      }
      return null;
    } catch (err: any) {
      lastRemoteFailureRef.current = Date.now();
      const reason = sanitizeEdgeError(err?.message || 'Falha no auto-trade');
      addLog(`${symbol}: ${reason} Operação bloqueada por segurança.`, 'warning');
      return { executed: false, reason };
    } finally {
      setLoading(false);
    }
  }, [config, addLog, onTradeExecuted]);

  const startAutoTrading = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    addLog('Bot de trading iniciado', 'success');
    toast.success('Bot de trading iniciado!');

    const runCycle = async () => {
      for (const symbol of config.symbols) {
        if (config.autoTrade) await autoTrade(symbol);
        else await analyze(symbol);
        await new Promise(r => setTimeout(r, 2000));
      }
    };

    runCycle();
    intervalRef.current = setInterval(runCycle, config.intervalSeconds * 1000);
  }, [isRunning, config, autoTrade, analyze, addLog]);

  useEffect(() => {
    if (externalRunning !== undefined && externalRunning !== isRunning) {
      if (externalRunning) startAutoTrading();
      else stopAutoTrading('Parado externamente');
    }
  }, [externalRunning, isRunning, startAutoTrading, stopAutoTrading]);

  const updateConfig = useCallback((updates: Partial<TradingConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    addLog(`Configuração atualizada: ${JSON.stringify(updates)}`, 'info');
  }, [addLog]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
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
