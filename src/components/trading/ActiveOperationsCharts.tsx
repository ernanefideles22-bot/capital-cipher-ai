import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Target, AlertTriangle, X, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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

interface ActiveOperationsChartsProps {
  positions: Position[];
  className?: string;
}

const MiniPositionChart = ({ position }: { position: Position }) => {
  const entryPrice = parseFloat(position.entryPrice);
  const markPrice = parseFloat(position.markPrice);
  const pnl = parseFloat(position.unrealisedPnl);
  const isLong = position.side === 'Buy';
  const leverage = position.leverage || '1';
  
  // Calculate SL and TP based on position (estimate if not provided)
  const stopLoss = position.stopLoss ? parseFloat(position.stopLoss) : 
    isLong ? entryPrice * 0.98 : entryPrice * 1.02;
  const takeProfit = position.takeProfit ? parseFloat(position.takeProfit) : 
    isLong ? entryPrice * 1.04 : entryPrice * 0.96;

  const chartData = useMemo(() => {
    const allPrices = [entryPrice, markPrice, stopLoss, takeProfit].filter(p => p > 0);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const range = maxPrice - minPrice || maxPrice * 0.05;
    const padding = range * 0.15;
    
    const chartMin = minPrice - padding;
    const chartMax = maxPrice + padding;
    const chartRange = chartMax - chartMin;
    
    const getY = (p: number) => Math.max(0, Math.min(100, ((chartMax - p) / chartRange) * 100));
    
    return {
      entryY: getY(entryPrice),
      markY: getY(markPrice),
      slY: getY(stopLoss),
      tpY: getY(takeProfit),
      priceChange: ((markPrice - entryPrice) / entryPrice) * 100,
    };
  }, [entryPrice, markPrice, stopLoss, takeProfit]);

  const formatPrice = (p: number) => {
    if (p >= 1000) return `$${(p / 1000).toFixed(1)}k`;
    if (p >= 1) return `$${p.toFixed(2)}`;
    return `$${p.toFixed(4)}`;
  };

  const pnlPercent = useMemo(() => {
    const posValue = parseFloat(position.positionValue) || (entryPrice * parseFloat(position.size));
    if (posValue === 0) return 0;
    return (pnl / posValue) * 100 * parseFloat(leverage);
  }, [pnl, position.positionValue, position.size, entryPrice, leverage]);

  return (
    <div className={cn(
      "bg-card/95 backdrop-blur-sm border rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg min-w-[200px] flex-1",
      pnl >= 0 ? "border-profit/40 shadow-profit/10" : "border-loss/40 shadow-loss/10"
    )}>
      {/* Compact Header */}
      <div className={cn(
        "px-2 py-1.5 flex items-center justify-between",
        isLong ? "bg-profit/15" : "bg-loss/15"
      )}>
        <div className="flex items-center gap-1.5">
          {isLong ? (
            <TrendingUp className="w-3 h-3 text-profit" />
          ) : (
            <TrendingDown className="w-3 h-3 text-loss" />
          )}
          <span className="font-bold text-xs">{position.symbol.replace('USDT', '')}</span>
          <Badge variant="outline" className={cn(
            "h-4 px-1 text-[9px]",
            isLong ? "border-profit/50 text-profit" : "border-loss/50 text-loss"
          )}>
            {isLong ? 'L' : 'S'}
          </Badge>
          <span className="text-[9px] text-muted-foreground">{leverage}x</span>
        </div>
        <div className={cn(
          "font-mono text-xs font-bold",
          pnl >= 0 ? "text-profit" : "text-loss"
        )}>
          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
        </div>
      </div>

      {/* Mini Chart */}
      <div className="relative h-24 px-2 py-1">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-muted/20" />
        
        {/* TP Zone (profit area) */}
        <div
          className="absolute left-2 right-10 bg-profit/10 rounded-sm"
          style={{
            top: `${Math.min(chartData.tpY, chartData.entryY)}%`,
            height: `${Math.abs(chartData.entryY - chartData.tpY)}%`,
          }}
        />

        {/* SL Zone (loss area) */}
        <div
          className="absolute left-2 right-10 bg-loss/10 rounded-sm"
          style={{
            top: `${Math.min(chartData.slY, chartData.entryY)}%`,
            height: `${Math.abs(chartData.slY - chartData.entryY)}%`,
          }}
        />

        {/* Take Profit Line */}
        <div
          className="absolute left-2 right-2 flex items-center gap-1"
          style={{ top: `${chartData.tpY}%`, transform: 'translateY(-50%)' }}
        >
          <div className="flex-1 h-px bg-profit border-t border-dashed border-profit" />
          <div className="flex items-center gap-0.5 bg-profit/20 px-1 py-0.5 rounded text-[8px] text-profit font-medium">
            <Target className="w-2 h-2" />
            TP
          </div>
        </div>

        {/* Entry Line */}
        <div
          className="absolute left-2 right-2 flex items-center gap-1"
          style={{ top: `${chartData.entryY}%`, transform: 'translateY(-50%)' }}
        >
          <div className="flex-1 h-0.5 bg-primary/80" />
          <div className="flex items-center gap-0.5 bg-primary/20 px-1 py-0.5 rounded text-[8px] text-primary font-medium">
            <Activity className="w-2 h-2" />
            E
          </div>
        </div>

        {/* Stop Loss Line */}
        <div
          className="absolute left-2 right-2 flex items-center gap-1"
          style={{ top: `${chartData.slY}%`, transform: 'translateY(-50%)' }}
        >
          <div className="flex-1 h-px bg-loss border-t border-dashed border-loss" />
          <div className="flex items-center gap-0.5 bg-loss/20 px-1 py-0.5 rounded text-[8px] text-loss font-medium">
            <AlertTriangle className="w-2 h-2" />
            SL
          </div>
        </div>

        {/* Current Price Marker */}
        <div
          className="absolute left-1 flex items-center transition-all duration-500"
          style={{ top: `${chartData.markY}%`, transform: 'translateY(-50%)' }}
        >
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse shadow-lg",
            pnl >= 0 ? "bg-profit shadow-profit/50" : "bg-loss shadow-loss/50"
          )} />
          <div className="ml-1 w-[calc(100%-20px)] h-0.5 bg-gradient-to-r from-accent/80 to-transparent" />
        </div>
      </div>

      {/* Price Info Footer */}
      <div className="px-2 py-1 border-t border-border/50 bg-muted/30">
        <div className="flex items-center justify-between text-[9px]">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              E: <span className="text-foreground font-mono">{formatPrice(entryPrice)}</span>
            </span>
            <span className="text-muted-foreground">
              Agora: <span className={cn("font-mono font-medium", pnl >= 0 ? "text-profit" : "text-loss")}>
                {formatPrice(markPrice)}
              </span>
            </span>
          </div>
          <span className={cn(
            "font-mono font-medium",
            pnlPercent >= 0 ? "text-profit" : "text-loss"
          )}>
            {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export const ActiveOperationsCharts = ({ positions, className }: ActiveOperationsChartsProps) => {
  if (positions.length === 0) return null;

  return (
    <div className={cn(
      "animate-in fade-in slide-in-from-top-2 duration-500",
      className
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-4 h-4 text-accent animate-pulse" />
        <span className="text-sm font-medium text-muted-foreground">
          Operações Ativas ({positions.length})
        </span>
      </div>
      
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {positions.map((position) => (
          <MiniPositionChart key={position.symbol} position={position} />
        ))}
      </div>
    </div>
  );
};
