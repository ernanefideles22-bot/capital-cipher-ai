import { useEffect, useState, useCallback } from 'react';
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
import { useBybitAccount } from '@/hooks/useBybitAccount';
import type { TradeResult } from '@/hooks/useTradingAI';
import type { Trade } from '@/types/trading';
import { toast } from 'sonner';

const Index = () => {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const { announceTradeOpened, announceTradeClosed } = useVoiceAlerts({ enabled: voiceEnabled });
  const { user, signOut } = useAuth();
  const { saveTrade, loadTrades, updateBotStats } = useTradesDB(user?.id);
  const [dbTradesLoaded, setDbTradesLoaded] = useState(false);
  const [realTrades, setRealTrades] = useState<Trade[]>([]);
  
  // Get mode from Bybit account hook
  const { isRealMode, wallet, positions } = useBybitAccount();
  
  const { 
    marketData, 
    botStats, 
    trades: simulatedTrades, 
    logs, 
    aiDecisions, 
    config,
    toggleBotStatus,
    updateConfig,
    isConnected,
    connectionStatus,
    connectionError,
    reconnect,
  } = useTradingData({ isRealMode });

  // Use real trades when in real mode, simulated when in demo
  const trades = isRealMode ? realTrades : simulatedTrades;

  // Load trades from database on mount (only real trades)
  useEffect(() => {
    if (user && !dbTradesLoaded) {
      loadTrades().then(({ data, error }) => {
        if (error) {
          console.error('Error loading trades:', error);
        } else if (data) {
          setRealTrades(data);
          if (data.length > 0) {
            toast.success(`${data.length} trades carregados do histórico`);
          }
        }
        setDbTradesLoaded(true);
      });
    }
  }, [user, dbTradesLoaded, loadTrades]);

  // Callback to save real trades when executed via Trading AI
  const handleRealTradeExecuted = useCallback(async (tradeResult: TradeResult) => {
    if (!isRealMode || !user || !tradeResult.executed || !tradeResult.details) {
      return;
    }

    const details = tradeResult.details;
    
    // Create a Trade object from the trade result
    const trade: Trade = {
      id: tradeResult.orderId || crypto.randomUUID(),
      symbol: details.symbol,
      side: details.side === 'Buy' ? 'LONG' : 'SHORT',
      strategy: 'SCALP', // Default strategy for AI trades
      entryPrice: details.entry,
      quantity: details.qty,
      leverage: 10, // Default leverage from config
      stopLoss: details.stopLoss || undefined,
      takeProfit: details.takeProfit || undefined,
      status: 'OPEN',
      openedAt: new Date(),
    };

    // Save to database
    const { data, error } = await saveTrade(trade, undefined, 'AI Auto-Trade');
    
    if (error) {
      console.error('Error saving real trade:', error);
      toast.error('Erro ao salvar trade no banco de dados');
    } else {
      // Add to local state
      setRealTrades(prev => [trade, ...prev]);
      toast.success(`Trade real salvo: ${trade.side} ${trade.symbol}`);
    }
  }, [isRealMode, user, saveTrade]);

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
        voiceEnabled={voiceEnabled}
        onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
        onSignOut={handleSignOut}
        userEmail={user?.email}
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
          <StatsGrid stats={botStats} isRealMode={isRealMode} walletBalance={wallet?.totalEquity} />
        </section>

        {/* Chart + Right Panel */}
        <section className="grid grid-cols-1 xl:grid-cols-4 gap-3">
          <div className="xl:col-span-3">
            <TradingViewChart symbol="BTCUSDT" height={380} />
          </div>
          <div className="space-y-3">
            <TradingAIPanel onTradeExecuted={isRealMode ? handleRealTradeExecuted : undefined} />
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
          <p className="text-xs opacity-70">
            {user?.email} • {isRealMode ? '🟢 Conta Real' : '🟡 Modo Demo'}
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Index;
