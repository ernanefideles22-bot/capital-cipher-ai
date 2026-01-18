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
    <div className="glass-card p-3 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <Shield className={cn(
          "w-4 h-4",
          isCritical ? "text-loss" : isWarning ? "text-warning" : "text-profit"
        )} />
        <h3 className="font-semibold text-xs">Controle de Drawdown</h3>
      </div>
      
      <div className="flex-1 flex items-center justify-center py-1">
        <div className="relative w-20 h-20">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="10"
              opacity="0.3"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={isCritical ? "hsl(var(--loss))" : isWarning ? "hsl(var(--warning))" : "hsl(var(--profit))"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500 ease-out"
            />
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn(
              "text-base font-mono font-bold",
              isCritical ? "text-loss" : isWarning ? "text-warning" : "text-profit"
            )}>
              {stats.currentDrawdown.toFixed(1)}%
            </span>
            <span className="text-[8px] text-muted-foreground uppercase tracking-wide">atual</span>
          </div>
        </div>
      </div>
      
      <div className="space-y-1 pt-1 border-t border-border/50">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Limite</span>
          <span className="font-mono font-semibold">{config.maxDrawdown}%</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Máx.</span>
          <span className="font-mono font-semibold text-warning">{stats.maxDrawdown}%</span>
        </div>
        
        {isWarning && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] p-1.5 rounded-md",
            isCritical ? "bg-loss/15 text-loss border border-loss/20" : "bg-warning/15 text-warning border border-warning/20"
          )}>
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="font-medium">
              {isCritical ? 'Limite!' : 'Elevado'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
