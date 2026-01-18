import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MarketData, Trade, AIDecision, LogEntry } from '@/types/trading';
import { useBybitAPI } from '@/hooks/useBybitAPI';

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
  neuralAdjusted?: boolean;
  originalScore?: number;
  originalConfidence?: number;
  suggestedStrategy?: 'SCALP' | 'DAYTRADE' | 'SWING';
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
  // Neural network info
  neuralEnabled?: boolean;
  neuralEpochs?: number;
  neuralAccuracy?: number;
  neuralBonuses?: string[];
  neuralInsights?: string;
}

interface TradingRules {
  maxDrawdownPercent: number;
  maxDailyLossPercent: number;
  maxConcurrentTrades: number;
  minConfidence: number;
  minScore: number;
  riskPerTradePercent: number;
  cooldownBetweenTradesMs: number;
  // Capital allocation settings
  maxCapitalPercentPerTrade: number; // Max % of capital for a single trade
  capitalAllocationMode: 'equal' | 'weighted' | 'tiered'; // How to distribute capital
  reserveCapitalPercent: number; // % of capital to keep as reserve
}

interface UseAutonomousBotOptions {
  marketData: Record<string, MarketData>;
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
  sendRealOrders?: boolean; // NEW: Enable real Bybit order execution
  leverage?: number; // Leverage for real orders
}

const DEFAULT_RULES: TradingRules = {
  maxDrawdownPercent: 10,
  maxDailyLossPercent: 5,
  maxConcurrentTrades: 5,
  minConfidence: 70,
  minScore: 65,
  riskPerTradePercent: 2,
  cooldownBetweenTradesMs: 10000, // 10 seconds between trades
  // Capital allocation
  maxCapitalPercentPerTrade: 25, // Max 25% per trade
  capitalAllocationMode: 'weighted', // Distribute based on confidence
  reserveCapitalPercent: 20, // Keep 20% as reserve
};

