import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Target, AlertTriangle, DollarSign, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Position {
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealisedPnl: string;
  leverage: string;
  positionValue: string;
  liqPrice: string;
  stopLoss?: string;
  takeProfit?: string;
}

interface FloatingPositionChartProps {
  position: Position;
  onClose?: () => void;
  className?: string;
}

export const FloatingPositionChart = ({
  position,
  onClose,
  className,
}: FloatingPositionChartProps) => {
  const entryPrice = parseFloat(position.entryPrice);
  const markPrice = parseFloat(position.markPrice);
  const liqPrice = parseFloat(position.liqPrice) || 0;
  const pnl = parseFloat(position.unrealisedPnl);
  const isLong = position.side === 'Buy';
  const leverage = position.leverage || '1';
  
  // Calculate chart range and positions
  const chartData = useMemo(() => {
    const prices = [entryPrice, markPrice];
    if (liqPrice > 0) prices.push(liqPrice);
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || maxPrice * 0.1;
    const padding = range * 0.2;
    
    const chartMin = minPrice - padding;
    const chartMax = maxPrice + padding;
    const chartRange = chartMax - chartMin;
    
    // Calculate Y positions (inverted: higher price = lower Y)
    const getY = (p: number) => ((chartMax - p) / chartRange) * 100;
    
    // Calculate profit zone
    const profitZone = isLong
      ? { top: 0, height: getY(entryPrice) }
      : { top: getY(entryPrice), height: 100 - getY(entryPrice) };
    
    // Calculate loss zone
    const lossZone = isLong
      ? { top: getY(entryPrice), height: liqPrice > 0 ? getY(liqPrice) - getY(entryPrice) : 100 - getY(entryPrice) }
      : { top: liqPrice > 0 ? getY(liqPrice) : 0, height: getY(entryPrice) - (liqPrice > 0 ? getY(liqPrice) : 0) };
    
    return {
      chartMin,
      chartMax,
      entryY: getY(entryPrice),
      markY: getY(markPrice),
      liqY: liqPrice > 0 ? getY(liqPrice) : null,
      profitZone,
      lossZone,
      priceChange: ((markPrice - entryPrice) / entryPrice) * 100,
    };
  }, [entryPrice, markPrice, liqPrice, isLong]);

  const formatPrice = (p: number) => {
    if (p >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${p.toFixed(p < 1 ? 6 : 2)}`;
  };

  const pnlPercent = useMemo(() => {
    const posValue = parseFloat(position.positionValue) || (entryPrice * parseFloat(position.size));
    if (posValue === 0) return 0;
    return (pnl / posValue) * 100 * parseFloat(leverage);
  }, [pnl, position.positionValue, position.size, entryPrice, leverage]);

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
          <span className="font-bold text-sm">{position.symbol}</span>
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded font-medium",
            isLong ? "bg-profit/30 text-profit" : "bg-loss/30 text-loss"
          )}>
            {isLong ? 'LONG' : 'SHORT'}
          </span>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted/50 rounded">
            {leverage}x
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
      <div className="relative h-40 mx-3 my-2">
        {/* Background grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="border-t border-border/30 w-full" />
          ))}
        </div>

        {/* Profit Zone */}
        <div
          className="absolute left-0 right-12 rounded-r bg-profit/15"
          style={{
            top: `${chartData.profitZone.top}%`,
            height: `${Math.min(chartData.profitZone.height, 100)}%`,
          }}
        />

        {/* Loss Zone */}
        <div
          className="absolute left-0 right-12 rounded-r bg-loss/15"
          style={{
            top: `${chartData.lossZone.top}%`,
            height: `${Math.min(chartData.lossZone.height, 100 - chartData.lossZone.top)}%`,
          }}
        />

        {/* Liquidation Line (if exists) */}
        {chartData.liqY !== null && (
          <div
            className="absolute left-0 right-0 flex items-center group"
            style={{ top: `${chartData.liqY}%` }}
          >
            <div className="flex-1 border-t-2 border-dashed border-orange-500" />
            <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white rounded text-[10px] font-bold shadow-lg">
              <AlertTriangle className="w-3 h-3" />
              LIQ
            </div>
          </div>
        )}

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

        {/* Current/Mark Price Line (animated) */}
        <div
          className="absolute left-0 right-0 flex items-center z-20 transition-all duration-500"
          style={{ top: `${chartData.markY}%` }}
        >
          <div className={cn(
            "flex-1 border-t-2",
            pnl >= 0 ? "border-profit" : "border-loss"
          )} />
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold shadow-lg",
            pnl >= 0 ? "bg-profit text-profit-foreground" : "bg-loss text-loss-foreground"
          )}>
            <DollarSign className="w-3 h-3" />
            <span className="animate-pulse">AGORA</span>
          </div>
        </div>

        {/* Visual price path line */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ right: '48px' }}>
          <defs>
            <linearGradient id={`gradient-${position.symbol}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={pnl >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={pnl >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line 
            x1="20%" 
            y1={`${chartData.entryY}%`} 
            x2="80%" 
            y2={`${chartData.markY}%`}
            stroke={pnl >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
            strokeWidth="3"
            strokeLinecap="round"
            className="drop-shadow-lg"
          />
          {/* Arrow at current price */}
          <circle 
            cx="80%" 
            cy={`${chartData.markY}%`} 
            r="6"
            fill={pnl >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
            className="animate-pulse"
          />
        </svg>

        {/* Price Labels on Right */}
        <div className="absolute right-0 top-0 bottom-0 w-16 flex flex-col justify-between text-[9px] font-mono text-muted-foreground">
          <span className="text-right pr-1">{formatPrice(chartData.chartMax)}</span>
          <span className="text-right pr-1">{formatPrice(chartData.chartMin)}</span>
        </div>
      </div>

      {/* Price Details */}
      <div className="px-3 pb-2 grid grid-cols-3 gap-2">
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 text-center">
          <Target className="w-3.5 h-3.5 mx-auto mb-1 text-primary" />
          <p className="text-[9px] text-muted-foreground mb-0.5">Entrada</p>
          <p className="text-xs font-mono font-bold">{formatPrice(entryPrice)}</p>
        </div>
        
        <div className={cn(
          "p-2 rounded-lg border text-center",
          pnl >= 0 ? "bg-profit/10 border-profit/30" : "bg-loss/10 border-loss/30"
        )}>
          <DollarSign className={cn("w-3.5 h-3.5 mx-auto mb-1", pnl >= 0 ? "text-profit" : "text-loss")} />
          <p className="text-[9px] text-muted-foreground mb-0.5">Atual</p>
          <p className={cn("text-xs font-mono font-bold", pnl >= 0 ? "text-profit" : "text-loss")}>
            {formatPrice(markPrice)}
          </p>
        </div>
        
        {liqPrice > 0 ? (
          <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-center">
            <AlertTriangle className="w-3.5 h-3.5 mx-auto mb-1 text-orange-500" />
            <p className="text-[9px] text-muted-foreground mb-0.5">Liquidação</p>
            <p className="text-xs font-mono font-bold text-orange-500">{formatPrice(liqPrice)}</p>
          </div>
        ) : (
          <div className="p-2 rounded-lg bg-muted/30 border border-border text-center">
            <span className="text-[9px] text-muted-foreground">Sem Liq.</span>
          </div>
        )}
      </div>

      {/* Real-time P&L */}
      <div className={cn(
        "px-3 py-2.5 border-t border-border flex items-center justify-between",
        pnl >= 0 ? "bg-profit/10" : "bg-loss/10"
      )}>
        <div>
          <span className="text-[10px] text-muted-foreground block">P&L Não Realizado</span>
          <span className="text-[9px] text-muted-foreground">
            Tamanho: {parseFloat(position.size).toFixed(4)}
          </span>
        </div>
        <div className="text-right">
          <div className={cn(
            "font-mono font-bold text-lg",
            pnl >= 0 ? "text-profit" : "text-loss"
          )}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USDT
          </div>
          <div className={cn(
            "text-xs font-mono",
            pnl >= 0 ? "text-profit" : "text-loss"
          )}>
            ({pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
          </div>
        </div>
      </div>
    </div>
  );
};
