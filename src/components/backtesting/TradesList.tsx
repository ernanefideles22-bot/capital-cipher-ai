import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { List, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { BacktestTrade } from '@/types/backtesting';
import { cn } from '@/lib/utils';

interface TradesListProps {
  trades: BacktestTrade[];
}

export const TradesList = ({ trades }: TradesListProps) => {
  const sortedTrades = [...trades].reverse().slice(0, 50);

  return (
    <Card className="glass-card h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <List className="w-4 h-4 text-accent" />
            Histórico de Trades
          </span>
          <span className="text-xs text-muted-foreground font-normal">
            Últimos {sortedTrades.length} de {trades.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="space-y-1 p-4 pt-0">
            {sortedTrades.map((trade) => (
              <div
                key={trade.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg",
                  "bg-card/50 border border-border/50 hover:border-border",
                  "transition-colors"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    trade.side === 'LONG' 
                      ? "bg-profit/20 text-profit" 
                      : "bg-loss/20 text-loss"
                  )}>
                    {trade.side === 'LONG' 
                      ? <ArrowUpRight className="w-4 h-4" />
                      : <ArrowDownRight className="w-4 h-4" />
                    }
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{trade.side}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {trade.strategy}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {trade.entryTime.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      ${trade.entryPrice.toFixed(0)} → ${trade.exitPrice.toFixed(0)}
                    </span>
                    <span className={cn(
                      "font-mono font-semibold text-sm",
                      trade.pnl >= 0 ? "text-profit" : "text-loss"
                    )}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {((trade.exitTime.getTime() - trade.entryTime.getTime()) / 3600000).toFixed(1)}h
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
