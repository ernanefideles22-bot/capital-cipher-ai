import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, Target, X, RefreshCw, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useBybitAPI } from '@/hooks/useBybitAPI';
import { toast } from 'sonner';

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

// Progress bar component for TP/SL visualization
const TPSLProgressBar = ({ position }: { position: Position }) => {
  const entryPrice = parseFloat(position.entryPrice);
  const markPrice = parseFloat(position.markPrice);
  const liqPrice = parseFloat(position.liqPrice) || 0;
  const isLong = position.side === 'Buy';
  
  // For demo, we'll simulate TP/SL based on entry price if not provided
  const stopLoss = position.stopLoss ? parseFloat(position.stopLoss) : (isLong ? entryPrice * 0.97 : entryPrice * 1.03);
  const takeProfit = position.takeProfit ? parseFloat(position.takeProfit) : (isLong ? entryPrice * 1.05 : entryPrice * 0.95);
  
  // Calculate progress between SL and TP (0% = SL, 100% = TP)
  const range = Math.abs(takeProfit - stopLoss);
  const distanceFromSL = isLong 
    ? markPrice - stopLoss 
    : stopLoss - markPrice;
  
  const progress = Math.max(0, Math.min(100, (distanceFromSL / range) * 100));
  
  // Calculate distances in percentage
  const distanceToTP = isLong 
    ? ((takeProfit - markPrice) / markPrice) * 100 
    : ((markPrice - takeProfit) / markPrice) * 100;
  const distanceToSL = isLong 
    ? ((markPrice - stopLoss) / markPrice) * 100 
    : ((stopLoss - markPrice) / markPrice) * 100;
  
  const pnl = parseFloat(position.unrealisedPnl);
  
  return (
    <div className="w-full space-y-1">
      {/* Progress bar */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        {/* Red zone (SL side) */}
        <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-loss/50 to-loss/20" />
        {/* Green zone (TP side) */}
        <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-profit/50 to-profit/20" />
        {/* Progress indicator */}
        <div 
          className={cn(
            "absolute inset-y-0 left-0 transition-all duration-500",
            progress > 50 ? "bg-profit/40" : "bg-loss/40"
          )}
          style={{ width: `${progress}%` }}
        />
        {/* Current position marker */}
        <div 
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-background shadow-lg transition-all duration-500",
            pnl >= 0 ? "bg-profit" : "bg-loss"
          )}
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>
      
      {/* Labels */}
      <div className="flex justify-between text-[9px] font-mono">
        <span className="text-loss">
          SL: {distanceToSL.toFixed(1)}%
        </span>
        <span className={cn(
          "font-medium",
          pnl >= 0 ? "text-profit" : "text-loss"
        )}>
          {progress.toFixed(0)}%
        </span>
        <span className="text-profit">
          TP: {distanceToTP.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

interface ActiveTradesWidgetProps {
  positions: Position[];
  className?: string;
  isRefreshing?: boolean;
  onPositionClosed?: () => void;
}

export const ActiveTradesWidget = ({ positions, className, isRefreshing, onPositionClosed }: ActiveTradesWidgetProps) => {
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [animatingPnl, setAnimatingPnl] = useState<Record<string, 'up' | 'down' | null>>({});
  const [prevPnl, setPrevPnl] = useState<Record<string, number>>({});
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null);
  
  const bybitAPI = useBybitAPI();

  const handleClosePosition = async (e: React.MouseEvent, position: Position) => {
    e.stopPropagation(); // Prevent card expansion
    
    const qty = parseFloat(position.size);
    const pnl = parseFloat(position.unrealisedPnl);
    
    setClosingSymbol(position.symbol);
    
    try {
      const result = await bybitAPI.closePosition(
        position.symbol, 
        position.side as 'Buy' | 'Sell', 
        qty
      );
      
      if (result?.retCode === 0) {
        toast.success(
          `${position.symbol} encerrado! P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`
        );
        onPositionClosed?.();
      } else {
        toast.error(`Erro ao encerrar ${position.symbol}: ${result?.retMsg || 'Erro desconhecido'}`);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setClosingSymbol(null);
    }
  };
  // Track P&L changes for animations
  useEffect(() => {
    const newAnimations: Record<string, 'up' | 'down' | null> = {};
    
    positions.forEach(pos => {
      const currentPnl = parseFloat(pos.unrealisedPnl);
      const previous = prevPnl[pos.symbol];
      
      if (previous !== undefined) {
        if (currentPnl > previous) {
          newAnimations[pos.symbol] = 'up';
        } else if (currentPnl < previous) {
          newAnimations[pos.symbol] = 'down';
        }
      }
    });

    setAnimatingPnl(newAnimations);
    
    // Clear animations after 500ms
    const timer = setTimeout(() => {
      setAnimatingPnl({});
    }, 500);

    // Update previous P&L
    const newPrevPnl: Record<string, number> = {};
    positions.forEach(pos => {
      newPrevPnl[pos.symbol] = parseFloat(pos.unrealisedPnl);
    });
    setPrevPnl(newPrevPnl);

    return () => clearTimeout(timer);
  }, [positions]);

  const totalPnL = positions.reduce((sum, pos) => sum + parseFloat(pos.unrealisedPnl || '0'), 0);
  const totalValue = positions.reduce((sum, pos) => sum + parseFloat(pos.positionValue || '0'), 0);

  if (positions.length === 0) {
    return null;
  }

  const formatPrice = (p: number) => {
    if (Math.abs(p) >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${p.toFixed(2)}`;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Summary Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-xs font-medium">{positions.length} Trade{positions.length > 1 ? 's' : ''} Ativo{positions.length > 1 ? 's' : ''}</span>
          {isRefreshing && (
            <RefreshCw className="w-3 h-3 text-primary animate-spin" />
          )}
        </div>
        
        <div className="h-4 w-px bg-border" />
        
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Valor:</span>
          <span className="text-xs font-mono font-medium">{formatPrice(totalValue)}</span>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-300",
          totalPnL >= 0 ? "bg-profit/20" : "bg-loss/20"
        )}>
          {totalPnL >= 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-profit" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-loss" />
          )}
          <span className="text-xs text-muted-foreground">P&L Total:</span>
          <span className={cn(
            "text-sm font-mono font-bold transition-all",
            totalPnL >= 0 ? "text-profit" : "text-loss"
          )}>
            {totalPnL >= 0 ? '+' : ''}{formatPrice(totalPnL)}
          </span>
        </div>
      </div>

      {/* Individual Trades with Progress Bars */}
      <div className="space-y-2">
        {positions.map((pos) => {
          const pnl = parseFloat(pos.unrealisedPnl);
          const isLong = pos.side === 'Buy';
          const animation = animatingPnl[pos.symbol];
          const isExpanded = expandedSymbol === pos.symbol;
          const leverage = pos.leverage || '1';

          return (
            <div key={pos.symbol} className="relative">
              {/* Trade Card with Progress */}
              <div
                onClick={() => setExpandedSymbol(isExpanded ? null : pos.symbol)}
                className={cn(
                  "p-2 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md",
                  isExpanded && "ring-2 ring-primary",
                  animation === 'up' && "animate-pulse bg-profit/10 border-profit/50",
                  animation === 'down' && "animate-pulse bg-loss/10 border-loss/50",
                  !animation && (pnl >= 0 ? "bg-profit/5 border-profit/30" : "bg-loss/5 border-loss/30")
                )}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isLong ? (
                      <TrendingUp className="w-4 h-4 text-profit" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-loss" />
                    )}
                    <span className="font-bold text-sm">{pos.symbol.replace('USDT', '')}</span>
                    <Badge variant="outline" className={cn(
                      "h-4 px-1 text-[10px]",
                      isLong ? "border-profit text-profit" : "border-loss text-loss"
                    )}>
                      {isLong ? 'LONG' : 'SHORT'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground bg-muted/50 px-1 rounded">
                      {leverage}x
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className={cn(
                        "font-mono font-bold text-sm transition-all",
                        pnl >= 0 ? "text-profit" : "text-loss",
                        animation && "scale-110"
                      )}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USDT
                      </span>
                    </div>
                    
                    {/* Close Position Button - Simple X */}
                    <button
                      onClick={(e) => handleClosePosition(e, pos)}
                      disabled={closingSymbol === pos.symbol}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-loss/20 text-muted-foreground hover:text-loss transition-colors disabled:opacity-50"
                      title="Encerrar"
                    >
                      {closingSymbol === pos.symbol ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
                
                {/* TP/SL Progress Bar */}
                <TPSLProgressBar position={pos} />
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
