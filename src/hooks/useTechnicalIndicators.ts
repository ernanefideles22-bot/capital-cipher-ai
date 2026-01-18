import { useState, useEffect, useCallback, useRef } from 'react';

// Trading pairs to monitor
const TRADING_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'MATICUSDT',
];

export interface TechnicalIndicators {
  // RSI
  rsi: number;
  rsiSignal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  
  // Stochastic RSI (NEW)
  stochRsiK: number;
  stochRsiD: number;
  stochRsiSignal: 'OVERSOLD' | 'OVERBOUGHT' | 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL';
  
  // MACD
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  macdTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  
  // Bollinger Bands
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  bollingerPosition: 'ABOVE_UPPER' | 'ABOVE_MIDDLE' | 'BELOW_MIDDLE' | 'BELOW_LOWER';
  bollingerWidth: number; // Volatility indicator
  
  // EMAs
  ema9: number;
  ema21: number;
  ema50: number;
  emaTrend: 'STRONG_BULLISH' | 'BULLISH' | 'BEARISH' | 'STRONG_BEARISH' | 'NEUTRAL';
  
  // ADX - Average Directional Index (NEW)
  adx: number;
  plusDI: number;
  minusDI: number;
  adxTrend: 'STRONG_TREND' | 'TRENDING' | 'WEAK_TREND' | 'NO_TREND';
  adxDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  
  // Ichimoku Cloud (NEW)
  ichimokuTenkan: number;
  ichimokuKijun: number;
  ichimokuSenkouA: number;
  ichimokuSenkouB: number;
  ichimokuChikou: number;
  ichimokuSignal: 'STRONG_BULLISH' | 'BULLISH' | 'BEARISH' | 'STRONG_BEARISH' | 'NEUTRAL';
  ichimokuCloudPosition: 'ABOVE_CLOUD' | 'IN_CLOUD' | 'BELOW_CLOUD';
  
  // Volume
  volumeRatio: number; // Current vs average
  volumeSignal: 'HIGH' | 'NORMAL' | 'LOW';
  
  // ATR (Average True Range) - Volatility
  atr: number;
  atrPercent: number;
  
  // Momentum
  momentum: number;
  momentumSignal: 'STRONG_UP' | 'UP' | 'DOWN' | 'STRONG_DOWN' | 'NEUTRAL';
  
  // Support/Resistance (based on recent price action)
  nearestSupport: number;
  nearestResistance: number;
  
  // Overall signal
  overallSignal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  signalStrength: number; // 0-100
  
  // Last update
  timestamp: number;
}

interface KlineData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

// Calculate EMA
function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // Start with SMA for first period
  let sum = 0;
  for (let i = 0; i < period && i < prices.length; i++) {
    sum += prices[i];
  }
  ema[period - 1] = sum / period;
  
  // Calculate EMA for rest
  for (let i = period; i < prices.length; i++) {
    ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }
  
  return ema;
}

// Calculate RSI
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  let avgGain = 0;
  let avgLoss = 0;
  
  // First average
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;
  
  // Smoothed averages
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate MACD
function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  const macdLine: number[] = [];
  for (let i = 25; i < prices.length; i++) {
    macdLine.push((ema12[i] || 0) - (ema26[i] || 0));
  }
  
  const signalLine = calculateEMA(macdLine, 9);
  
  const lastMacd = macdLine[macdLine.length - 1] || 0;
  const lastSignal = signalLine[signalLine.length - 1] || 0;
  
  return {
    macd: lastMacd,
    signal: lastSignal,
    histogram: lastMacd - lastSignal,
  };
}

