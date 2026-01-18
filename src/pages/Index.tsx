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
import { TradingAIPanel } from '@/components/trading/TradingAIPanel';
import { LiveNewsPanel } from '@/components/trading/LiveNewsPanel';
import { AIMarketAnalysis } from '@/components/trading/AIMarketAnalysis';
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
      
      <main className="px-3 md:px-4 lg:px-6 py-3 space-y-3 max-w-[1600px] mx-auto">
        {/* Price Tickers */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.values(marketData).map((data) => (
            <PriceCard key={data.symbol} data={data} />
          ))}
        </section>

        {/* Stats Grid */}
        <section>
          <StatsGrid stats={botStats} />
        </section>

        {/* Chart + Right Panel */}
        <section className="grid grid-cols-1 xl:grid-cols-4 gap-3">
          <div className="xl:col-span-3">
            <TradingViewChart symbol="BTCUSDT" height={380} />
          </div>
          <div className="space-y-3">
            <TradingAIPanel />
            <DrawdownGauge stats={botStats} config={config} />
            <BybitConnectionPanel />
          </div>
        </section>

        {/* AI Memory Panel */}
        <section>
          <AIMemoryPanel />
        </section>

        {/* Main Content Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Column - AI Learning & Trades */}
          <div className="lg:col-span-2 space-y-3">
            <AILearningPanel />
            <TradesTable trades={trades} />
          </div>

          {/* Right Column - AI Analysis, Decisions, Config */}
          <div className="space-y-3">
            <AIMarketAnalysis 
              marketData={
                marketData['BTCUSDT'] || {
                  symbol: 'BTCUSDT',
                  price: 0,
                  change24h: 0,
                  volume24h: 0,
                  high24h: 0,
                  low24h: 0,
                }
              }
            />
            <div className="h-[240px]">
              <AIDecisionsPanel decisions={aiDecisions} />
            </div>
            <ConfigPanel config={config} onUpdateConfig={updateConfig} />
          </div>
        </section>

        {/* Logs + News */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="h-[240px]">
            <LogsPanel logs={logs} />
          </div>
          <LiveNewsPanel />
        </section>

        {/* Footer */}
        <footer className="text-center py-3 text-xs text-muted-foreground border-t border-border/50">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/performance')}
              className="gap-1.5 h-8 text-xs"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Performance
            </Button>
            <Button
              variant={voiceEnabled ? "secondary" : "outline"}
              size="sm"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className="gap-1.5 h-8 text-xs"
            >
              {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {voiceEnabled ? 'Voz ON' : 'Voz OFF'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5 h-8 text-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
          <p className="text-xs opacity-70">
            {user?.email} • {isConnected ? '🟢 Conectado' : '🟡 Demo'}
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Index;
