import { Activity, Settings, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BotStats, BotConfig } from '@/types/trading';
import { cn } from '@/lib/utils';

interface HeaderProps {
  stats: BotStats;
  config: BotConfig;
  onToggleBot: () => void;
}

export const Header = ({ stats, config, onToggleBot }: HeaderProps) => {
  const isRunning = stats.status === 'RUNNING';
  
  return (
    <header className="glass-card px-4 py-3 flex items-center justify-between gap-4 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-3 h-3 rounded-full",
            isRunning ? "bg-profit animate-pulse" : "bg-warning"
          )} />
          <h1 className="text-lg font-semibold tracking-tight">
            Institutional AI Bot
          </h1>
        </div>
        <span className={cn(
          "status-badge",
          isRunning ? "status-badge-active" : "status-badge-paused"
        )}>
          {stats.status}
        </span>
        <span className="status-badge bg-accent/20 text-accent border border-accent/30">
          {config.mode.toUpperCase()}
        </span>
      </div>

      <div className="hidden md:flex items-center gap-6 font-mono text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Win Rate</span>
          <span className="profit-text font-semibold">{stats.winRate.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">P&L Total</span>
          <span className={cn(
            "font-semibold",
            stats.totalPnL >= 0 ? "profit-text" : "loss-text"
          )}>
            ${stats.totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Drawdown</span>
          <span className="text-warning font-semibold">{stats.currentDrawdown.toFixed(1)}%</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleBot}
          className={cn(
            "gap-2 transition-all",
            isRunning 
              ? "border-profit text-profit hover:bg-profit/10" 
              : "border-warning text-warning hover:bg-warning/10"
          )}
        >
          {isRunning ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          <span className="hidden sm:inline">{isRunning ? 'Pausar' : 'Iniciar'}</span>
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
};
