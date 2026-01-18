import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { ConnectionStatus } from '@/components/trading/ConnectionStatus';
import { TradingAIPanel } from '@/components/trading/TradingAIPanel';
import { LiveNewsPanel } from '@/components/trading/LiveNewsPanel';
import { AIMarketAnalysis } from '@/components/trading/AIMarketAnalysis';
import { useTradingData, setVoiceAlertCallbacks } from '@/hooks/useTradingData';
import { useRealTradingData } from '@/hooks/useRealTradingData';
import { useVoiceAlerts } from '@/hooks/useVoiceAlerts';
import { useAuth } from '@/hooks/useAuth';
import { useBybitAccount } from '@/hooks/useBybitAccount';
import type { TradeResult } from '@/hooks/useTradingAI';
import type { Trade, BotStats } from '@/types/trading';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Settings, Play, Pause } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const { announceTradeOpened, announceTradeClosed } = useVoiceAlerts({ enabled: voiceEnabled });
  const { user, signOut } = useAuth();
  
  // Get mode from Bybit account hook
  const { isRealMode, wallet, positions, refreshData: refreshBybit, loading: bybitLoading } = useBybitAccount();
  
  // DEMO mode data - simulated
  const { 
    marketData: demoMarketData, 
    botStats: demoStats, 
    trades: demoTrades, 
    logs: demoLogs, 
    aiDecisions: demoDecisions, 
    config,
    toggleBotStatus: demoToggleBot,
    updateConfig,
    isConnected,
    connectionStatus,
    connectionError,
    reconnect,
    clearLogs: demoClearLogs,
  } = useTradingData({ isRealMode });

  // REAL mode data - from database and Bybit
  const realData = useRealTradingData(user?.id);

  // Memoized data selection based on mode
  const trades = useMemo(() => isRealMode ? realData.trades : demoTrades, [isRealMode, realData.trades, demoTrades]);
  const logs = useMemo(() => isRealMode ? realData.logs : demoLogs, [isRealMode, realData.logs, demoLogs]);
  const aiDecisions = useMemo(() => isRealMode ? realData.aiDecisions : demoDecisions, [isRealMode, realData.aiDecisions, demoDecisions]);
  
  // Stats - combine wallet data with real trade stats when in real mode
  const botStats = useMemo((): BotStats => {
    if (isRealMode) {
      return {
        ...realData.stats,
        totalPnL: wallet?.totalPnL ?? realData.stats.totalPnL,
      };
    }
    return demoStats;
  }, [isRealMode, realData.stats, demoStats, wallet]);

  // Market data - use demo data for now (could integrate Bybit API later)
  const marketData = useMemo(() => {
    // Always use market data from the simulation for now
    // Real mode could fetch from Bybit API if needed
    return demoMarketData;
  }, [demoMarketData]);

  // Toggle bot status based on mode
  const toggleBotStatus = useCallback(() => {
    if (isRealMode) {
      realData.setBotStatus(botStats.status === 'RUNNING' ? 'PAUSED' : 'RUNNING');
    } else {
      demoToggleBot();
    }
  }, [isRealMode, realData, botStats.status, demoToggleBot]);

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
      strategy: 'SCALP',
      entryPrice: details.entry,
      quantity: details.qty,
      leverage: config.leverage,
      stopLoss: details.stopLoss || undefined,
      takeProfit: details.takeProfit || undefined,
      status: 'OPEN',
      openedAt: new Date(),
    };

    // Add AI decision
    realData.addAIDecision({
      symbol: trade.symbol,
      action: trade.side === 'LONG' ? 'BUY' : 'SELL',
      confidence: 75,
      reasoning: `Trade executado via IA: ${trade.side} @ $${trade.entryPrice.toFixed(2)}`,
      indicators: {
        institutionalFlow: 0,
        volumeCluster: false,
        trendStrength: 0,
        riskScore: 0,
      },
    });

    // Save to database
    const { error } = await realData.addTrade(trade, 75, 'AI Auto-Trade');
    
    if (error) {
      toast.error('Erro ao salvar trade no banco de dados');
    } else {
      toast.success(`Trade real executado: ${trade.side} ${trade.symbol}`);
      
      // Refresh Bybit data
      refreshBybit();
    }
  }, [isRealMode, user, realData, config.leverage, refreshBybit]);

  // Voice alert callbacks
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

  // Reload real trades when switching to real mode
  useEffect(() => {
    if (isRealMode && user) {
      realData.loadTrades();
      refreshBybit();
    }
  }, [isRealMode, user]);

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
            isConnected={isRealMode ? !!wallet : isConnected}
            error={connectionError}
            onReconnect={isRealMode ? refreshBybit : reconnect}
          />
        }
        voiceEnabled={voiceEnabled}
        onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
        onSignOut={handleSignOut}
        userEmail={user?.email}
      />
      
      <main className="px-3 md:px-4 lg:px-6 py-3 space-y-3 max-w-[1600px] mx-auto">
        {/* Mode Indicator Banner with Bot Control */}
        {isRealMode && (
          <div className="bg-profit/10 border border-profit/30 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-profit" />
              <span className="text-sm font-medium text-profit">
                Modo Conta Real - Operações reais na Bybit
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={botStats.status === 'RUNNING' ? 'destructive' : 'default'}
                onClick={toggleBotStatus}
                className="h-7 px-3 gap-1.5"
              >
                {botStats.status === 'RUNNING' ? (
                  <>
                    <Pause className="w-3 h-3" />
                    Parar
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    Iniciar
                  </>
                )}
              </Button>
              <Badge variant="outline" className="border-profit text-profit">
                Saldo: ${wallet?.totalEquity.toLocaleString('en-US', { maximumFractionDigits: 2 }) ?? '--'}
              </Badge>
            </div>
          </div>
        )}

        {!isRealMode && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning" />
              <span className="text-sm font-medium text-warning">
                Modo Demo - Dados simulados para teste
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={botStats.status === 'RUNNING' ? 'destructive' : 'default'}
                onClick={toggleBotStatus}
                className="h-7 px-3 gap-1.5"
              >
                {botStats.status === 'RUNNING' ? (
                  <>
                    <Pause className="w-3 h-3" />
                    Parar
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    Iniciar
                  </>
                )}
              </Button>
              <Badge variant="outline" className="border-warning text-warning">
                Simulação
              </Badge>
            </div>
          </div>
        )}

        {/* Settings Button - Top */}
        <section>
          <Button 
            variant="outline" 
            onClick={() => navigate('/settings')}
            className="w-full justify-start gap-2 bg-card/50"
          >
            <Settings className="w-4 h-4" />
            Configurações do Bot
          </Button>
        </section>

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
          </div>
        </section>

        {/* AI Memory Panel - Only visible in demo mode */}
        {!isRealMode && (
          <section>
            <AIMemoryPanel isRealMode={isRealMode} />
          </section>
        )}

        {/* Main Content Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Column - AI Learning & Trades */}
          <div className="lg:col-span-2 space-y-3">
            {/* AI Learning Panel - Only visible in demo mode */}
            <AILearningPanel isRealMode={isRealMode} />
            <TradesTable trades={trades} isRealMode={isRealMode} />
          </div>

          {/* Right Column - AI Analysis, Decisions */}
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
              <AIDecisionsPanel decisions={aiDecisions} isRealMode={isRealMode} />
            </div>
          </div>
        </section>

        {/* Logs + News */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="h-[240px]">
            <LogsPanel 
              logs={logs} 
              isRealMode={isRealMode} 
              onClearLogs={isRealMode ? realData.clearLogs : demoClearLogs}
            />
          </div>
          <LiveNewsPanel />
        </section>

        {/* Footer */}
        <footer className="text-center py-3 text-xs text-muted-foreground border-t border-border/50">
          <p className="text-xs opacity-70">
            {user?.email} • {isRealMode ? '🟢 Conta Real (Bybit)' : '🟡 Modo Demo (Simulação)'}
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Index;
