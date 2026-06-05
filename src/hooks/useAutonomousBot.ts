import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MarketData, Trade, AIDecision, LogEntry } from '@/types/trading';
import { useBybitAPI } from '@/hooks/useBybitAPI';
import {
  useLocalTechnicalAnalysis,
  type BotOpportunity,
  type MultiPairAnalysisResult,
  type TechnicalIndicatorsPayload
} from '@/hooks/useLocalTechnicalAnalysis';
import { useBotRisk, type TradingRules } from '@/hooks/useBotRisk';
import { useBotLogs } from '@/hooks/useBotLogs';

export interface UseAutonomousBotOptions {
  marketData: Record<string, MarketData>;
  technicalIndicators?: Record<string, TechnicalIndicatorsPayload>;
  onTradeOpened?: (trade: Trade) => void;
  onDecisionMade?: (decision: AIDecision) => void;
  onLog?: (log: LogEntry) => void;
  intervalMs?: number;
  minConfidence?: number;
  maxConcurrentTrades?: number;
  currentDrawdown?: number;
  dailyPnL?: number;
  accountBalance?: number;
  tradingRules?: Partial<TradingRules>;
  sendRealOrders?: boolean;
  leverage?: number;
  activeTrades?: Array<{ symbol: string; status?: string }>;
  closedTrades?: Trade[];
}

const DEFAULT_RULES: TradingRules = {
  maxDrawdownPercent: 10,
  maxDailyLossPercent: 5,
  maxConcurrentTrades: 5,
  minConfidence: 70,
  minScore: 65,
  riskPerTradePercent: 2,
  cooldownBetweenTradesMs: 10000, // 10 seconds between trades
  lossCooldownMs: 5 * 60 * 1000, // 5 minutes cooldown after loss
  maxOrdersPerMinute: 5, // max 5 orders per minute
  // Capital allocation
  maxCapitalPercentPerTrade: 25, // Max 25% per trade
  capitalAllocationMode: 'weighted', // Distribute based on confidence
  reserveCapitalPercent: 20, // Keep 20% as reserve
};

