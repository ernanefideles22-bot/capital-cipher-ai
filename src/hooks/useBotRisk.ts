import { useCallback } from 'react';
import type { LogEntry } from '@/types/trading';
import type { BotOpportunity } from './useLocalTechnicalAnalysis';

export interface TradingRules {
  maxDrawdownPercent: number;
  maxDailyLossPercent: number;
  maxConcurrentTrades: number;
  minConfidence: number;
  minScore: number;
  riskPerTradePercent: number;
  cooldownBetweenTradesMs: number;
  lossCooldownMs: number;
  maxOrdersPerMinute: number;
  maxCapitalPercentPerTrade: number;
  capitalAllocationMode: 'equal' | 'weighted' | 'tiered';
  reserveCapitalPercent: number;
}

interface UseBotRiskOptions {
  accountBalance: number;
  currentDrawdown: number;
  dailyPnL: number;
  rules: TradingRules;
  lastTradeTime: number;
  currentOpenTrades: Array<{ symbol: string; status?: string }>;
  closedTrades: any[] | undefined;
  orderTimestampsRef: React.MutableRefObject<number[]>;
  addLog: (level: LogEntry['level'], message: string) => void;
}

export function useBotRisk({
  accountBalance,
  currentDrawdown,
  dailyPnL,
  rules,
  lastTradeTime,
  currentOpenTrades,
  closedTrades,
  orderTimestampsRef,
  addLog,
}: UseBotRiskOptions) {
  
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
    if (currentOpenTrades.length >= rules.maxConcurrentTrades) {
      return { allowed: false, reason: `Limite de ${rules.maxConcurrentTrades} trades simultâneos` };
    }

    // Check cooldown between trades
    const timeSinceLastTrade = Date.now() - lastTradeTime;
    if (timeSinceLastTrade < rules.cooldownBetweenTradesMs) {
      const remaining = Math.ceil((rules.cooldownBetweenTradesMs - timeSinceLastTrade) / 1000);
      return { allowed: false, reason: `Aguardando cooldown (${remaining}s)` };
    }

    // Check rate limit: max 5 orders per minute
    const now = Date.now();
    orderTimestampsRef.current = orderTimestampsRef.current.filter(t => now - t < 60000);
    if (orderTimestampsRef.current.length >= 5) {
      return { allowed: false, reason: `Limite de 5 ordens por minuto atingido (Rate Limit)` };
    }

    // Check loss cooldown: pause for 5 minutes if last trade was a loss
    if (closedTrades && closedTrades.length > 0) {
      const lastClosed = closedTrades.find(t => t.status === 'CLOSED');
      if (lastClosed && lastClosed.pnl !== undefined && lastClosed.pnl < 0 && lastClosed.closedAt) {
        const closedTime = new Date(lastClosed.closedAt).getTime();
        const timeSinceLoss = now - closedTime;
        const cooldownMs = rules.lossCooldownMs;
        if (timeSinceLoss < cooldownMs) {
          const remaining = Math.ceil((cooldownMs - timeSinceLoss) / 1000);
          return { allowed: false, reason: `Bloqueio pós-prejuízo ativo (Aguarde ${remaining}s)` };
        }
      }
    }

    return { allowed: true };
  }, [currentDrawdown, dailyPnL, accountBalance, currentOpenTrades.length, lastTradeTime, rules, closedTrades, orderTimestampsRef]);

  const getAvailableCapital = useCallback((): number => {
    // We can compute allocated capital on-the-fly or pass it, but since we allocate dynamically:
    // Let's compute based on currentOpenTrades. In useAutonomousBot it tracks allocated capital,
    // but here we can calculate a safety estimate or receive allocated capital.
    // Let's just use it as part of calculateCapitalAllocation.
    return 0; // Will be overridden or computed in allocation function
  }, []);

  const calculateCapitalAllocation = useCallback((
    opportunities: BotOpportunity[],
    allocatedCapital: number
  ): Map<string, number> => {
    const allocation = new Map<string, number>();
    if (opportunities.length === 0) return allocation;

    // Available capital calculation helper
    const totalCapital = accountBalance;
    const reserveAmount = (totalCapital * rules.reserveCapitalPercent) / 100;
    const availableForTrading = totalCapital - reserveAmount - allocatedCapital;
    const availableCapital = Math.max(0, availableForTrading);

    const maxPerTrade = (accountBalance * rules.maxCapitalPercentPerTrade) / 100;

    addLog('AI', `💰 Capital disponível: $${availableCapital.toFixed(2)} | Max por trade: $${maxPerTrade.toFixed(2)}`);

    if (availableCapital <= 0) {
      addLog('WARN', '⚠️ Sem capital disponível para novas posições');
      return allocation;
    }

    const rankedOpps = [...opportunities]
      .filter(o => o.recommendation === 'BUY' || o.recommendation === 'SELL')
      .sort((a, b) => (b.confidence * b.score) - (a.confidence * a.score));

    if (rules.capitalAllocationMode === 'equal') {
      const maxTrades = Math.min(rankedOpps.length, rules.maxConcurrentTrades - currentOpenTrades.length);
      if (maxTrades <= 0) return allocation;
      const capitalPerTrade = Math.min(availableCapital / maxTrades, maxPerTrade);
      
      for (let i = 0; i < maxTrades; i++) {
        allocation.set(rankedOpps[i].symbol, capitalPerTrade);
      }
    } else if (rules.capitalAllocationMode === 'weighted') {
      const maxTrades = Math.min(rankedOpps.length, rules.maxConcurrentTrades - currentOpenTrades.length);
      const topOpps = rankedOpps.slice(0, maxTrades);
      if (topOpps.length === 0) return allocation;
      
      const totalWeight = topOpps.reduce((sum, o) => sum + (o.confidence * o.score) / 100, 0);
      if (totalWeight <= 0) return allocation;
      
      for (const opp of topOpps) {
        const weight = (opp.confidence * opp.score) / 100;
        const proportion = weight / totalWeight;
        const capitalForTrade = Math.min(availableCapital * proportion, maxPerTrade);
        allocation.set(opp.symbol, capitalForTrade);
      }
    } else if (rules.capitalAllocationMode === 'tiered') {
      const tiers = [0.40, 0.30, 0.20, 0.10];
      const maxTrades = Math.min(rankedOpps.length, rules.maxConcurrentTrades - currentOpenTrades.length);
      
      let remainingCapital = availableCapital;
      for (let i = 0; i < maxTrades && remainingCapital > 0; i++) {
        const tierPercent = tiers[Math.min(i, tiers.length - 1)];
        const capitalForTrade = Math.min(availableCapital * tierPercent, maxPerTrade, remainingCapital);
        allocation.set(rankedOpps[i].symbol, capitalForTrade);
        remainingCapital -= capitalForTrade;
      }
    }

    allocation.forEach((capital, symbol) => {
      const opp = rankedOpps.find(o => o.symbol === symbol);
      addLog('INFO', `📊 ${symbol}: $${capital.toFixed(2)} (${((capital / accountBalance) * 100).toFixed(1)}%) | Conf: ${opp?.confidence}%`);
    });

    return allocation;
  }, [accountBalance, rules, currentOpenTrades.length, addLog]);

  return { canTrade, calculateCapitalAllocation };
}
