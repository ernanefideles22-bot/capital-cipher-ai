import { TrendingUp, Target, BarChart3, Shield, Activity, Zap } from 'lucide-react';
import type { BotStats } from '@/types/trading';
import { cn } from '@/lib/utils';

interface StatsGridProps {
  stats: BotStats;
}

export const StatsGrid = ({ stats }: StatsGridProps) => {
  const metrics = [
    {
      label: 'P&L Diário',
      value: stats.dailyPnL,
      format: 'currency',
      icon: TrendingUp,
      isPositive: stats.dailyPnL >= 0,
    },
    {
      label: 'P&L Semanal',
      value: stats.weeklyPnL,
      format: 'currency',
      icon: BarChart3,
      isPositive: stats.weeklyPnL >= 0,
    },
    {
      label: 'P&L Mensal',
      value: stats.monthlyPnL,
      format: 'currency',
      icon: Target,
      isPositive: stats.monthlyPnL >= 0,
    },
    {
      label: 'Taxa de Acerto',
      value: stats.winRate,
      format: 'percentage',
      icon: Activity,
      threshold: 60,
    },
    {
      label: 'Sharpe Ratio',
      value: stats.sharpeRatio,
      format: 'number',
      icon: Zap,
      threshold: 1.5,
    },
    {
      label: 'Profit Factor',
      value: stats.profitFactor,
      format: 'number',
      icon: Shield,
      threshold: 1.5,
    },
  ];

  const formatValue = (value: number, format: string) => {
    switch (format) {
      case 'currency':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toFixed(2);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const isGood = 'isPositive' in metric 
          ? metric.isPositive 
          : metric.value >= (metric.threshold || 0);
        
        return (
          <div key={metric.label} className="metric-card group hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="metric-label">{metric.label}</span>
              <Icon className={cn(
                "w-4 h-4 transition-colors",
                isGood ? "text-profit" : "text-loss"
              )} />
            </div>
            <span className={cn(
              "metric-value",
              metric.format === 'currency' && (isGood ? "profit-text" : "loss-text")
            )}>
              {metric.format === 'currency' && metric.value >= 0 ? '+' : ''}
              {formatValue(metric.value, metric.format)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