export const useAutonomousBot = ({
  marketData,
  technicalIndicators,
  onTradeOpened,
  onDecisionMade,
  onLog,
  intervalMs = 60000,
  minConfidence = 70,
  maxConcurrentTrades = 3,
  currentDrawdown = 0,
  dailyPnL = 0,
  accountBalance = 10000,
  tradingRules = {},
  sendRealOrders = false,
  leverage = 5,
  activeTrades,
  closedTrades,
}: UseAutonomousBotOptions) => {
  const rules: TradingRules = { ...DEFAULT_RULES, ...tradingRules, minConfidence, maxConcurrentTrades };
  const [isRunning, setIsRunning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<MultiPairAnalysisResult | null>(null);
  const [opportunities, setOpportunities] = useState<BotOpportunity[]>([]);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastTradeTime, setLastTradeTime] = useState<number>(0);
  const [tradesToday, setTradesToday] = useState<number>(0);
  const [allocatedCapital, setAllocatedCapital] = useState<number>(0); // Track capital in use
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);
  
  // Rate limiting tracker (timestamps of trades placed in the last 60 seconds)
  const orderTimestampsRef = useRef<number[]>([]);

  // Bybit API hook for real order execution
  const bybitAPI = useBybitAPI();

  const currentOpenTrades = activeTrades || openTrades;

  const { writeLog } = useBotLogs();

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    const log: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      message,
    };
    onLog?.(log);
    
    // Persist bot logs to Supabase in background
    writeLog(level, message);
  }, [onLog, writeLog]);

  // Instantiate Sub-Hooks
  const { performLocalAnalysis } = useLocalTechnicalAnalysis();
  const { canTrade, calculateCapitalAllocation } = useBotRisk({
    accountBalance,
    currentDrawdown,
    dailyPnL,
    rules,
    lastTradeTime,
    currentOpenTrades,
    closedTrades,
    orderTimestampsRef,
    addLog,
  });

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
            change24h: data.change24h || 0,
            volume24h: data.volume24h || 0,
            high24h: data.high24h || data.price,
            low24h: data.low24h || data.price,
            changePercentage24h: data.changePercentage24h || 0,
          };
        }
      });

      // Prepare technical indicators for API
      const indicatorsData: Record<string, any> = {};
      if (technicalIndicators) {
        Object.entries(technicalIndicators).forEach(([symbol, ind]) => {
          indicatorsData[symbol] = {
            rsi: ind.rsi,
            rsiSignal: ind.rsiSignal,
            macd: ind.macd,
            macdSignal: ind.macdSignal,
            macdHistogram: ind.macdHistogram,
            macdTrend: ind.macdTrend,
            bollingerUpper: ind.bollingerUpper,
            bollingerMiddle: ind.bollingerMiddle,
            bollingerLower: ind.bollingerLower,
            bollingerPosition: ind.bollingerPosition,
            bollingerWidth: ind.bollingerWidth,
            ema9: ind.ema9,
            ema21: ind.ema21,
            ema50: ind.ema50,
            emaTrend: ind.emaTrend,
            volumeRatio: ind.volumeRatio,
            volumeSignal: ind.volumeSignal,
            atr: ind.atr,
            atrPercent: ind.atrPercent,
            momentum: ind.momentum,
            momentumSignal: ind.momentumSignal,
            nearestSupport: ind.nearestSupport,
            nearestResistance: ind.nearestResistance,
            overallSignal: ind.overallSignal,
            signalStrength: ind.signalStrength,
          };
        });
      }

      let data: any = null;
      let fnError: any = null;
      let useLocalFallback = false;

      try {
        const result = await supabase.functions.invoke('multi-pair-analysis', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: {
            marketData: preparedData,
            technicalIndicators: indicatorsData,
            maxResults: 5,
          },
        });
        data = result.data;
        fnError = result.error;
      } catch (invokeError: any) {
        fnError = invokeError;
        useLocalFallback = true;
      }

      const isCreditsError = 
        useLocalFallback ||
        fnError?.message?.includes('402') ||
        fnError?.message?.includes('401') ||
        fnError?.message?.includes('credits') ||
        fnError?.status === 402 ||
        fnError?.status === 401 ||
        data?.error?.includes('credits') ||
        data?.error?.includes('exhausted') ||
        data?.error?.includes('AI credits');

      if (fnError || isCreditsError) {
        addLog('WARN', '⚠️ API indisponível - usando análise técnica local');
        const localResult = performLocalAnalysis(marketData, technicalIndicators, addLog);
        setLastAnalysis(localResult);
        setOpportunities(localResult.bestOpportunities || []);
        return localResult;
      }

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
        addLog('WARN', '⚠️ Erro na API - usando análise técnica local');
        const localResult = performLocalAnalysis(marketData, technicalIndicators, addLog);
        setLastAnalysis(localResult);
        setOpportunities(localResult.bestOpportunities || []);
        return localResult;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao analisar mercado';
      addLog('WARN', `⚠️ ${message} - usando análise técnica local`);
      
      const localResult = performLocalAnalysis(marketData, technicalIndicators, addLog);
      setLastAnalysis(localResult);
      setOpportunities(localResult.bestOpportunities || []);
      setError(null);
      return localResult;
    } finally {
      setIsAnalyzing(false);
    }
  }, [marketData, technicalIndicators, addLog, performLocalAnalysis]);

  const executeOpportunity = useCallback(async (opportunity: BotOpportunity, allocatedCapitalForTrade?: number) => {
    const tradingCheck = canTrade();
    if (!tradingCheck.allowed) {
      addLog('WARN', `⚠️ Trade bloqueado: ${tradingCheck.reason}`);
      return null;
    }

    if (opportunity.confidence < rules.minConfidence) {
      addLog('INFO', `${opportunity.symbol}: Confiança ${opportunity.confidence}% abaixo do mínimo (${rules.minConfidence}%)`);
      return null;
    }

    if (opportunity.score < rules.minScore) {
      addLog('INFO', `${opportunity.symbol}: Score ${opportunity.score} abaixo do mínimo (${rules.minScore})`);
      return null;
    }

    if (opportunity.recommendation !== 'BUY' && opportunity.recommendation !== 'SELL') {
      return null;
    }

    const existingTrade = currentOpenTrades.find(t => t.symbol === opportunity.symbol && t.status === 'OPEN');
    if (existingTrade) {
      addLog('INFO', `${opportunity.symbol}: Já existe trade aberto para este par`);
      return null;
    }

    const side: Trade['side'] = opportunity.recommendation === 'BUY' ? 'LONG' : 'SHORT';
    const bybitSide: 'Buy' | 'Sell' = opportunity.recommendation === 'BUY' ? 'Buy' : 'Sell';
    const isLong = bybitSide === 'Buy';

    let capitalToUse: number;
    if (allocatedCapitalForTrade && allocatedCapitalForTrade > 0) {
      capitalToUse = allocatedCapitalForTrade;
      addLog('AI', `💰 ${opportunity.symbol}: Usando capital fracionado de $${capitalToUse.toFixed(2)}`);
    } else {
      capitalToUse = (accountBalance * rules.riskPerTradePercent) / 100;
    }

    let quantity = opportunity.entryPrice > 0 ? capitalToUse / opportunity.entryPrice : 0;

    const minQtyBySymbol: Record<string, number> = {
      'BTCUSDT': 0.001,
      'ETHUSDT': 0.01,
      'BNBUSDT': 0.01,
      'SOLUSDT': 0.1,
      'XRPUSDT': 1,
      'ADAUSDT': 1,
      'DOGEUSDT': 1,
      'DOTUSDT': 0.1,
      'MATICUSDT': 1,
      'LINKUSDT': 0.1,
      'AVAXUSDT': 0.1,
    };
    
    const minQtyForSymbol = minQtyBySymbol[opportunity.symbol] || 0.001;
    const minNotionalUSDT = 5;
    const minQtyForNotional = opportunity.entryPrice > 0 ? minNotionalUSDT / opportunity.entryPrice : 0;
    const effectiveMinQty = Math.max(minQtyForSymbol, minQtyForNotional);

    if (quantity < effectiveMinQty) {
      const valueAtMinQty = effectiveMinQty * opportunity.entryPrice;
      if (valueAtMinQty > capitalToUse * 2) {
        addLog('WARN', `⚠️ ${opportunity.symbol}: Capital insuficiente ($${capitalToUse.toFixed(2)}) para mínimo de ${effectiveMinQty} contratos (~$${valueAtMinQty.toFixed(2)})`);
        return null;
      }
      quantity = effectiveMinQty;
      addLog('INFO', `${opportunity.symbol}: Ajustando para quantidade mínima ${effectiveMinQty}`);
    }

    const qtyDecimals = opportunity.symbol === 'BTCUSDT' ? 3 : 
                        ['ETHUSDT', 'BNBUSDT'].includes(opportunity.symbol) ? 2 : 1;
    quantity = parseFloat(quantity.toFixed(qtyDecimals));

    const slValid = isLong ? opportunity.stopLoss < opportunity.entryPrice : opportunity.stopLoss > opportunity.entryPrice;
    const tpValid = isLong ? opportunity.takeProfit > opportunity.entryPrice : opportunity.takeProfit < opportunity.entryPrice;

    const orderOptions: {
      orderType: 'Market';
      takeProfit?: number;
      stopLoss?: number;
    } = {
      orderType: 'Market',
      ...(slValid ? { stopLoss: opportunity.stopLoss } : {}),
      ...(tpValid ? { takeProfit: opportunity.takeProfit } : {}),
    };

    if (!slValid) addLog('WARN', `⚠️ ${opportunity.symbol}: StopLoss inválido para ${isLong ? 'LONG' : 'SHORT'}; enviando ordem sem SL`);
    if (!tpValid) addLog('WARN', `⚠️ ${opportunity.symbol}: TakeProfit inválido para ${isLong ? 'LONG' : 'SHORT'}; enviando ordem sem TP`);

    let bybitOrderId: string | null = null;
    if (sendRealOrders) {
      addLog('AI', `📤 Enviando ordem real para Bybit: ${bybitSide} ${opportunity.symbol} (qty=${quantity})`);

      try {
        const levRes = await bybitAPI.setLeverage(opportunity.symbol, leverage);
        if (levRes?.retCode !== 0) {
          addLog('WARN', `⚠️ Falha ao setar alavancagem (${levRes?.retCode}): ${levRes?.retMsg || 'sem mensagem'}`);
        }

        const orderResult = await bybitAPI.placeOrder(opportunity.symbol, bybitSide, quantity, orderOptions);

        if (orderResult && orderResult.retCode === 0) {
          bybitOrderId = orderResult.result?.orderId;
          addLog('SUCCESS', `✅ Ordem Bybit executada! ID: ${bybitOrderId || 'N/A'}`);
          toast.success(`Ordem real executada: ${bybitSide} ${opportunity.symbol}`);
        } else {
          const errMsg = orderResult?.retMsg || (orderResult as any)?.error || bybitAPI.error || 'Erro desconhecido';
          const errCode = orderResult?.retCode ?? -1;
          addLog('ERROR', `❌ Erro ao executar ordem Bybit (${errCode}): ${errMsg}`);
          toast.error(`Erro ao executar ordem: ${errMsg}`);
          return null;
        }
      } catch (err: any) {
        const msg = err?.message || 'Erro desconhecido';
        addLog('ERROR', `❌ Exceção ao enviar ordem: ${msg}`);
        toast.error(`Erro: ${msg}`);
        return null;
      }
    }
    
    const trade: Trade = {
      id: bybitOrderId || crypto.randomUUID(),
      symbol: opportunity.symbol,
      side,
      strategy: 'AI_AUTO',
      entryPrice: opportunity.entryPrice,
      quantity,
      leverage,
      stopLoss: opportunity.stopLoss,
      takeProfit: opportunity.takeProfit,
      status: 'OPEN',
      openedAt: new Date(),
      aiConfidence: opportunity.confidence,
      aiReasoning: opportunity.reasoning,
    };

    const tradeValue = quantity * opportunity.entryPrice;
    setAllocatedCapital(prev => prev + tradeValue);
    
    setOpenTrades(prev => [...prev, trade]);
    setLastTradeTime(Date.now());
    setTradesToday(prev => prev + 1);
    
    orderTimestampsRef.current.push(Date.now());
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
    
    const realTag = sendRealOrders ? ' [REAL]' : ' [PAPER]';
    addLog('TRADE', `🚀${realTag} ${side} ${opportunity.symbol} @ $${opportunity.entryPrice.toLocaleString()} | Conf: ${opportunity.confidence}% | R/R: 1:${opportunity.riskRewardRatio?.toFixed(1) || '?'}`);
    addLog('INFO', `📍 SL: $${opportunity.stopLoss.toLocaleString()} | TP: $${opportunity.takeProfit.toLocaleString()} | Qty: ${quantity.toFixed(4)}`);
    toast.success(`Trade executado: ${side} ${opportunity.symbol} (${opportunity.confidence}%)${sendRealOrders ? ' - ORDEM REAL' : ''}`);

    return trade;
  }, [canTrade, rules, currentOpenTrades, accountBalance, onTradeOpened, onDecisionMade, addLog, sendRealOrders, leverage, bybitAPI]);

  const runAnalysisCycle = useCallback(async () => {
    if (!isRunningRef.current) return;

    const tradingCheck = canTrade();
    if (!tradingCheck.allowed) {
      addLog('WARN', `⚠️ Ciclo pausado: ${tradingCheck.reason}`);
      return;
    }

    const analysis = await analyzeAllPairs();
    
    if (analysis?.bestOpportunities?.length > 0) {
      addLog('INFO', `📊 Analisando ${analysis.bestOpportunities.length} oportunidades encontradas...`);
      
      const rejectedOpps = analysis.bestOpportunities.filter(o => 
        o.confidence < rules.minConfidence || 
        o.score < rules.minScore ||
        (o.recommendation !== 'BUY' && o.recommendation !== 'SELL')
      );
      
      if (rejectedOpps.length > 0) {
        rejectedOpps.forEach(o => {
          const reasons: string[] = [];
          if (o.confidence < rules.minConfidence) reasons.push(`conf ${o.confidence}% < ${rules.minConfidence}%`);
          if (o.score < rules.minScore) reasons.push(`score ${o.score} < ${rules.minScore}`);
          if (o.recommendation !== 'BUY' && o.recommendation !== 'SELL') reasons.push(`sinal: ${o.recommendation}`);
          addLog('INFO', `⏸️ ${o.symbol}: ${reasons.join(' | ')}`);
        });
      }
      
      const validOpportunities = analysis.bestOpportunities
        .filter(o => 
          o.confidence >= rules.minConfidence && 
          o.score >= rules.minScore &&
          (o.recommendation === 'BUY' || o.recommendation === 'SELL')
        )
        .sort((a, b) => (b.confidence * b.score) - (a.confidence * a.score));

      addLog('AI', `📈 ${validOpportunities.length} oportunidades válidas (conf >= ${rules.minConfidence}%, score >= ${rules.minScore})`);

      if (validOpportunities.length === 0) {
        addLog('INFO', '💤 Aguardando sinais mais fortes para executar trades...');
        return;
      }

      addLog('AI', `🎯 Fracionando capital entre ${validOpportunities.length} melhores entradas...`);
      const capitalAllocation = calculateCapitalAllocation(validOpportunities, allocatedCapital);

      let tradesExecuted = 0;
      for (const opp of validOpportunities) {
        const stillCanTrade = canTrade();
        if (!stillCanTrade.allowed) {
          addLog('INFO', `Parando execução: ${stillCanTrade.reason}`);
          break;
        }

        const allocatedAmount = capitalAllocation.get(opp.symbol);
        if (!allocatedAmount || allocatedAmount <= 0) {
          addLog('INFO', `${opp.symbol}: Sem capital alocado, pulando`);
          continue;
        }

        addLog('TRADE', `🚀 Executando: ${opp.recommendation} ${opp.symbol} | Conf: ${opp.confidence}% | Score: ${opp.score}`);
        const trade = await executeOpportunity(opp, allocatedAmount);
        if (trade) {
          tradesExecuted++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (tradesExecuted > 0) {
        addLog('SUCCESS', `✅ ${tradesExecuted} trades executados com capital fracionado`);
      }
    } else {
      addLog('INFO', '🔍 Nenhuma oportunidade encontrada neste ciclo');
    }
  }, [analyzeAllPairs, executeOpportunity, canTrade, rules, addLog, calculateCapitalAllocation, allocatedCapital]);

  const start = useCallback(() => {
    if (isRunning) return;
    
    setIsRunning(true);
    isRunningRef.current = true;
    setError(null);
    setTradesToday(0);
    
    addLog('SUCCESS', '🤖 Bot autônomo ATIVADO');
    addLog('INFO', `📋 Regras: Conf >= ${rules.minConfidence}% | Max ${rules.maxConcurrentTrades} trades | Drawdown max ${rules.maxDrawdownPercent}%`);
    addLog('INFO', `💰 Alocação: ${rules.capitalAllocationMode} | Max ${rules.maxCapitalPercentPerTrade}% por trade | Reserva ${rules.reserveCapitalPercent}%`);
    toast.success('Bot autônomo ativado - executando trades automaticamente');

    runAnalysisCycle();
    intervalRef.current = setInterval(runAnalysisCycle, intervalMs);
  }, [isRunning, intervalMs, runAnalysisCycle, rules, addLog]);

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
    openTrades: currentOpenTrades,
    error,
    allocatedCapital,
    availableCapital: accountBalance - allocatedCapital, // Simple fallback calculation
    start,
    stop,
    toggle,
    analyzeNow,
    executeOpportunity,
    calculateCapitalAllocation,
  };
};
