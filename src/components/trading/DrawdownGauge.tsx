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
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Shield className={cn(
          "w-5 h-5",
          isCritical ? "text-loss" : isWarning ? "text-warning" : "text-profit"
        )} />
        <h3 className="font-semibold text-sm">Controle de Drawdown</h3>
      </div>
      
      <div className="flex-1 flex items-center justify-center py-2">
        <div className="relative w-28 h-28">
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
              "text-xl font-mono font-bold",
              isCritical ? "text-loss" : isWarning ? "text-warning" : "text-profit"
            )}>
              {stats.currentDrawdown.toFixed(1)}%
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">atual</span>
          </div>
        </div>
      </div>
      
      <div className="space-y-2 pt-2 border-t border-border/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Limite Máximo</span>
          <span className="font-mono font-semibold">{config.maxDrawdown}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Máx. Histórico</span>
          <span className="font-mono font-semibold text-warning">{stats.maxDrawdown}%</span>
        </div>
        
        {isWarning && (
          <div className={cn(
            "flex items-center gap-2 text-xs p-2 rounded-md mt-1",
            isCritical ? "bg-loss/15 text-loss border border-loss/20" : "bg-warning/15 text-warning border border-warning/20"
          )}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium">
              {isCritical ? 'Próximo do limite!' : 'Drawdown elevado'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
