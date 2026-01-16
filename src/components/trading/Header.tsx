import { Link } from 'react-router-dom';
import { Activity, Settings, Wifi, WifiOff, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { BotStats, BotConfig } from '@/types/trading';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface HeaderProps {
  stats: BotStats;
  config: BotConfig;
  onToggleBot: () => void;
  connectionStatus?: ReactNode;
}

export const Header = ({ stats, config, onToggleBot, connectionStatus }: HeaderProps) => {
  const isRunning = stats.status === 'RUNNING';
  
  return (
    <header className="glass-card px-3 md:px-4 py-2.5 flex items-center justify-between gap-2 md:gap-4 sticky top-0 z-50">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0",
            isRunning ? "bg-profit animate-pulse" : "bg-warning"
          )} />
          <h1 className="text-sm md:text-base font-semibold tracking-tight whitespace-nowrap">
            AI Bot
          </h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn(
            "status-badge text-[10px] md:text-xs px-1.5 py-0.5",
            isRunning ? "status-badge-active" : "status-badge-paused"
          )}>
            {stats.status}
          </span>
          <span className="status-badge text-[10px] md:text-xs px-1.5 py-0.5 bg-accent/20 text-accent border border-accent/30">
            {config.mode.toUpperCase()}
          </span>
        </div>
        <div className="hidden sm:block">
          {connectionStatus}
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-4 font-mono text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Win</span>
          <span className="profit-text font-semibold">{stats.winRate.toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">P&L</span>
          <span className={cn(
            "font-semibold",
            stats.totalPnL >= 0 ? "profit-text" : "loss-text"
          )}>
            ${stats.totalPnL.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">DD</span>
          <span className="text-warning font-semibold">{stats.currentDrawdown.toFixed(1)}%</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleBot}
          className={cn(
            "gap-1.5 h-8 px-2 md:px-3 text-xs transition-all",
            isRunning 
              ? "border-profit text-profit hover:bg-profit/10" 
              : "border-warning text-warning hover:bg-warning/10"
          )}
        >
          {isRunning ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isRunning ? 'Pausar' : 'Iniciar'}</span>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link to="/backtesting">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-accent">
                <FlaskConical className="w-4 h-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Backtesting</TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
};
