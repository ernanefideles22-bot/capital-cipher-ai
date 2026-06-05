import { useCallback } from 'react';
import type { MarketData, LogEntry } from '@/types/trading';

export interface InstitutionalSignals {
  orderFlow: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  smartMoney: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  volumeProfile: 'ABOVE_POC' | 'BELOW_POC' | 'AT_POC';
  liquidityZone: 'NEAR_LIQUIDITY' | 'CLEAR';
}

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
  professionalStrategy?: 'MOMENTUM' | 'MEAN_REVERSION' | 'BREAKOUT' | 'INSTITUTIONAL_FLOW' | 'WYCKOFF' | 'SMART_MONEY';
  institutionalSignals?: InstitutionalSignals;
}

export interface InstitutionalBias {
  overall: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
  btcDominance: 'RISING' | 'FALLING' | 'STABLE';
  marketPhase: 'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION' | 'MARKDOWN';
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
  neuralEnabled?: boolean;
  neuralEpochs?: number;
  neuralAccuracy?: number;
  neuralBonuses?: string[];
  neuralInsights?: string;
  institutionalBias?: InstitutionalBias;
}

export interface TechnicalIndicatorsPayload {
  rsi: number;
  rsiSignal: string;
  stochRsiK?: number;
  stochRsiD?: number;
  stochRsiSignal?: string;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  macdTrend: string;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  bollingerPosition: string;
  bollingerWidth: number;
  ema9: number;
  ema21: number;
  ema50: number;
  emaTrend: string;
  adx?: number;
  plusDI?: number;
  minusDI?: number;
  adxTrend?: string;
  adxDirection?: string;
  ichimokuTenkan?: number;
  ichimokuKijun?: number;
  ichimokuSenkouA?: number;
  ichimokuSenkouB?: number;
  ichimokuChikou?: number;
  ichimokuSignal?: string;
  ichimokuCloudPosition?: string;
  volumeRatio: number;
  volumeSignal: string;
  atr: number;
  atrPercent: number;
  momentum: number;
  momentumSignal: string;
  nearestSupport: number;
  nearestResistance: number;
  overallSignal: string;
  signalStrength: number;
}