// Calculate Bollinger Bands
function calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): {
  upper: number; middle: number; lower: number; width: number;
} {
  if (prices.length < period) {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return { upper: avg, middle: avg, lower: avg, width: 0 };
  }
  
  const recentPrices = prices.slice(-period);
  const sma = recentPrices.reduce((a, b) => a + b, 0) / period;
  
  const squaredDiffs = recentPrices.map(p => Math.pow(p - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(variance);
  
  const upper = sma + stdDev * std;
  const lower = sma - stdDev * std;
  
  return {
    upper,
    middle: sma,
    lower,
    width: ((upper - lower) / sma) * 100, // Width as percentage
  };
}

// Calculate ATR
function calculateATR(klines: KlineData[], period: number = 14): number {
  if (klines.length < 2) return 0;
  
  const trueRanges: number[] = [];
  
  for (let i = 1; i < klines.length; i++) {
    const high = klines[i].high;
    const low = klines[i].low;
    const prevClose = klines[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  if (trueRanges.length < period) {
    return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  }
  
  // Calculate ATR using EMA
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = ((atr * (period - 1)) + trueRanges[i]) / period;
  }
  
  return atr;
}

// Calculate Stochastic RSI
function calculateStochRSI(prices: number[], rsiPeriod: number = 14, stochPeriod: number = 14, kPeriod: number = 3, dPeriod: number = 3): {
  k: number; d: number; signal: TechnicalIndicators['stochRsiSignal'];
} {
  if (prices.length < rsiPeriod + stochPeriod) {
    return { k: 50, d: 50, signal: 'NEUTRAL' };
  }
  
  // Calculate RSI values for each period
  const rsiValues: number[] = [];
  for (let i = rsiPeriod; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    rsiValues.push(calculateRSI(slice, rsiPeriod));
  }
  
  if (rsiValues.length < stochPeriod) {
    return { k: 50, d: 50, signal: 'NEUTRAL' };
  }
  
  // Calculate Stochastic of RSI
  const recentRsi = rsiValues.slice(-stochPeriod);
  const minRsi = Math.min(...recentRsi);
  const maxRsi = Math.max(...recentRsi);
  const currentRsi = recentRsi[recentRsi.length - 1];
  
  const rawK = maxRsi !== minRsi ? ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100 : 50;
  
  // Smooth K with SMA
  const kValues: number[] = [];
  for (let i = stochPeriod; i <= rsiValues.length; i++) {
    const slice = rsiValues.slice(i - stochPeriod, i);
    const minR = Math.min(...slice);
    const maxR = Math.max(...slice);
    const currR = slice[slice.length - 1];
    kValues.push(maxR !== minR ? ((currR - minR) / (maxR - minR)) * 100 : 50);
  }
  
  const k = kValues.slice(-kPeriod).reduce((a, b) => a + b, 0) / kPeriod;
  const d = kValues.slice(-dPeriod - kPeriod + 1, -kPeriod + 1 || undefined).reduce((a, b) => a + b, 0) / dPeriod || k;
  
  // Determine signal
  let signal: TechnicalIndicators['stochRsiSignal'] = 'NEUTRAL';
  const prevK = kValues[kValues.length - 2] || k;
  const prevD = kValues.length >= dPeriod + 1 
    ? kValues.slice(-dPeriod - 1, -1).reduce((a, b) => a + b, 0) / dPeriod 
    : d;
  
  if (k < 20) signal = 'OVERSOLD';
  else if (k > 80) signal = 'OVERBOUGHT';
  else if (prevK < prevD && k > d) signal = 'BULLISH_CROSS';
  else if (prevK > prevD && k < d) signal = 'BEARISH_CROSS';
  
  return { k, d, signal };
}

// Calculate ADX (Average Directional Index)
function calculateADX(klines: KlineData[], period: number = 14): {
  adx: number; plusDI: number; minusDI: number; 
  trend: TechnicalIndicators['adxTrend']; direction: TechnicalIndicators['adxDirection'];
} {
  if (klines.length < period + 1) {
    return { adx: 0, plusDI: 0, minusDI: 0, trend: 'NO_TREND', direction: 'NEUTRAL' };
  }
  
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  
  for (let i = 1; i < klines.length; i++) {
    const high = klines[i].high;
    const low = klines[i].low;
    const prevHigh = klines[i - 1].high;
    const prevLow = klines[i - 1].low;
    const prevClose = klines[i - 1].close;
    
    // True Range
    const trueRange = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    tr.push(trueRange);
    
    // Directional Movement
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  
  // Smooth the values with Wilder's smoothing
  let smoothedTR = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  
  const dxValues: number[] = [];
  
  for (let i = period; i < tr.length; i++) {
    smoothedTR = smoothedTR - (smoothedTR / period) + tr[i];
    smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDM[i];
    smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDM[i];
    
    const plusDI = (smoothedPlusDM / smoothedTR) * 100;
    const minusDI = (smoothedMinusDM / smoothedTR) * 100;
    
    const diDiff = Math.abs(plusDI - minusDI);
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (diDiff / diSum) * 100 : 0;
    dxValues.push(dx);
  }
  
  // Calculate ADX as smoothed average of DX
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = ((adx * (period - 1)) + dxValues[i]) / period;
  }
  
  // Get final +DI and -DI
  const finalPlusDI = (smoothedPlusDM / smoothedTR) * 100;
  const finalMinusDI = (smoothedMinusDM / smoothedTR) * 100;
  
  // Determine trend strength
  let trend: TechnicalIndicators['adxTrend'];
  if (adx >= 50) trend = 'STRONG_TREND';
  else if (adx >= 25) trend = 'TRENDING';
  else if (adx >= 15) trend = 'WEAK_TREND';
  else trend = 'NO_TREND';
  
  // Determine direction
  let direction: TechnicalIndicators['adxDirection'];
  if (finalPlusDI > finalMinusDI + 5) direction = 'BULLISH';
  else if (finalMinusDI > finalPlusDI + 5) direction = 'BEARISH';
  else direction = 'NEUTRAL';
  
  return { adx, plusDI: finalPlusDI, minusDI: finalMinusDI, trend, direction };
}

// Calculate Ichimoku Cloud
function calculateIchimoku(klines: KlineData[]): {
  tenkan: number; kijun: number; senkouA: number; senkouB: number; chikou: number;
  signal: TechnicalIndicators['ichimokuSignal']; cloudPosition: TechnicalIndicators['ichimokuCloudPosition'];
} {
  const defaultResult = {
    tenkan: 0, kijun: 0, senkouA: 0, senkouB: 0, chikou: 0,
    signal: 'NEUTRAL' as TechnicalIndicators['ichimokuSignal'],
    cloudPosition: 'IN_CLOUD' as TechnicalIndicators['ichimokuCloudPosition']
  };
  
  if (klines.length < 52) return defaultResult;
  
  const currentPrice = klines[klines.length - 1].close;
  
  // Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
  const last9 = klines.slice(-9);
  const tenkan = (Math.max(...last9.map(k => k.high)) + Math.min(...last9.map(k => k.low))) / 2;
  
  // Kijun-sen (Base Line): (26-period high + 26-period low) / 2
  const last26 = klines.slice(-26);
  const kijun = (Math.max(...last26.map(k => k.high)) + Math.min(...last26.map(k => k.low))) / 2;
  
  // Senkou Span A (Leading Span A): (Tenkan + Kijun) / 2, plotted 26 periods ahead
  const senkouA = (tenkan + kijun) / 2;
  
  // Senkou Span B (Leading Span B): (52-period high + 52-period low) / 2, plotted 26 periods ahead
  const last52 = klines.slice(-52);
  const senkouB = (Math.max(...last52.map(k => k.high)) + Math.min(...last52.map(k => k.low))) / 2;
  
  // Chikou Span (Lagging Span): Current close plotted 26 periods back
  const chikou = currentPrice;
  
  // Determine cloud position
  const cloudTop = Math.max(senkouA, senkouB);
  const cloudBottom = Math.min(senkouA, senkouB);
  
  let cloudPosition: TechnicalIndicators['ichimokuCloudPosition'];
  if (currentPrice > cloudTop) cloudPosition = 'ABOVE_CLOUD';
  else if (currentPrice < cloudBottom) cloudPosition = 'BELOW_CLOUD';
  else cloudPosition = 'IN_CLOUD';
  
  // Determine signal
  let signal: TechnicalIndicators['ichimokuSignal'] = 'NEUTRAL';
  const isBullish = tenkan > kijun && currentPrice > cloudTop && senkouA > senkouB;
  const isBearish = tenkan < kijun && currentPrice < cloudBottom && senkouA < senkouB;
  
  if (isBullish) {
    signal = tenkan > kijun * 1.01 ? 'STRONG_BULLISH' : 'BULLISH';
  } else if (isBearish) {
    signal = tenkan < kijun * 0.99 ? 'STRONG_BEARISH' : 'BEARISH';
  }
  
  return { tenkan, kijun, senkouA, senkouB, chikou, signal, cloudPosition };
}

// Calculate Support/Resistance levels
function calculateSupportResistance(klines: KlineData[], currentPrice: number): {
  support: number; resistance: number;
} {
  if (klines.length < 10) {
    return { support: currentPrice * 0.98, resistance: currentPrice * 1.02 };
  }
  
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);
  
  // Find recent swing highs and lows
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  
  for (let i = 2; i < klines.length - 2; i++) {
    if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && 
        highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
      swingHighs.push(highs[i]);
    }
    if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && 
        lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
      swingLows.push(lows[i]);
    }
  }
  
  // Find nearest levels
  const resistanceLevels = swingHighs.filter(h => h > currentPrice).sort((a, b) => a - b);
  const supportLevels = swingLows.filter(l => l < currentPrice).sort((a, b) => b - a);
  
  return {
    support: supportLevels[0] || Math.min(...lows),
    resistance: resistanceLevels[0] || Math.max(...highs),
  };
}