export const useAutonomousBot = ({
  marketData,
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

  // Bybit API hook for real order execution
  const bybitAPI = useBybitAPI();

  // Check if trading is allowed based on rules
  const canTrade = useCallback((): { allowed: boolean; reason?: string } => {
    // Check drawdown limit
    if (currentDrawdown >= rules.maxDrawdownPercent) {
      return { allowed: false, reason: `Drawdown máximo atingido (${currentDrawdown.toFixed(1)}% >= ${rules.maxDrawdownPercent}%)` };
    }

    // Check daily loss limit
    const dailyLossPercent = accountBalance > 0 ? (Math.abs(Math.min(0, dailyPnL)) / accountBalance) * 100 : 0;
    if (dailyLossPercent >= rules.maxDailyLossPercent) {
      return { allowed: false, reason: `Perda diária máxima atingida (${dailyLossPercent.toFixed(1)}% >= ${rules.maxDailyLossPercent}%)` };
    }

    // Check max concurrent trades
    if (openTrades.length >= rules.maxConcurrentTrades) {
      return { allowed: false, reason: `Limite de ${rules.maxConcurrentTrades} trades simultâneos` };
    }

    // Check cooldown between trades
    const timeSinceLastTrade = Date.now() - lastTradeTime;
    if (timeSinceLastTrade < rules.cooldownBetweenTradesMs) {
      const remaining = Math.ceil((rules.cooldownBetweenTradesMs - timeSinceLastTrade) / 1000);
      return { allowed: false, reason: `Aguardando cooldown (${remaining}s)` };
    }

    return { allowed: true };
  }, [currentDrawdown, dailyPnL, accountBalance, openTrades.length, lastTradeTime, rules]);

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    const log: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      message,
    };
    onLog?.(log);
  }, [onLog]);

  // Calculate available capital for new trades
  const getAvailableCapital = useCallback((): number => {
    const totalCapital = accountBalance;
    const reserveAmount = (totalCapital * rules.reserveCapitalPercent) / 100;
    const availableForTrading = totalCapital - reserveAmount - allocatedCapital;
    return Math.max(0, availableForTrading);
  }, [accountBalance, rules.reserveCapitalPercent, allocatedCapital]);

  // Calculate capital allocation for multiple opportunities based on confidence/score
  const calculateCapitalAllocation = useCallback((
    opportunities: BotOpportunity[]
  ): Map<string, number> => {
    const allocation = new Map<string, number>();
    if (opportunities.length === 0) return allocation;

    const availableCapital = getAvailableCapital();
    const maxPerTrade = (accountBalance * rules.maxCapitalPercentPerTrade) / 100;

    addLog('AI', `💰 Capital disponível: $${availableCapital.toFixed(2)} | Max por trade: $${maxPerTrade.toFixed(2)}`);

    if (availableCapital <= 0) {
      addLog('WARN', '⚠️ Sem capital disponível para novas posições');
      return allocation;
    }

    // Sort by confidence * score for priority ranking
    const rankedOpps = [...opportunities]
      .filter(o => o.recommendation === 'BUY' || o.recommendation === 'SELL')
      .sort((a, b) => (b.confidence * b.score) - (a.confidence * a.score));

    if (rules.capitalAllocationMode === 'equal') {
      // Equal distribution among all opportunities
      const maxTrades = Math.min(rankedOpps.length, rules.maxConcurrentTrades - openTrades.length);
      const capitalPerTrade = Math.min(availableCapital / maxTrades, maxPerTrade);
      
      for (let i = 0; i < maxTrades; i++) {
        allocation.set(rankedOpps[i].symbol, capitalPerTrade);
      }
    } else if (rules.capitalAllocationMode === 'weighted') {
      // Weighted distribution based on confidence
      const maxTrades = Math.min(rankedOpps.length, rules.maxConcurrentTrades - openTrades.length);
      const topOpps = rankedOpps.slice(0, maxTrades);
      
      const totalWeight = topOpps.reduce((sum, o) => sum + (o.confidence * o.score) / 100, 0);
      
      for (const opp of topOpps) {
        const weight = (opp.confidence * opp.score) / 100;
        const proportion = weight / totalWeight;
        const capitalForTrade = Math.min(availableCapital * proportion, maxPerTrade);
        allocation.set(opp.symbol, capitalForTrade);
      }
    } else if (rules.capitalAllocationMode === 'tiered') {
      // Tiered: Top pick gets 40%, 2nd gets 30%, 3rd gets 20%, rest 10% each
      const tiers = [0.40, 0.30, 0.20, 0.10];
      const maxTrades = Math.min(rankedOpps.length, rules.maxConcurrentTrades - openTrades.length);
      
      let remainingCapital = availableCapital;
      for (let i = 0; i < maxTrades && remainingCapital > 0; i++) {
        const tierPercent = tiers[Math.min(i, tiers.length - 1)];
        const capitalForTrade = Math.min(availableCapital * tierPercent, maxPerTrade, remainingCapital);
        allocation.set(rankedOpps[i].symbol, capitalForTrade);
        remainingCapital -= capitalForTrade;
      }
    }

    // Log allocation summary
    allocation.forEach((capital, symbol) => {
      const opp = rankedOpps.find(o => o.symbol === symbol);
      addLog('INFO', `📊 ${symbol}: $${capital.toFixed(2)} (${((capital / accountBalance) * 100).toFixed(1)}%) | Conf: ${opp?.confidence}%`);
    });

    return allocation;
  }, [getAvailableCapital, accountBalance, rules, openTrades.length, addLog]);

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

  const executeOpportunity = useCallback(async (opportunity: BotOpportunity, allocatedCapitalForTrade?: number) => {
    // Check all trading rules first
    const tradingCheck = canTrade();
    if (!tradingCheck.allowed) {
      addLog('WARN', `⚠️ Trade bloqueado: ${tradingCheck.reason}`);
      return null;
    }

    // Check minimum confidence
    if (opportunity.confidence < rules.minConfidence) {
      addLog('INFO', `${opportunity.symbol}: Confiança ${opportunity.confidence}% abaixo do mínimo (${rules.minConfidence}%)`);
      return null;
    }

    // Check minimum score
    if (opportunity.score < rules.minScore) {
      addLog('INFO', `${opportunity.symbol}: Score ${opportunity.score} abaixo do mínimo (${rules.minScore})`);
      return null;
    }

    // Only execute BUY or SELL signals
    if (opportunity.recommendation !== 'BUY' && opportunity.recommendation !== 'SELL') {
      return null;
    }

    // Check if we already have an open trade for this symbol
    const existingTrade = openTrades.find(t => t.symbol === opportunity.symbol && t.status === 'OPEN');
    if (existingTrade) {
      addLog('INFO', `${opportunity.symbol}: Já existe trade aberto para este par`);
      return null;
    }

    const side: Trade['side'] = opportunity.recommendation === 'BUY' ? 'LONG' : 'SHORT';
    const bybitSide: 'Buy' | 'Sell' = opportunity.recommendation === 'BUY' ? 'Buy' : 'Sell';
    const isLong = bybitSide === 'Buy';

    // Calculate position size based on allocated capital OR risk management
    let capitalToUse: number;
    if (allocatedCapitalForTrade && allocatedCapitalForTrade > 0) {
      // Use fractioned capital allocation
      capitalToUse = allocatedCapitalForTrade;
      addLog('AI', `💰 ${opportunity.symbol}: Usando capital fracionado de $${capitalToUse.toFixed(2)}`);
    } else {
      // Fallback to risk-based calculation
      capitalToUse = (accountBalance * rules.riskPerTradePercent) / 100;
    }

    const stopDistance = Math.abs(opportunity.entryPrice - opportunity.stopLoss);
    
    // Calculate quantity based on capital and price
    let quantity = opportunity.entryPrice > 0 ? capitalToUse / opportunity.entryPrice : 0;

    // Bybit typically enforces a minimum notional (ex: 5 USDT)
    const minNotionalUSDT = 5;
    const minQtyForNotional = opportunity.entryPrice > 0 ? minNotionalUSDT / opportunity.entryPrice : 0;

    if (quantity < minQtyForNotional) {
      const valueAtMinQty = minQtyForNotional * opportunity.entryPrice;
      if (valueAtMinQty > capitalToUse * 1.5) {
        // Allow some flexibility but not too much
        addLog('WARN', `⚠️ ${opportunity.symbol}: Capital insuficiente ($${capitalToUse.toFixed(2)}) para mínimo de ${minNotionalUSDT} USDT`);
        return null;
      }
      quantity = minQtyForNotional;
    }

    // Avoid scientific notation and overly long floats
    quantity = parseFloat(quantity.toFixed(6));

    // Validate TP/SL direction (avoid Bybit rejection). If invalid, omit the field.
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

    // If sendRealOrders is enabled, execute real order on Bybit
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

    // Track allocated capital
    const tradeValue = quantity * opportunity.entryPrice;
    setAllocatedCapital(prev => prev + tradeValue);
    
    setOpenTrades(prev => [...prev, trade]);
    setLastTradeTime(Date.now());
    setTradesToday(prev => prev + 1);
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
  }, [canTrade, rules, openTrades, accountBalance, onTradeOpened, onDecisionMade, addLog, sendRealOrders, leverage, bybitAPI]);

  const runAnalysisCycle = useCallback(async () => {
    if (!isRunningRef.current) return;

    // Check if trading is allowed before analyzing
    const tradingCheck = canTrade();
    if (!tradingCheck.allowed) {
      addLog('WARN', `⚠️ Ciclo pausado: ${tradingCheck.reason}`);
      return;
    }

    const analysis = await analyzeAllPairs();
    
    if (analysis?.bestOpportunities?.length > 0) {
      // Filter valid opportunities
      const validOpportunities = analysis.bestOpportunities
        .filter(o => 
          o.confidence >= rules.minConfidence && 
          o.score >= rules.minScore &&
          (o.recommendation === 'BUY' || o.recommendation === 'SELL')
        )
        .sort((a, b) => (b.confidence * b.score) - (a.confidence * a.score)); // Sort by combined metric

      addLog('AI', `📈 ${validOpportunities.length} oportunidades válidas (conf >= ${rules.minConfidence}%)`);

      if (validOpportunities.length === 0) return;

      // Calculate intelligent capital allocation across opportunities
      addLog('AI', `🎯 Fracionando capital entre ${validOpportunities.length} melhores entradas...`);
      const capitalAllocation = calculateCapitalAllocation(validOpportunities);

      // Execute trades with allocated capital
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

        const trade = await executeOpportunity(opp, allocatedAmount);
        if (trade) {
          tradesExecuted++;
        }
        
        // Small delay between executions to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (tradesExecuted > 0) {
        addLog('SUCCESS', `✅ ${tradesExecuted} trades executados com capital fracionado`);
      }
    }
  }, [analyzeAllPairs, executeOpportunity, canTrade, rules, addLog, calculateCapitalAllocation]);

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

    // Run immediately
    runAnalysisCycle();

    // Set up interval
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
    allocatedCapital,
    availableCapital: getAvailableCapital(),
    start,
    stop,
    toggle,
    analyzeNow,
    executeOpportunity,
    calculateCapitalAllocation,
  };
};
