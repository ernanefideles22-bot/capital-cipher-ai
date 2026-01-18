import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MarketData, Trade, AIDecision, LogEntry } from '@/types/trading';

export interface BotOpportunity {
  symbol: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  score: number;
  reasoning: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
}

export interface MultiPairAnalysisResult {
  success: boolean;
  timestamp: string;
  pairsAnalyzed: number;
  bestOpportunities: BotOpportunity[];
  marketOverview: string;
  topPick: {
    symbol: string;
    action: 'BUY' | 'SELL';
    urgency: 'high' | 'medium' | 'low';
  } | null;
}

interface UseAutonomousBotOptions {
  marketData: Record<string, MarketData>;
  onTradeOpened?: (trade: Trade) => void;
  onDecisionMade?: (decision: AIDecision) => void;
  onLog?: (log: LogEntry) => void;
  intervalMs?: number;
  minConfidence?: number;
  maxConcurrentTrades?: number;
}

export const useAutonomousBot = ({
  marketData,
  onTradeOpened,
  onDecisionMade,
  onLog,
  intervalMs = 60000, // Default: analyze every 60 seconds
  minConfidence = 70,
  maxConcurrentTrades = 3,
}: UseAutonomousBotOptions) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<MultiPairAnalysisResult | null>(null);
  const [opportunities, setOpportunities] = useState<BotOpportunity[]>([]);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    const log: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      message,
    };
    onLog?.(log);
  }, [onLog]);

  const analyzeAllPairs = useCallback(async (): Promise<MultiPairAnalysisResult | null> => {
    if (Object.keys(marketData).length === 0) {
      addLog('WARN', 'Sem dados de mercado disponíveis para análise');
      return null;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Você precisa estar logado para usar o bot autônomo');
      }

      addLog('AI', `🔍 Analisando ${Object.keys(marketData).length} pares...`);

      // Prepare market data for the API
      const preparedData: Record<string, any> = {};
      Object.entries(marketData).forEach(([symbol, data]) => {
        if (data.price > 0) {
          preparedData[symbol] = {
            symbol: data.symbol,
            price: data.price,
            change24h: data.changePercentage24h || 0,
            volume24h: data.volume24h || 0,
            high24h: data.high24h || data.price,
            low24h: data.low24h || data.price,
            changePercentage24h: data.changePercentage24h || 0,
          };
        }
      });

      const { data, error: fnError } = await supabase.functions.invoke('multi-pair-analysis', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          marketData: preparedData,
          maxResults: 5,
        },
      });

      if (fnError) throw fnError;

      if (data?.success) {
        setLastAnalysis(data);
        setOpportunities(data.bestOpportunities || []);
        
        const numOpps = data.bestOpportunities?.length || 0;
        addLog('AI', `✅ Análise concluída: ${numOpps} oportunidades encontradas`);
        
        if (data.topPick) {
          addLog('AI', `🎯 Melhor oportunidade: ${data.topPick.symbol} - ${data.topPick.action} (${data.topPick.urgency})`);
        }

        if (data.marketOverview) {
          addLog('INFO', `📊 ${data.marketOverview}`);
        }

        return data;
      } else {
        throw new Error(data?.error || 'Resposta inválida do serviço');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao analisar mercado';
      setError(message);
      addLog('ERROR', `❌ ${message}`);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [marketData, addLog]);

  const executeOpportunity = useCallback(async (opportunity: BotOpportunity) => {
    if (openTrades.length >= maxConcurrentTrades) {
      addLog('WARN', `Limite de ${maxConcurrentTrades} trades simultâneos atingido`);
      return null;
    }

    if (opportunity.confidence < minConfidence) {
      addLog('INFO', `${opportunity.symbol}: Confiança ${opportunity.confidence}% abaixo do mínimo (${minConfidence}%)`);
      return null;
    }

    const side: Trade['side'] = opportunity.recommendation === 'BUY' ? 'LONG' : 'SHORT';
    
    const trade: Trade = {
      id: crypto.randomUUID(),
      symbol: opportunity.symbol,
      side,
      strategy: 'AI_AUTO',
      entryPrice: opportunity.entryPrice,
      quantity: 0.1, // Default quantity - should be calculated based on risk
      leverage: 5,
    stopLoss: opportunity.stopLoss,
    takeProfit: opportunity.takeProfit,
    status: 'OPEN',
      openedAt: new Date(),
      aiConfidence: opportunity.confidence,
      aiReasoning: opportunity.reasoning,
    };

    setOpenTrades(prev => [...prev, trade]);
    onTradeOpened?.(trade);

    const decision: AIDecision = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      symbol: opportunity.symbol,
      action: opportunity.recommendation,
      confidence: opportunity.confidence,
      reasoning: opportunity.reasoning,
      indicators: {
        institutionalFlow: 0,
        volumeCluster: opportunity.score > 75,
        trendStrength: opportunity.score,
        riskScore: 100 - opportunity.confidence,
      },
    };

    onDecisionMade?.(decision);
    
    addLog('TRADE', `🚀 ${side} ${opportunity.symbol} @ $${opportunity.entryPrice.toLocaleString()} | SL: $${opportunity.stopLoss.toLocaleString()} | TP: $${opportunity.takeProfit.toLocaleString()}`);
    toast.success(`Trade aberto: ${side} ${opportunity.symbol}`);

    return trade;
  }, [openTrades.length, maxConcurrentTrades, minConfidence, onTradeOpened, onDecisionMade, addLog]);

  const runAnalysisCycle = useCallback(async () => {
    if (!isRunningRef.current) return;

    const analysis = await analyzeAllPairs();
    
    if (analysis?.topPick && analysis.bestOpportunities?.length > 0) {
      // Find the top opportunity
      const topOpp = analysis.bestOpportunities.find(
        o => o.symbol === analysis.topPick?.symbol
      );
      
      if (topOpp && topOpp.confidence >= minConfidence && topOpp.score >= 70) {
        // Auto-execute if conditions are met
        if (topOpp.recommendation === 'BUY' || topOpp.recommendation === 'SELL') {
          await executeOpportunity(topOpp);
        }
      }
    }
  }, [analyzeAllPairs, executeOpportunity, minConfidence]);

  const start = useCallback(() => {
    if (isRunning) return;
    
    setIsRunning(true);
    isRunningRef.current = true;
    setError(null);
    
    addLog('INFO', '🤖 Bot autônomo iniciado - analisando todos os pares');
    toast.success('Bot autônomo iniciado');

    // Run immediately
    runAnalysisCycle();

    // Set up interval
    intervalRef.current = setInterval(runAnalysisCycle, intervalMs);
  }, [isRunning, intervalMs, runAnalysisCycle, addLog]);

  const stop = useCallback(() => {
    if (!isRunning) return;

    setIsRunning(false);
    isRunningRef.current = false;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    addLog('INFO', '🛑 Bot autônomo parado');
    toast.info('Bot autônomo parado');
  }, [isRunning, addLog]);

  const toggle = useCallback(() => {
    if (isRunning) {
      stop();
    } else {
      start();
    }
  }, [isRunning, start, stop]);

  const analyzeNow = useCallback(async () => {
    const result = await analyzeAllPairs();
    if (result?.success) {
      toast.success(`Análise concluída: ${result.bestOpportunities?.length || 0} oportunidades`);
    }
    return result;
  }, [analyzeAllPairs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isRunning,
    isAnalyzing,
    lastAnalysis,
    opportunities,
    openTrades,
    error,
    start,
    stop,
    toggle,
    analyzeNow,
    executeOpportunity,
  };
};