// Calculate overall signal with new indicators
function calculateOverallSignal(indicators: Partial<TechnicalIndicators>): {
  signal: TechnicalIndicators['overallSignal'];
  strength: number;
} {
  let bullishPoints = 0;
  let bearishPoints = 0;
  
  // RSI contribution
  if (indicators.rsi !== undefined) {
    if (indicators.rsi < 30) bullishPoints += 2; // Oversold = bullish
    else if (indicators.rsi < 40) bullishPoints += 1;
    else if (indicators.rsi > 70) bearishPoints += 2; // Overbought = bearish
    else if (indicators.rsi > 60) bearishPoints += 1;
  }
  
  // Stochastic RSI contribution (NEW)
  if (indicators.stochRsiSignal) {
    if (indicators.stochRsiSignal === 'OVERSOLD') bullishPoints += 2;
    else if (indicators.stochRsiSignal === 'BULLISH_CROSS') bullishPoints += 3;
    else if (indicators.stochRsiSignal === 'OVERBOUGHT') bearishPoints += 2;
    else if (indicators.stochRsiSignal === 'BEARISH_CROSS') bearishPoints += 3;
  }
  
  // MACD contribution
  if (indicators.macdHistogram !== undefined) {
    if (indicators.macdHistogram > 0) {
      bullishPoints += indicators.macdHistogram > indicators.macd! * 0.1 ? 2 : 1;
    } else {
      bearishPoints += indicators.macdHistogram < indicators.macd! * -0.1 ? 2 : 1;
    }
  }
  
  // Bollinger contribution
  if (indicators.bollingerPosition) {
    if (indicators.bollingerPosition === 'BELOW_LOWER') bullishPoints += 2;
    else if (indicators.bollingerPosition === 'BELOW_MIDDLE') bullishPoints += 1;
    else if (indicators.bollingerPosition === 'ABOVE_UPPER') bearishPoints += 2;
    else if (indicators.bollingerPosition === 'ABOVE_MIDDLE') bearishPoints += 1;
  }
  
  // EMA trend contribution
  if (indicators.emaTrend) {
    if (indicators.emaTrend === 'STRONG_BULLISH') bullishPoints += 3;
    else if (indicators.emaTrend === 'BULLISH') bullishPoints += 2;
    else if (indicators.emaTrend === 'STRONG_BEARISH') bearishPoints += 3;
    else if (indicators.emaTrend === 'BEARISH') bearishPoints += 2;
  }
  
  // ADX contribution (NEW) - Trend strength amplifier
  if (indicators.adxTrend && indicators.adxDirection) {
    const trendMultiplier = indicators.adxTrend === 'STRONG_TREND' ? 3 : 
                            indicators.adxTrend === 'TRENDING' ? 2 : 
                            indicators.adxTrend === 'WEAK_TREND' ? 1 : 0;
    if (indicators.adxDirection === 'BULLISH') bullishPoints += trendMultiplier;
    else if (indicators.adxDirection === 'BEARISH') bearishPoints += trendMultiplier;
  }
  
  // Ichimoku contribution (NEW)
  if (indicators.ichimokuSignal) {
    if (indicators.ichimokuSignal === 'STRONG_BULLISH') bullishPoints += 4;
    else if (indicators.ichimokuSignal === 'BULLISH') bullishPoints += 2;
    else if (indicators.ichimokuSignal === 'STRONG_BEARISH') bearishPoints += 4;
    else if (indicators.ichimokuSignal === 'BEARISH') bearishPoints += 2;
  }
  
  if (indicators.ichimokuCloudPosition) {
    if (indicators.ichimokuCloudPosition === 'ABOVE_CLOUD') bullishPoints += 2;
    else if (indicators.ichimokuCloudPosition === 'BELOW_CLOUD') bearishPoints += 2;
  }
  
  // Volume contribution
  if (indicators.volumeSignal === 'HIGH') {
    // High volume amplifies the trend
    if (bullishPoints > bearishPoints) bullishPoints += 1;
    else if (bearishPoints > bullishPoints) bearishPoints += 1;
  }
  
  // Momentum contribution
  if (indicators.momentumSignal) {
    if (indicators.momentumSignal === 'STRONG_UP') bullishPoints += 2;
    else if (indicators.momentumSignal === 'UP') bullishPoints += 1;
    else if (indicators.momentumSignal === 'STRONG_DOWN') bearishPoints += 2;
    else if (indicators.momentumSignal === 'DOWN') bearishPoints += 1;
  }
  
  const totalPoints = bullishPoints + bearishPoints;
  const netScore = bullishPoints - bearishPoints;
  const strength = totalPoints > 0 ? Math.min(100, Math.abs(netScore) / totalPoints * 100 + 20) : 50;
  
  let signal: TechnicalIndicators['overallSignal'];
  if (netScore >= 8) signal = 'STRONG_BUY';
  else if (netScore >= 3) signal = 'BUY';
  else if (netScore <= -8) signal = 'STRONG_SELL';
  else if (netScore <= -3) signal = 'SELL';
  else signal = 'NEUTRAL';
  
  return { signal, strength: Math.round(strength) };
}

