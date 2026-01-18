import { useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Activity, BarChart2, 
  Target, AlertTriangle, Zap, Gauge
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { TechnicalIndicators } from '@/hooks/useTechnicalIndicators';

interface TechnicalIndicatorsDisplayProps {
  indicators: TechnicalIndicators;
  compact?: boolean;
  className?: string;
}

const RSIGauge = ({ value, className }: { value: number; className?: string }) => {
  const color = value < 30 ? 'text-profit' : value > 70 ? 'text-loss' : 'text-muted-foreground';
  const bgColor = value < 30 ? 'bg-profit' : value > 70 ? 'bg-loss' : 'bg-primary';
  
  return (
    <div className={cn("relative", className)}>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-300", bgColor)}
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
        <span>30</span>
        <span className={cn("font-bold", color)}>{value.toFixed(0)}</span>
        <span>70</span>
      </div>
    </div>
  );
};

const MACDBar = ({ histogram, className }: { histogram: number; className?: string }) => {
  const isPositive = histogram > 0;
  const normalized = Math.min(100, Math.abs(histogram) * 1000); // Normalize for display
  
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
        <div className="w-1/2 flex justify-end">
          {!isPositive && (
            <div 
              className="h-full bg-loss transition-all duration-300 rounded-l"
              style={{ width: `${normalized}%` }}
            />
          )}
        </div>
        <div className="w-1/2">
          {isPositive && (
            <div 
              className="h-full bg-profit transition-all duration-300 rounded-r"
              style={{ width: `${normalized}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const BollingerBandVisual = ({ 
  upper, middle, lower, currentPrice, className 
}: { 
  upper: number; middle: number; lower: number; currentPrice: number; className?: string;
}) => {
  const range = upper - lower;
  const position = range > 0 ? ((currentPrice - lower) / range) * 100 : 50;
  
  return (
    <div className={cn("relative h-4", className)}>
      {/* Band background */}
      <div className="absolute inset-0 bg-gradient-to-r from-loss/20 via-muted/30 to-profit/20 rounded-full" />
      
      {/* Price position marker */}
      <div 
        className="absolute top-0 w-1.5 h-4 bg-primary rounded-full shadow-lg transition-all duration-300"
        style={{ left: `calc(${Math.min(100, Math.max(0, position))}% - 3px)` }}
      />
      
      {/* Middle line */}
      <div className="absolute top-0 left-1/2 w-px h-4 bg-muted-foreground/30" />
    </div>
  );
};

export const TechnicalIndicatorsDisplay = ({ 
  indicators, 
  compact = false,
  className 
}: TechnicalIndicatorsDisplayProps) => {
  const signalColor = useMemo(() => {
    switch (indicators.overallSignal) {
      case 'STRONG_BUY': return 'text-profit bg-profit/20 border-profit';
      case 'BUY': return 'text-profit bg-profit/10 border-profit/50';
      case 'STRONG_SELL': return 'text-loss bg-loss/20 border-loss';
      case 'SELL': return 'text-loss bg-loss/10 border-loss/50';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  }, [indicators.overallSignal]);

  const signalIcon = useMemo(() => {
    switch (indicators.overallSignal) {
      case 'STRONG_BUY':
      case 'BUY':
        return <TrendingUp className="w-3 h-3" />;
      case 'STRONG_SELL':
      case 'SELL':
        return <TrendingDown className="w-3 h-3" />;
      default:
        return <Activity className="w-3 h-3" />;
    }
  }, [indicators.overallSignal]);

  if (compact) {
    return (
      <div className={cn("space-y-1.5", className)}>
        {/* Overall Signal */}
        <div className={cn("flex items-center justify-between p-1.5 rounded border", signalColor)}>
          <div className="flex items-center gap-1">
            {signalIcon}
            <span className="text-[10px] font-medium">{indicators.overallSignal.replace('_', ' ')}</span>
          </div>
          <Badge variant="outline" className="text-[9px] px-1 py-0">
            {indicators.signalStrength}%
          </Badge>
        </div>

        {/* Key Indicators Row */}
        <div className="grid grid-cols-4 gap-1">
          {/* RSI */}
          <div className="text-center p-1 rounded bg-muted/30">
            <p className="text-[8px] text-muted-foreground">RSI</p>
            <p className={cn(
              "text-[10px] font-bold",
              indicators.rsi < 30 ? "text-profit" : indicators.rsi > 70 ? "text-loss" : "text-foreground"
            )}>
              {indicators.rsi.toFixed(0)}
            </p>
          </div>

          {/* MACD */}
          <div className="text-center p-1 rounded bg-muted/30">
            <p className="text-[8px] text-muted-foreground">MACD</p>
            <p className={cn(
              "text-[10px] font-bold",
              indicators.macdTrend === 'BULLISH' ? "text-profit" : 
              indicators.macdTrend === 'BEARISH' ? "text-loss" : "text-foreground"
            )}>
              {indicators.macdTrend === 'BULLISH' ? '📈' : indicators.macdTrend === 'BEARISH' ? '📉' : '➡️'}
            </p>
          </div>

          {/* EMA Trend */}
          <div className="text-center p-1 rounded bg-muted/30">
            <p className="text-[8px] text-muted-foreground">EMA</p>
            <p className={cn(
              "text-[10px] font-bold",
              indicators.emaTrend.includes('BULLISH') ? "text-profit" : 
              indicators.emaTrend.includes('BEARISH') ? "text-loss" : "text-foreground"
            )}>
              {indicators.emaTrend.includes('STRONG') ? '🔥' : 
               indicators.emaTrend.includes('BULLISH') ? '🐂' : 
               indicators.emaTrend.includes('BEARISH') ? '🐻' : '—'}
            </p>
          </div>

          {/* Volume */}
          <div className="text-center p-1 rounded bg-muted/30">
            <p className="text-[8px] text-muted-foreground">Vol</p>
            <p className={cn(
              "text-[10px] font-bold",
              indicators.volumeSignal === 'HIGH' ? "text-warning" : "text-foreground"
            )}>
              {indicators.volumeRatio.toFixed(1)}x
            </p>
          </div>
        </div>

        {/* Bollinger Position */}
        <BollingerBandVisual
          upper={indicators.bollingerUpper}
          middle={indicators.bollingerMiddle}
          lower={indicators.bollingerLower}
          currentPrice={(indicators.bollingerUpper + indicators.bollingerLower) / 2 * 
            (indicators.bollingerPosition === 'ABOVE_UPPER' ? 1.05 :
             indicators.bollingerPosition === 'ABOVE_MIDDLE' ? 1.02 :
             indicators.bollingerPosition === 'BELOW_MIDDLE' ? 0.98 : 0.95)}
        />
      </div>
    );
  }

  // Full display
  return (
    <div className={cn("space-y-3 p-3 rounded-lg bg-card border border-border", className)}>
      {/* Header with Overall Signal */}
      <div className={cn("flex items-center justify-between p-2 rounded-lg border", signalColor)}>
        <div className="flex items-center gap-2">
          {signalIcon}
          <div>
            <p className="text-sm font-bold">{indicators.overallSignal.replace('_', ' ')}</p>
            <p className="text-[10px] opacity-75">Força: {indicators.signalStrength}%</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Momentum</p>
          <p className={cn(
            "text-sm font-mono font-bold",
            indicators.momentum > 0 ? "text-profit" : "text-loss"
          )}>
            {indicators.momentum > 0 ? '+' : ''}{indicators.momentum.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* RSI Section */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <Gauge className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-medium">RSI (14)</span>
          </div>
          <Badge 
            variant="outline" 
            className={cn(
              "text-[9px]",
              indicators.rsiSignal === 'OVERSOLD' ? "border-profit text-profit" :
              indicators.rsiSignal === 'OVERBOUGHT' ? "border-loss text-loss" :
              "border-muted-foreground text-muted-foreground"
            )}
          >
            {indicators.rsiSignal}
          </Badge>
        </div>
        <RSIGauge value={indicators.rsi} />
      </div>

      {/* MACD Section */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <BarChart2 className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-medium">MACD</span>
          </div>
          <span className={cn(
            "text-[10px] font-mono",
            indicators.macdHistogram > 0 ? "text-profit" : "text-loss"
          )}>
            H: {indicators.macdHistogram > 0 ? '+' : ''}{indicators.macdHistogram.toFixed(4)}
          </span>
        </div>
        <MACDBar histogram={indicators.macdHistogram} />
        <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
          <span>MACD: {indicators.macd.toFixed(4)}</span>
          <span>Signal: {indicators.macdSignal.toFixed(4)}</span>
        </div>
      </div>

      {/* Bollinger Bands */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-medium">Bollinger Bands</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Width: {indicators.bollingerWidth.toFixed(2)}%
          </span>
        </div>
        <BollingerBandVisual
          upper={indicators.bollingerUpper}
          middle={indicators.bollingerMiddle}
          lower={indicators.bollingerLower}
          currentPrice={(indicators.bollingerUpper + indicators.bollingerLower) / 2 * 
            (indicators.bollingerPosition === 'ABOVE_UPPER' ? 1.05 :
             indicators.bollingerPosition === 'ABOVE_MIDDLE' ? 1.02 :
             indicators.bollingerPosition === 'BELOW_MIDDLE' ? 0.98 : 0.95)}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
          <span className="text-loss">${indicators.bollingerLower.toFixed(2)}</span>
          <span>${indicators.bollingerMiddle.toFixed(2)}</span>
          <span className="text-profit">${indicators.bollingerUpper.toFixed(2)}</span>
        </div>
      </div>

      {/* EMA Trend */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-1.5 rounded bg-muted/30">
          <p className="text-[9px] text-muted-foreground">EMA 9</p>
          <p className="text-[10px] font-mono font-medium">${indicators.ema9.toFixed(2)}</p>
        </div>
        <div className="text-center p-1.5 rounded bg-muted/30">
          <p className="text-[9px] text-muted-foreground">EMA 21</p>
          <p className="text-[10px] font-mono font-medium">${indicators.ema21.toFixed(2)}</p>
        </div>
        <div className="text-center p-1.5 rounded bg-muted/30">
          <p className="text-[9px] text-muted-foreground">EMA 50</p>
          <p className="text-[10px] font-mono font-medium">${indicators.ema50.toFixed(2)}</p>
        </div>
      </div>

      {/* Support/Resistance */}
      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
        <div className="flex items-center gap-1">
          <Target className="w-3 h-3 text-loss" />
          <div>
            <p className="text-[9px] text-muted-foreground">Suporte</p>
            <p className="text-[10px] font-mono font-medium text-loss">
              ${indicators.nearestSupport.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="text-center">
          <AlertTriangle className="w-3 h-3 mx-auto text-warning" />
          <p className="text-[9px] text-muted-foreground">ATR: {indicators.atrPercent.toFixed(2)}%</p>
        </div>
        <div className="flex items-center gap-1 text-right">
          <div>
            <p className="text-[9px] text-muted-foreground">Resistência</p>
            <p className="text-[10px] font-mono font-medium text-profit">
              ${indicators.nearestResistance.toFixed(2)}
            </p>
          </div>
          <Target className="w-3 h-3 text-profit" />
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Zap className={cn(
            "w-3 h-3",
            indicators.volumeSignal === 'HIGH' ? "text-warning" : "text-muted-foreground"
          )} />
          <span className="text-xs">Volume</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn(
              "text-[9px]",
              indicators.volumeSignal === 'HIGH' ? "border-warning text-warning" : ""
            )}
          >
            {indicators.volumeSignal}
          </Badge>
          <span className="text-[10px] font-mono">{indicators.volumeRatio.toFixed(2)}x avg</span>
        </div>
      </div>
    </div>
  );
};
