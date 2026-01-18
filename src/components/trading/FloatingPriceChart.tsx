import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Target, Shield, DollarSign, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BotOpportunity } from '@/hooks/useAutonomousBot';

interface FloatingPriceChartProps {
  opportunity: BotOpportunity;
  currentPrice?: number;
  onClose?: () => void;
  className?: string;
}

export const FloatingPriceChart = ({
  opportunity,
  currentPrice,
  onClose,
  className,
}: FloatingPriceChartProps) => {
  const { entryPrice, stopLoss, takeProfit, recommendation, symbol, confidence } = opportunity;
  
  const isLong = recommendation === 'BUY';
  const price = currentPrice || entryPrice;
  
  // Calculate chart range and positions
  const chartData = useMemo(() => {
    const prices = [entryPrice, stopLoss, takeProfit, price].filter(p => p > 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;
    const padding = range * 0.15;
    
    const chartMin = minPrice - padding;
    const chartMax = maxPrice + padding;
    const chartRange = chartMax - chartMin;
    
    // Calculate Y positions (inverted: higher price = lower Y)
    const getY = (p: number) => ((chartMax - p) / chartRange) * 100;
    
    return {
      chartMin,
      chartMax,
      entryY: getY(entryPrice),
      slY: getY(stopLoss),
      tpY: getY(takeProfit),
      currentY: getY(price),
      // Risk/Reward zones
      riskZone: isLong 
        ? { top: getY(entryPrice), height: getY(stopLoss) - getY(entryPrice) }
        : { top: getY(stopLoss), height: getY(entryPrice) - getY(stopLoss) },
      profitZone: isLong
        ? { top: getY(takeProfit), height: getY(entryPrice) - getY(takeProfit) }
        : { top: getY(entryPrice), height: getY(stopLoss) - getY(entryPrice) },
    };
  }, [entryPrice, stopLoss, takeProfit, price, isLong]);

  const formatPrice = (p: number) => {
    if (p >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${p.toFixed(p < 1 ? 6 : 2)}`;
  };

  // Calculate profit/loss from current price
  const pnlFromEntry = useMemo(() => {
    if (!currentPrice) return null;
    const diff = isLong ? currentPrice - entryPrice : entryPrice - currentPrice;
    const pct = (diff / entryPrice) * 100;
    return { diff, pct, isProfit: diff >= 0 };
  }, [currentPrice, entryPrice, isLong]);

  return (
    <div className={cn(
      "bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className={cn(
        "px-3 py-2 flex items-center justify-between",
        isLong ? "bg-profit/20" : "bg-loss/20"
      )}>
        <div className="flex items-center gap-2">
          {isLong ? (
            <TrendingUp className="w-4 h-4 text-profit" />
          ) : (
            <TrendingDown className="w-4 h-4 text-loss" />
          )}
          <span className="font-bold text-sm">{symbol}</span>
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded font-medium",
            isLong ? "bg-profit/30 text-profit" : "bg-loss/30 text-loss"
          )}>
            {recommendation}
          </span>
          <span className="text-xs text-muted-foreground">
            {confidence}% conf
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Chart Area */}
      <div className="relative h-48 mx-3 my-2">
        {/* Background grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="border-t border-border/30 w-full" />
          ))}
        </div>

        {/* Profit Zone (Green) */}
        <div
          className={cn(
            "absolute left-0 right-12 rounded-r opacity-20",
            isLong ? "bg-profit" : "bg-loss"
          )}
          style={{
            top: `${chartData.profitZone.top}%`,
            height: `${Math.abs(chartData.profitZone.height)}%`,
          }}
        />

        {/* Risk Zone (Red) */}
        <div
          className={cn(
            "absolute left-0 right-12 rounded-r opacity-20",
            isLong ? "bg-loss" : "bg-profit"
          )}
          style={{
            top: `${chartData.riskZone.top}%`,
            height: `${Math.abs(chartData.riskZone.height)}%`,
          }}
        />

        {/* Take Profit Line */}
        <div
          className="absolute left-0 right-0 flex items-center group"
          style={{ top: `${chartData.tpY}%` }}
        >
          <div className="flex-1 border-t-2 border-dashed border-profit" />
          <div className="flex items-center gap-1 px-2 py-0.5 bg-profit text-profit-foreground rounded text-[10px] font-bold shadow-lg">
            <TrendingUp className="w-3 h-3" />
            TP
          </div>
        </div>

        {/* Entry Price Line */}
        <div
          className="absolute left-0 right-0 flex items-center group z-10"
          style={{ top: `${chartData.entryY}%` }}
        >
          <div className="flex-1 border-t-2 border-primary" />
          <div className="flex items-center gap-1 px-2 py-0.5 bg-primary text-primary-foreground rounded text-[10px] font-bold shadow-lg">
            <Target className="w-3 h-3" />
            ENTRY
          </div>
        </div>

        {/* Stop Loss Line */}
        <div
          className="absolute left-0 right-0 flex items-center group"
          style={{ top: `${chartData.slY}%` }}
        >
          <div className="flex-1 border-t-2 border-dashed border-loss" />
          <div className="flex items-center gap-1 px-2 py-0.5 bg-loss text-loss-foreground rounded text-[10px] font-bold shadow-lg">
            <Shield className="w-3 h-3" />
            SL
          </div>
        </div>

        {/* Current Price Indicator (if available) */}
        {currentPrice && (
          <div
            className="absolute left-0 right-0 flex items-center z-20 transition-all duration-300"
            style={{ top: `${chartData.currentY}%` }}
          >
            <div className={cn(
              "flex-1 border-t-2",
              pnlFromEntry?.isProfit ? "border-profit" : "border-loss"
            )} />
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold shadow-lg animate-pulse",
              pnlFromEntry?.isProfit ? "bg-profit text-profit-foreground" : "bg-loss text-loss-foreground"
            )}>
              <DollarSign className="w-3 h-3" />
              NOW
            </div>
          </div>
        )}

        {/* Price Labels on Right */}
        <div className="absolute right-0 top-0 bottom-0 w-20 flex flex-col justify-between text-[9px] font-mono text-muted-foreground">
          <span className="text-right pr-1">{formatPrice(chartData.chartMax)}</span>
          <span className="text-right pr-1">{formatPrice(chartData.chartMin)}</span>
        </div>
      </div>

      {/* Price Details */}
      <div className="px-3 pb-3 grid grid-cols-3 gap-2">
        <div className="p-2 rounded-lg bg-profit/10 border border-profit/30 text-center">
          <TrendingUp className="w-3.5 h-3.5 mx-auto mb-1 text-profit" />
          <p className="text-[9px] text-muted-foreground mb-0.5">Take Profit</p>
          <p className="text-xs font-mono font-bold text-profit">{formatPrice(takeProfit)}</p>
        </div>
        
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 text-center">
          <Target className="w-3.5 h-3.5 mx-auto mb-1 text-primary" />
          <p className="text-[9px] text-muted-foreground mb-0.5">Entrada</p>
          <p className="text-xs font-mono font-bold">{formatPrice(entryPrice)}</p>
        </div>
        
        <div className="p-2 rounded-lg bg-loss/10 border border-loss/30 text-center">
          <Shield className="w-3.5 h-3.5 mx-auto mb-1 text-loss" />
          <p className="text-[9px] text-muted-foreground mb-0.5">Stop Loss</p>
          <p className="text-xs font-mono font-bold text-loss">{formatPrice(stopLoss)}</p>
        </div>
      </div>

      {/* Current P&L (if trading) */}
      {pnlFromEntry && (
        <div className={cn(
          "px-3 py-2 border-t border-border flex items-center justify-between",
          pnlFromEntry.isProfit ? "bg-profit/10" : "bg-loss/10"
        )}>
          <span className="text-xs text-muted-foreground">P&L Atual</span>
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-mono font-bold text-sm",
              pnlFromEntry.isProfit ? "text-profit" : "text-loss"
            )}>
              {pnlFromEntry.isProfit ? '+' : ''}{pnlFromEntry.pct.toFixed(2)}%
            </span>
            <span className={cn(
              "text-xs font-mono",
              pnlFromEntry.isProfit ? "text-profit" : "text-loss"
            )}>
              ({pnlFromEntry.isProfit ? '+' : ''}{formatPrice(Math.abs(pnlFromEntry.diff))})
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