export function useTechnicalIndicators(options: { enabled?: boolean; intervalMs?: number } = {}) {
  const { enabled = true, intervalMs = 5000 } = options;
  const [indicators, setIndicators] = useState<Record<string, TechnicalIndicators>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const fetchInProgress = useRef(false);

  const fetchIndicators = useCallback(async () => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;

    try {
      const newIndicators: Record<string, TechnicalIndicators> = {};

      await Promise.all(
        TRADING_PAIRS.map(async (symbol) => {
          try {
            // Fetch 100 5-minute klines (about 8 hours of data)
            const response = await fetch(
              `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=5&limit=100`
            );

            if (!response.ok) return;

            const data = await response.json();

            if (data.retCode !== 0 || !data.result?.list) return;

            // Parse klines (format: [startTime, open, high, low, close, volume, turnover])
            const klines: KlineData[] = data.result.list
              .map((k: string[]) => ({
                timestamp: parseInt(k[0]),
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
              }))
              .reverse(); // Chronological order

            if (klines.length < 20) return;

            const closes = klines.map(k => k.close);
            const volumes = klines.map(k => k.volume);
            const currentPrice = closes[closes.length - 1];

            // Calculate RSI
            const rsi = calculateRSI(closes, 14);
            const rsiSignal: TechnicalIndicators['rsiSignal'] = 
              rsi < 30 ? 'OVERSOLD' : rsi > 70 ? 'OVERBOUGHT' : 'NEUTRAL';

            // Calculate MACD
            const macdData = calculateMACD(closes);
            const macdTrend: TechnicalIndicators['macdTrend'] = 
              macdData.histogram > 0 ? 'BULLISH' : macdData.histogram < 0 ? 'BEARISH' : 'NEUTRAL';

            // Calculate Bollinger Bands
            const bb = calculateBollingerBands(closes, 20, 2);
            let bollingerPosition: TechnicalIndicators['bollingerPosition'];
            if (currentPrice > bb.upper) bollingerPosition = 'ABOVE_UPPER';
            else if (currentPrice > bb.middle) bollingerPosition = 'ABOVE_MIDDLE';
            else if (currentPrice > bb.lower) bollingerPosition = 'BELOW_MIDDLE';
            else bollingerPosition = 'BELOW_LOWER';

            // Calculate EMAs
            const ema9Arr = calculateEMA(closes, 9);
            const ema21Arr = calculateEMA(closes, 21);
            const ema50Arr = calculateEMA(closes, 50);
            
            const ema9 = ema9Arr[ema9Arr.length - 1] || currentPrice;
            const ema21 = ema21Arr[ema21Arr.length - 1] || currentPrice;
            const ema50 = ema50Arr[ema50Arr.length - 1] || currentPrice;

            let emaTrend: TechnicalIndicators['emaTrend'];
            if (ema9 > ema21 && ema21 > ema50 && currentPrice > ema9) {
              emaTrend = 'STRONG_BULLISH';
            } else if (ema9 > ema21 || currentPrice > ema21) {
              emaTrend = 'BULLISH';
            } else if (ema9 < ema21 && ema21 < ema50 && currentPrice < ema9) {
              emaTrend = 'STRONG_BEARISH';
            } else if (ema9 < ema21 || currentPrice < ema21) {
              emaTrend = 'BEARISH';
            } else {
              emaTrend = 'NEUTRAL';
            }

            // Calculate Volume Ratio
            const avgVolume = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
            const currentVolume = volumes[volumes.length - 1];
            const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
            const volumeSignal: TechnicalIndicators['volumeSignal'] = 
              volumeRatio > 1.5 ? 'HIGH' : volumeRatio < 0.5 ? 'LOW' : 'NORMAL';

            // Calculate ATR
            const atr = calculateATR(klines, 14);
            const atrPercent = (atr / currentPrice) * 100;

            // Calculate Momentum (Rate of Change over 10 periods)
            const momentum = closes.length >= 10 
              ? ((currentPrice - closes[closes.length - 10]) / closes[closes.length - 10]) * 100 
              : 0;
            let momentumSignal: TechnicalIndicators['momentumSignal'];
            if (momentum > 3) momentumSignal = 'STRONG_UP';
            else if (momentum > 1) momentumSignal = 'UP';
            else if (momentum < -3) momentumSignal = 'STRONG_DOWN';
            else if (momentum < -1) momentumSignal = 'DOWN';
            else momentumSignal = 'NEUTRAL';

            // Calculate Support/Resistance
            const sr = calculateSupportResistance(klines, currentPrice);

            // Calculate Stochastic RSI (NEW)
            const stochRsi = calculateStochRSI(closes);

            // Calculate ADX (NEW)
            const adxData = calculateADX(klines);

            // Calculate Ichimoku (NEW)
            const ichimoku = calculateIchimoku(klines);

            // Build indicators object
            const indicatorData: Partial<TechnicalIndicators> = {
              rsi,
              rsiSignal,
              // Stochastic RSI
              stochRsiK: stochRsi.k,
              stochRsiD: stochRsi.d,
              stochRsiSignal: stochRsi.signal,
              // MACD
              macd: macdData.macd,
              macdSignal: macdData.signal,
              macdHistogram: macdData.histogram,
              macdTrend,
              // Bollinger
              bollingerUpper: bb.upper,
              bollingerMiddle: bb.middle,
              bollingerLower: bb.lower,
              bollingerPosition,
              bollingerWidth: bb.width,
              // EMAs
              ema9,
              ema21,
              ema50,
              emaTrend,
              // ADX
              adx: adxData.adx,
              plusDI: adxData.plusDI,
              minusDI: adxData.minusDI,
              adxTrend: adxData.trend,
              adxDirection: adxData.direction,
              // Ichimoku
              ichimokuTenkan: ichimoku.tenkan,
              ichimokuKijun: ichimoku.kijun,
              ichimokuSenkouA: ichimoku.senkouA,
              ichimokuSenkouB: ichimoku.senkouB,
              ichimokuChikou: ichimoku.chikou,
              ichimokuSignal: ichimoku.signal,
              ichimokuCloudPosition: ichimoku.cloudPosition,
              // Volume
              volumeRatio,
              volumeSignal,
              // ATR
              atr,
              atrPercent,
              // Momentum
              momentum,
              momentumSignal,
              // Support/Resistance
              nearestSupport: sr.support,
              nearestResistance: sr.resistance,
            };

            // Calculate overall signal
            const { signal, strength } = calculateOverallSignal(indicatorData);

            newIndicators[symbol] = {
              ...indicatorData,
              overallSignal: signal,
              signalStrength: strength,
              timestamp: Date.now(),
            } as TechnicalIndicators;

          } catch (err) {
            console.error(`Error calculating indicators for ${symbol}:`, err);
          }
        })
      );

      if (Object.keys(newIndicators).length > 0) {
        setIndicators(prev => ({ ...prev, ...newIndicators }));
        setLastUpdate(new Date());
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching indicators:', err);
      setLoading(false);
    } finally {
      fetchInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    fetchIndicators();
    const interval = setInterval(fetchIndicators, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, intervalMs, fetchIndicators]);

  return {
    indicators,
    loading,
    lastUpdate,
    refetch: fetchIndicators,
  };
}
