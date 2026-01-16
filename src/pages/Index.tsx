import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/trading/Header';
import { PriceCard } from '@/components/trading/PriceCard';
import { StatsGrid } from '@/components/trading/StatsGrid';
import { TradesTable } from '@/components/trading/TradesTable';
import { AIDecisionsPanel } from '@/components/trading/AIDecisionsPanel';
import { LogsPanel } from '@/components/trading/LogsPanel';
import { TradingViewChart } from '@/components/trading/TradingViewChart';
import { AILearningPanel } from '@/components/trading/AILearningPanel';
import { AIMemoryPanel } from '@/components/trading/AIMemoryPanel';
import { DrawdownGauge } from '@/components/trading/DrawdownGauge';
import { ConfigPanel } from '@/components/trading/ConfigPanel';
import { ConnectionStatus } from '@/components/trading/ConnectionStatus';
import { BybitConnectionPanel } from '@/components/trading/BybitConnectionPanel';
import { LiveNewsPanel } from '@/components/trading/LiveNewsPanel';
import { useTradingData, setVoiceAlertCallbacks } from '@/hooks/useTradingData';
import { useVoiceAlerts } from '@/hooks/useVoiceAlerts';
import { useAuth } from '@/hooks/useAuth';
import { useTradesDB } from '@/hooks/useTradesDB';
import { Volume2, VolumeX, LogOut, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Index = () => {
  const navigate = useNavigate();
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const { announceTradeOpened, announceTradeClosed } = useVoiceAlerts({ enabled: voiceEnabled });
  const { user, signOut } = useAuth();
  const { saveTrade, loadTrades, updateBotStats } = useTradesDB(user?.id);
  const [dbTradesLoaded, setDbTradesLoaded] = useState(false);
  
  const { 
    marketData, 
    botStats, 
    trades, 
    logs, 
    aiDecisions, 
    config,
    toggleBotStatus,
    updateConfig,
    isConnected,
    connectionStatus,
    connectionError,
    reconnect,
  } = useTradingData();

  // Load trades from database on mount
  useEffect(() => {
    if (user && !dbTradesLoaded) {
      loadTrades().then(({ data, error }) => {
        if (error) {
          console.error('Error loading trades:', error);
        } else if (data && data.length > 0) {
          toast.success(`${data.length} trades carregados do histórico`);
        }
        setDbTradesLoaded(true);
      });
    }
  }, [user, dbTradesLoaded, loadTrades]);

  // Save new trades to database
  useEffect(() => {
    if (!user || !dbTradesLoaded) return;
    
    // Save closed trades to database
    const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.closedAt);
    closedTrades.forEach(trade => {
      // Only save trades that are recent (within last 5 seconds)
      const isRecent = trade.closedAt && (Date.now() - trade.closedAt.getTime()) < 5000;
      if (isRecent) {
        saveTrade(trade).catch(console.error);
      }
    });
  }, [trades, user, dbTradesLoaded, saveTrade]);

  // Update bot stats in database periodically
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      updateBotStats({
        totalTrades: botStats.totalTrades,
        winCount: Math.round(botStats.totalTrades * (botStats.winRate / 100)),
        totalPnl: botStats.totalPnL,
        dailyPnl: botStats.dailyPnL,
        weeklyPnl: botStats.weeklyPnL,
        monthlyPnl: botStats.monthlyPnL,
        maxDrawdown: botStats.maxDrawdown,
      }).catch(console.error);
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [user, botStats, updateBotStats]);

  // Set up voice alert callbacks
  useEffect(() => {
    setVoiceAlertCallbacks({
      onTradeOpened: (symbol, side, confidence) => {
        if (voiceEnabled) {
          announceTradeOpened(symbol, side, confidence);
        }
      },
      onTradeClosed: (symbol, pnl, reason) => {
        if (voiceEnabled) {
          announceTradeClosed(symbol, pnl, reason);
        }
      },
    });
  }, [voiceEnabled, announceTradeOpened, announceTradeClosed]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Logout realizado com sucesso');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        stats={botStats} 
        config={config} 
        onToggleBot={toggleBotStatus}
        connectionStatus={
          <ConnectionStatus 
            status={connectionStatus}
            isConnected={isConnected}
            error={connectionError}
            onReconnect={reconnect}
          />
        }
      />
      
      <main className="container py-4 space-y-4">
        {/* Price Tickers */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.values(marketData).map((data) => (
            <PriceCard key={data.symbol} data={data} />
          ))}
        </section>

        {/* Stats Grid */}
        <section>
          <StatsGrid stats={botStats} />
        </section>

        {/* TradingView Chart */}
        <section>
          <TradingViewChart symbol="BTCUSDT" height={450} />
        </section>

        {/* AI Memory Panel - Full Width */}
        <section>
          <AIMemoryPanel />
        </section>

        {/* Main Content Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - AI Learning & Trades */}
          <div className="lg:col-span-2 space-y-4">
            <AILearningPanel />
            <TradesTable trades={trades} />
          </div>

          {/* Right Column - Bybit, AI Decisions, Drawdown, Config */}
          <div className="space-y-4">
            <BybitConnectionPanel />
            <div className="h-[280px]">
              <AIDecisionsPanel decisions={aiDecisions} />
            </div>
            <DrawdownGauge stats={botStats} config={config} />
            <ConfigPanel config={config} onUpdateConfig={updateConfig} />
          </div>
        </section>

        {/* Logs Panel */}
        <section className="h-[280px]">
          <LogsPanel logs={logs} />
        </section>

        {/* Live News Panel */}
        <section>
          <LiveNewsPanel />
        </section>

        {/* Footer */}
        <footer className="text-center py-4 text-xs text-muted-foreground border-t border-border">
          <div className="flex items-center justify-center gap-4 mb-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/performance')}
              className="gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Dashboard de Performance
            </Button>
            <Button
              variant={voiceEnabled ? "secondary" : "outline"}
              size="sm"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className="gap-2"
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {voiceEnabled ? 'Alertas de Voz ON' : 'Alertas de Voz OFF'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
          <p className="text-sm mb-1">
            Logado como: <span className="font-medium">{user?.email}</span>
          </p>
          <p>Institutional AI Trading Bot • Bybit Integration Ready</p>
          <p className="mt-1">
            {isConnected 
              ? '🟢 Conectado ao bot Python via WebSocket' 
              : '🟡 Modo demonstração - Execute o bot para dados reais'}
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Index;