export function useLocalTechnicalAnalysis() {
  const performLocalAnalysis = useCallback((
    marketData: Record<string, MarketData>,
    technicalIndicators: Record<string, TechnicalIndicatorsPayload> | undefined,
    addLog: (level: LogEntry['level'], message: string) => void
  ): MultiPairAnalysisResult => {
    addLog('INFO', '🔧 Executando análise técnica avançada local (Stoch RSI, ADX, Ichimoku)...');
    
    const opportunities: BotOpportunity[] = [];
    
    Object.entries(marketData).forEach(([symbol, data]) => {
      const indicators = technicalIndicators?.[symbol];
      if (!indicators || data.price <= 0) return;
      
      let score = 50;
      let confidence = 50;
      let recommendation: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      const reasons: string[] = [];
      let bullishSignals = 0;
      let bearishSignals = 0;
      
      // === RSI Analysis ===
      if (indicators.rsi < 30) {
        score += 12;
        confidence += 8;
        bullishSignals++;
        reasons.push(`RSI oversold (${indicators.rsi.toFixed(1)})`);
      } else if (indicators.rsi > 70) {
        score += 12;
        confidence += 8;
        bearishSignals++;
        reasons.push(`RSI overbought (${indicators.rsi.toFixed(1)})`);
      }
      
      // === Stochastic RSI Analysis ===
      if (indicators.stochRsiSignal) {
        if (indicators.stochRsiSignal === 'OVERSOLD') {
          score += 10;
          confidence += 6;
          bullishSignals++;
          reasons.push(`Stoch RSI oversold (${indicators.stochRsiK?.toFixed(1)})`);
        } else if (indicators.stochRsiSignal === 'OVERBOUGHT') {
          score += 10;
          confidence += 6;
          bearishSignals++;
          reasons.push(`Stoch RSI overbought (${indicators.stochRsiK?.toFixed(1)})`);
        } else if (indicators.stochRsiSignal === 'BULLISH_CROSS') {
          score += 15;
          confidence += 10;
          bullishSignals += 2;
          reasons.push('Stoch RSI bullish cross');
        } else if (indicators.stochRsiSignal === 'BEARISH_CROSS') {
          score += 15;
          confidence += 10;
          bearishSignals += 2;
          reasons.push('Stoch RSI bearish cross');
        }
      }
      
      // === MACD Analysis ===
      if (indicators.macdHistogram > 0 && indicators.macdTrend === 'BULLISH') {
        score += 8;
        confidence += 5;
        bullishSignals++;
        reasons.push('MACD bullish');
      } else if (indicators.macdHistogram < 0 && indicators.macdTrend === 'BEARISH') {
        score += 8;
        confidence += 5;
        bearishSignals++;
        reasons.push('MACD bearish');
      }
      
      // === EMA Trend ===
      if (indicators.emaTrend === 'STRONG_BULLISH') {
        score += 10;
        confidence += 6;
        bullishSignals++;
        reasons.push('Strong uptrend (EMAs)');
      } else if (indicators.emaTrend === 'STRONG_BEARISH') {
        score += 10;
        confidence += 6;
        bearishSignals++;
        reasons.push('Strong downtrend (EMAs)');
      }
      
      // === ADX Analysis ===
      if (indicators.adxTrend && indicators.adxDirection) {
        const hasStrongTrend = indicators.adxTrend === 'STRONG_TREND' || indicators.adxTrend === 'TRENDING';
        if (hasStrongTrend) {
          if (indicators.adxDirection === 'BULLISH') {
            score += 12;
            confidence += 8;
            bullishSignals += 2;
            reasons.push(`ADX strong bullish (${indicators.adx?.toFixed(1)})`);
          } else if (indicators.adxDirection === 'BEARISH') {
            score += 12;
            confidence += 8;
            bearishSignals += 2;
            reasons.push(`ADX strong bearish (${indicators.adx?.toFixed(1)})`);
          }
        } else if (indicators.adxTrend === 'NO_TREND') {
          confidence -= 5;
        }
      }
      
      // === Ichimoku Cloud Analysis ===
      if (indicators.ichimokuSignal) {
        if (indicators.ichimokuSignal === 'STRONG_BULLISH') {
          score += 15;
          confidence += 10;
          bullishSignals += 2;
          reasons.push('Ichimoku strong bullish');
        } else if (indicators.ichimokuSignal === 'BULLISH') {
          score += 10;
          confidence += 6;
          bullishSignals++;
          reasons.push('Ichimoku bullish');
        } else if (indicators.ichimokuSignal === 'STRONG_BEARISH') {
          score += 15;
          confidence += 10;
          bearishSignals += 2;
          reasons.push('Ichimoku strong bearish');
        } else if (indicators.ichimokuSignal === 'BEARISH') {
          score += 10;
          confidence += 6;
          bearishSignals++;
          reasons.push('Ichimoku bearish');
        }
      }
      
      // Ichimoku Cloud Position
      if (indicators.ichimokuCloudPosition) {
        if (indicators.ichimokuCloudPosition === 'ABOVE_CLOUD') {
          score += 8;
          bullishSignals++;
          reasons.push('Price above Ichimoku cloud');
        } else if (indicators.ichimokuCloudPosition === 'BELOW_CLOUD') {
          score += 8;
          bearishSignals++;
          reasons.push('Price below Ichimoku cloud');
        }
      }
      
      // === Bollinger Position ===
      if (indicators.bollingerPosition === 'BELOW_LOWER') {
        score += 8;
        bullishSignals++;
        reasons.push('Below Bollinger lower');
      } else if (indicators.bollingerPosition === 'ABOVE_UPPER') {
        score += 8;
        bearishSignals++;
        reasons.push('Above Bollinger upper');
      }
      
      // === Volume confirmation ===
      if (indicators.volumeRatio > 1.5) {
        score += 5;
        confidence += 5;
        reasons.push(`High volume (${indicators.volumeRatio.toFixed(1)}x)`);
      }
      
      // === Signal strength boost ===
      if (indicators.signalStrength > 70) {
        score += 8;
        confidence += 8;
      }
      
      // === Determine recommendation based on signal consensus ===
      const netSignal = bullishSignals - bearishSignals;
      const hasConfluence = bullishSignals >= 3 || bearishSignals >= 3;
      
      if (netSignal >= 2 && score >= 65 && hasConfluence) {
        recommendation = 'BUY';
      } else if (netSignal <= -2 && score >= 65 && hasConfluence) {
        recommendation = 'SELL';
      } else if (netSignal >= 3) {
        recommendation = 'BUY';
      } else if (netSignal <= -3) {
        recommendation = 'SELL';
      }
      
      if (hasConfluence) {
        confidence += 10;
        score += 5;
      }
      
      // === Calculate entry, SL, TP ===
      const atr = indicators.atr || data.price * 0.02;
      const entryPrice = data.price;
      let stopLoss: number;
      let takeProfit: number;
      
      const kumoTop = Math.max(indicators.ichimokuSenkouA || 0, indicators.ichimokuSenkouB || 0);
      const kumoBottom = Math.min(indicators.ichimokuSenkouA || Infinity, indicators.ichimokuSenkouB || Infinity);
      
      if (recommendation === 'BUY') {
        const ichimokuSL = indicators.ichimokuKijun || kumoBottom;
        const technicalSL = indicators.nearestSupport || (entryPrice - atr * 2);
        stopLoss = Math.max(Math.min(ichimokuSL, technicalSL), entryPrice - atr * 2.5);
        takeProfit = indicators.nearestResistance || (entryPrice + atr * 3);
      } else if (recommendation === 'SELL') {
        const ichimokuSL = indicators.ichimokuKijun || kumoTop;
        const technicalSL = indicators.nearestResistance || (entryPrice + atr * 2);
        stopLoss = Math.min(Math.max(ichimokuSL, technicalSL), entryPrice + atr * 2.5);
        takeProfit = indicators.nearestSupport || (entryPrice - atr * 3);
      } else {
        stopLoss = entryPrice - atr * 1.5;
        takeProfit = entryPrice + atr * 1.5;
      }
      
      const riskReward = Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss);
      
      let suggestedStrategy: 'SCALP' | 'DAYTRADE' | 'SWING' = 'DAYTRADE';
      let professionalStrategy: BotOpportunity['professionalStrategy'] = 'MOMENTUM';
      
      if (indicators.adxTrend === 'STRONG_TREND') {
        professionalStrategy = 'BREAKOUT';
        suggestedStrategy = 'SWING';
      } else if (indicators.ichimokuSignal?.includes('STRONG')) {
        professionalStrategy = 'INSTITUTIONAL_FLOW';
        suggestedStrategy = 'SWING';
      } else if (indicators.stochRsiSignal?.includes('CROSS')) {
        professionalStrategy = 'MOMENTUM';
        suggestedStrategy = 'SCALP';
      }
      
      if (score >= 60 && recommendation !== 'HOLD') {
        opportunities.push({
          symbol,
          recommendation,
          confidence: Math.min(95, Math.max(50, confidence)),
          score: Math.min(100, score),
          reasoning: reasons.slice(0, 5).join(', ') || 'Technical analysis',
          entryPrice,
          stopLoss,
          takeProfit,
          riskRewardRatio: riskReward,
          suggestedStrategy,
          professionalStrategy,
        });
      }
    });
    
    opportunities.sort((a, b) => (b.score * b.confidence) - (a.score * a.confidence));
    const topOpps = opportunities.slice(0, 5);
    
    const result: MultiPairAnalysisResult = {
      success: true,
      timestamp: new Date().toISOString(),
      pairsAnalyzed: Object.keys(marketData).length,
      bestOpportunities: topOpps,
      marketOverview: `Análise técnica avançada: ${topOpps.length} oportunidades (Stoch RSI + ADX + Ichimoku)`,
      topPick: topOpps.length > 0 ? {
        symbol: topOpps[0].symbol,
        action: topOpps[0].recommendation as 'BUY' | 'SELL',
        urgency: topOpps[0].score >= 80 ? 'high' : topOpps[0].score >= 70 ? 'medium' : 'low',
      } : null,
      neuralEnabled: false,
      neuralInsights: 'Usando análise técnica avançada local (Stochastic RSI, ADX, Ichimoku Cloud)',
    };
    
    addLog('AI', `📊 Análise local avançada: ${topOpps.length} oportunidades (${topOpps.map(o => `${o.symbol}:${o.score}`).join(', ')})`);
    
    return result;
  }, []);

  return { performLocalAnalysis };
}
