import { Link, useNavigate } from 'react-router-dom';
import { Settings, Wifi, WifiOff, FlaskConical, Volume2, VolumeX, LogOut, BarChart3, Wallet, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import type { BotStats, BotConfig } from '@/types/trading';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { useBybitAccount } from '@/hooks/useBybitAccount';

interface HeaderProps {
  stats: BotStats;
  config: BotConfig;
  onToggleBot: () => void;
  connectionStatus?: ReactNode;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  onSignOut?: () => void;
  userEmail?: string;
}

export const Header = ({ 
  stats, 
  config, 
  onToggleBot, 
  connectionStatus,
  voiceEnabled = true,
  onToggleVoice,
  onSignOut,
  userEmail
}: HeaderProps) => {
  const navigate = useNavigate();
  const { loading, wallet, isRealMode, toggleMode, refreshData } = useBybitAccount();
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

        {/* Mode Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMode}
          className={cn(
            "h-7 px-2 text-[10px] md:text-xs font-semibold transition-all",
            isRealMode 
              ? "border-profit bg-profit/10 text-profit hover:bg-profit/20" 
              : "border-warning bg-warning/10 text-warning hover:bg-warning/20"
          )}
        >
          {isRealMode ? '🟢 REAL' : '🟡 DEMO'}
        </Button>

        {/* Balance Indicator */}
        {isRealMode && (
          <div className="hidden md:flex items-center gap-1.5 bg-muted/30 rounded-lg px-2 py-1">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : wallet ? (
              <span className="text-xs font-mono font-semibold">
                ${wallet.totalEquity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">--</span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0"
              onClick={refreshData}
              disabled={loading}
            >
              <RefreshCw className={cn("w-3 h-3 text-muted-foreground", loading && "animate-spin")} />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn(
            "status-badge text-[10px] md:text-xs px-1.5 py-0.5",
            isRunning ? "status-badge-active" : "status-badge-paused"
          )}>
            {stats.status}
          </span>
        </div>
        <div className="hidden sm:block">
          {connectionStatus}
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-4 font-mono text-xs">
        {isRealMode ? (
          // Real mode - show actual wallet data
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Conta</span>
              <span className="profit-text font-semibold">
                ${wallet?.totalEquity.toLocaleString('en-US', { maximumFractionDigits: 0 }) ?? '--'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">P&L</span>
              <span className={cn(
                "font-semibold",
                (wallet?.totalPnL ?? 0) >= 0 ? "profit-text" : "loss-text"
              )}>
                {wallet?.totalPnL !== undefined 
                  ? `$${wallet.totalPnL.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : '--'
                }
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Trades</span>
              <span className="text-foreground font-semibold">{stats.totalTrades}</span>
            </div>
          </>
        ) : (
          // Demo mode - show simulated stats
          <>
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
          </>
        )}
      </div>

      <div className="flex items-center gap-1 md:gap-1.5">
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
            <Button 
              variant="default"
              size="icon" 
              className="h-8 w-8"
              onClick={() => navigate('/performance')}
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Performance</TooltipContent>
        </Tooltip>

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

        {onToggleVoice && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={voiceEnabled ? "secondary" : "ghost"}
                size="icon" 
                className="h-8 w-8"
                onClick={onToggleVoice}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{voiceEnabled ? 'Voz ON' : 'Voz OFF'}</TooltipContent>
          </Tooltip>
        )}

        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
        </Button>

        {onSignOut && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={onSignOut}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sair{userEmail ? ` (${userEmail})` : ''}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  );
};