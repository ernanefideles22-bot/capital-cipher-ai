import { TrendingUp, Target, BarChart3, Shield, Activity, Zap, Wallet, BarChart2 } from 'lucide-react';
import type { BotStats } from '@/types/trading';
import { cn } from '@/lib/utils';

interface StatsGridProps {
  stats: BotStats;
  isRealMode?: boolean;
  walletBalance?: number;
}

export const StatsGrid = ({ stats, isRealMode = false, walletBalance }: StatsGridProps) => {
  const displayStats = stats;

  // Different metrics for real vs demo mode
  const metrics = isRealMode
    ? [
        // Real mode metrics
        {
          label: 'Saldo Bybit',
          value: walletBalance ?? 0,
          format: 'currency' as const,
          icon: Wallet,
          isPositive: true,
          isRealData: true,
        },
        {
          label: 'P&L Total',
          value: displayStats.totalPnL,
          format: 'currency' as const,
          icon: TrendingUp,
          isPositive: displayStats.totalPnL >= 0,
          isRealData: true,
        },
        {
          label: 'P&L Diário',
          value: displayStats.dailyPnL,
          format: 'currency' as const,
          icon: BarChart3,
          isPositive: displayStats.dailyPnL >= 0,
          isRealData: true,
        },
        {
          label: 'P&L Semanal',
          value: displayStats.weeklyPnL,
          format: 'currency' as const,
          icon: Target,
          isPositive: displayStats.weeklyPnL >= 0,
          isRealData: true,
        },
        {
          label: 'Total Trades',
          value: displayStats.totalTrades,
          format: 'number' as const,
          icon: BarChart2,
          threshold: 0,
          isRealData: true,
        },
        {
          label: 'Taxa de Acerto',
          value: displayStats.winRate,
          format: 'percentage' as const,
          icon: Activity,
          threshold: 60,
          isRealData: true,
        },
      ]
    : [
        // Demo mode metrics (simulated)
        {
          label: 'P&L Diário',
          value: displayStats.dailyPnL,
          format: 'currency' as const,
          icon: TrendingUp,
          isPositive: displayStats.dailyPnL >= 0,
        },
        {
          label: 'P&L Semanal',
          value: displayStats.weeklyPnL,
          format: 'currency' as const,
          icon: BarChart3,
          isPositive: displayStats.weeklyPnL >= 0,
        },
        {
          label: 'P&L Mensal',
          value: displayStats.monthlyPnL,
          format: 'currency' as const,
          icon: Target,
          isPositive: displayStats.monthlyPnL >= 0,
        },
        {
          label: 'Taxa de Acerto',
          value: displayStats.winRate,
          format: 'percentage' as const,
          icon: Activity,
          threshold: 60,
        },
        {
          label: 'Sharpe Ratio',
          value: displayStats.sharpeRatio,
          format: 'number' as const,
          icon: Zap,
          threshold: 1.5,
        },
        {
          label: 'Profit Factor',
          value: displayStats.profitFactor,
          format: 'number' as const,
          icon: Shield,
          threshold: 1.5,
        },
      ];

  const formatValue = (value: number, format: string) => {
    switch (format) {
      case 'currency':
        return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value.toString();
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const isGood = 'isPositive' in metric 
            ? metric.isPositive 
            : metric.value >= (metric.threshold || 0);
          const isRealData = 'isRealData' in metric ? metric.isRealData : false;
          
          return (
            <div key={metric.label} className={cn(
              "metric-card group hover:border-primary/30 transition-all",
              isRealMode && isRealData && "border-profit/30 bg-profit/5"
            )}>
              <div className="flex items-center justify-between">
                <span className="metric-label">{metric.label}</span>
                <Icon className={cn(
                  "w-4 h-4 transition-colors",
                  isRealMode && isRealData ? "text-profit" : (isGood ? "text-profit" : "text-loss")
                )} />
              </div>
              <span className={cn(
                "metric-value",
                metric.format === 'currency' && (isGood ? "profit-text" : "loss-text"),
                isRealMode && isRealData && metric.format === 'currency' && "text-profit"
              )}>
                {metric.format === 'currency' && metric.value >= 0 ? '+' : ''}
                {formatValue(metric.value, metric.format)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
