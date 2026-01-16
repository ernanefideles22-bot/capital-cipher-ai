import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  BarChart3, 
  Clock, 
  Percent,
  DollarSign,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BacktestResults } from '@/types/backtesting';
import { cn } from '@/lib/utils';

interface BacktestStatsProps {
  results: BacktestResults;
  initialCapital: number;
}

export const BacktestStats = ({ results, initialCapital }: BacktestStatsProps) => {
  const stats = [
    {
      label: 'Total de Trades',
      value: results.totalTrades.toString(),
      subValue: `${results.winningTrades}W / ${results.losingTrades}L`,
      icon: BarChart3,
      color: 'text-accent',
    },
    {
      label: 'Win Rate',
      value: `${results.winRate.toFixed(1)}%`,
      subValue: `Profit Factor: ${results.profitFactor.toFixed(2)}`,
      icon: Target,
      color: results.winRate >= 50 ? 'text-profit' : 'text-loss',
    },
    {
      label: 'P&L Total',
      value: `$${results.totalPnL.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      subValue: `${results.totalPnLPercentage >= 0 ? '+' : ''}${results.totalPnLPercentage.toFixed(1)}%`,
      icon: results.totalPnL >= 0 ? TrendingUp : TrendingDown,
      color: results.totalPnL >= 0 ? 'text-profit' : 'text-loss',
    },
    {
      label: 'Max Drawdown',
      value: `${results.maxDrawdownPercentage.toFixed(1)}%`,
      subValue: `$${results.maxDrawdown.toFixed(0)}`,
      icon: TrendingDown,
      color: results.maxDrawdownPercentage > 15 ? 'text-loss' : 'text-warning',
    },
    {
      label: 'Sharpe Ratio',
      value: results.sharpeRatio.toFixed(2),
      subValue: `Sortino: ${results.sortinoRatio.toFixed(2)}`,
      icon: Activity,
      color: results.sharpeRatio >= 1 ? 'text-profit' : results.sharpeRatio >= 0.5 ? 'text-warning' : 'text-loss',
    },
    {
      label: 'Média Win/Loss',
      value: `$${results.averageWin.toFixed(0)}`,
      subValue: `Loss: -$${results.averageLoss.toFixed(0)}`,
      icon: DollarSign,
      color: results.averageWin > results.averageLoss ? 'text-profit' : 'text-loss',
    },
    {
      label: 'Maior Win',
      value: `$${results.largestWin.toFixed(0)}`,
      subValue: `Loss: -$${Math.abs(results.largestLoss).toFixed(0)}`,
      icon: TrendingUp,
      color: 'text-profit',
    },
    {
      label: 'Tempo Médio',
      value: `${results.averageHoldingTime.toFixed(1)}h`,
      subValue: `Comissões: $${results.totalCommissions.toFixed(0)}`,
      icon: Clock,
      color: 'text-muted-foreground',
    },
  ];

  const finalCapital = initialCapital + results.totalPnL;
  const returnMultiple = finalCapital / initialCapital;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" />
            Estatísticas do Backtest
          </span>
          <span className={cn(
            "text-sm font-mono",
            results.totalPnL >= 0 ? "text-profit" : "text-loss"
          )}>
            ${initialCapital.toLocaleString()} → ${finalCapital.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            <span className="text-xs ml-2 opacity-70">
              ({returnMultiple.toFixed(2)}x)
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div 
              key={stat.label}
              className="bg-card/50 rounded-lg p-3 border border-border/50"
            >
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={cn("w-4 h-4", stat.color)} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <div className={cn("text-lg font-semibold font-mono", stat.color)}>
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground">
                {stat.subValue}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
