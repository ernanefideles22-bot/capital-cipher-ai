import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, Target, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FloatingPositionChart } from './FloatingPositionChart';

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
}

interface ActiveTradesWidgetProps {
  positions: Position[];
  className?: string;
}

export const ActiveTradesWidget = ({ positions, className }: ActiveTradesWidgetProps) => {
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [animatingPnl, setAnimatingPnl] = useState<Record<string, 'up' | 'down' | null>>({});
  const [prevPnl, setPrevPnl] = useState<Record<string, number>>({});

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

      {/* Individual Trades */}
      <div className="flex gap-2 flex-wrap">
        {positions.map((pos, idx) => {
          const pnl = parseFloat(pos.unrealisedPnl);
          const isLong = pos.side === 'Buy';
          const animation = animatingPnl[pos.symbol];
          const isExpanded = expandedSymbol === pos.symbol;

          return (
            <div key={pos.symbol} className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedSymbol(isExpanded ? null : pos.symbol)}
                className={cn(
                  "h-8 px-2 gap-1.5 text-xs transition-all duration-200",
                  isExpanded && "ring-2 ring-primary",
                  animation === 'up' && "animate-pulse bg-profit/20",
                  animation === 'down' && "animate-pulse bg-loss/20"
                )}
              >
                {isLong ? (
                  <TrendingUp className="w-3 h-3 text-profit" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-loss" />
                )}
                <span className="font-medium">{pos.symbol.replace('USDT', '')}</span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "h-4 px-1 text-[10px] font-mono transition-colors",
                    pnl >= 0 ? "border-profit text-profit" : "border-loss text-loss",
                    animation && "animate-bounce"
                  )}
                >
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                </Badge>
              </Button>

              {/* Floating Chart Popup */}
              {isExpanded && (
                <div className="absolute top-full left-0 mt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <FloatingPositionChart
                    position={pos}
                    onClose={() => setExpandedSymbol(null)}
                    className="w-80 shadow-2xl"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
