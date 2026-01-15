import { Shield, AlertTriangle } from 'lucide-react';
import type { BotStats, BotConfig } from '@/types/trading';
import { cn } from '@/lib/utils';

interface DrawdownGaugeProps {
  stats: BotStats;
  config: BotConfig;
}

export const DrawdownGauge = ({ stats, config }: DrawdownGaugeProps) => {
  const percentage = (stats.currentDrawdown / config.maxDrawdown) * 100;
  const isWarning = percentage >= 70;
  const isCritical = percentage >= 90;
  
  // Calculate the stroke dasharray for the circular progress
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="glass-card p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Shield className={cn(
          "w-5 h-5",
          isCritical ? "text-loss" : isWarning ? "text-warning" : "text-profit"
        )} />
        <h3 className="font-semibold">Drawdown</h3>
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="hsl(222, 30%, 18%)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={isCritical ? "hsl(0, 72%, 51%)" : isWarning ? "hsl(38, 92%, 50%)" : "hsl(142, 76%, 45%)"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500 ease-out"
            />
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn(
              "text-2xl font-mono font-bold",
              isCritical ? "text-loss" : isWarning ? "text-warning" : "text-profit"
            )}>
              {stats.currentDrawdown.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">atual</span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Máximo Permitido</span>
          <span className="font-mono font-medium">{config.maxDrawdown}%</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Máx Histórico</span>
          <span className="font-mono font-medium text-warning">{stats.maxDrawdown}%</span>
        </div>
        
        {isWarning && (
          <div className={cn(
            "flex items-center gap-2 text-xs p-2 rounded mt-2",
            isCritical ? "bg-loss/10 text-loss" : "bg-warning/10 text-warning"
          )}>
            <AlertTriangle className="w-4 h-4" />
            {isCritical ? 'CRÍTICO: Próximo do limite!' : 'Atenção: Drawdown elevado'}
          </div>
        )}
      </div>
    </div>
  );
};
