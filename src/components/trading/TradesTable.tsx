import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Trade } from '@/types/trading';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TradesTableProps {
  trades: Trade[];
  isRealMode?: boolean;
}

const strategyColors: Record<Trade['strategy'], string> = {
  SCALP: 'bg-accent/20 text-accent border-accent/30',
  DAYTRADE: 'bg-primary/20 text-primary border-primary/30',
  SWING: 'bg-warning/20 text-warning border-warning/30',
};

export const TradesTable = ({ trades, isRealMode = false }: TradesTableProps) => {
  // In real mode, show empty trades (will populate when real trading starts)
  const recentTrades = isRealMode ? [] : trades.slice(0, 10);
  
  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Trades Recentes</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {isRealMode ? 'Trades reais da Bybit' : 'Trades simulados (Demo)'}
            </p>
          </div>
          {isRealMode && (
            <span className="text-xs px-2 py-1 rounded bg-profit/10 text-profit border border-profit/30">
              🟢 Real
            </span>
          )}
          {!isRealMode && (
            <span className="text-xs px-2 py-1 rounded bg-warning/10 text-warning border border-warning/30">
              🟡 Demo
            </span>
          )}
        </div>
      </div>
      
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-xs">Par</TableHead>
              <TableHead className="text-xs">Lado</TableHead>
              <TableHead className="text-xs">Estratégia</TableHead>
              <TableHead className="text-xs text-right">Entrada</TableHead>
              <TableHead className="text-xs text-right">Saída</TableHead>
              <TableHead className="text-xs text-right">P&L</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {isRealMode 
                    ? 'Nenhum trade real executado ainda. Os dados aparecerão quando começar a operar.'
                    : 'Nenhum trade simulado ainda.'}
                </TableCell>
              </TableRow>
            ) : (
              recentTrades.map((trade) => (
                <TableRow key={trade.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-mono font-medium">{trade.symbol}</TableCell>
                  <TableCell>
                    <div className={cn(
                      "flex items-center gap-1 text-xs font-medium",
                      trade.side === 'LONG' ? "text-profit" : "text-loss"
                    )}>
                      {trade.side === 'LONG' ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {trade.side}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs", strategyColors[trade.strategy])}>
                      {trade.strategy}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    ${trade.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {trade.exitPrice 
                      ? `$${trade.exitPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}` 
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {trade.pnl !== undefined ? (
                      <div className={cn(
                        "font-mono text-sm font-medium",
                        trade.pnl >= 0 ? "profit-text" : "loss-text"
                      )}>
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        <span className="text-xs ml-1 opacity-70">
                          ({trade.pnlPercentage?.toFixed(2)}%)
                        </span>
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      trade.status === 'OPEN' 
                        ? "bg-accent/20 text-accent border-accent/30"
                        : trade.status === 'CLOSED'
                        ? "bg-muted text-muted-foreground border-muted"
                        : "bg-loss/20 text-loss border-loss/30"
                    )}>
                      {trade.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
