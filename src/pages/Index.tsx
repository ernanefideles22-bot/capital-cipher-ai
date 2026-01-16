import { Header } from '@/components/trading/Header';
import { PriceCard } from '@/components/trading/PriceCard';
import { StatsGrid } from '@/components/trading/StatsGrid';
import { TradesTable } from '@/components/trading/TradesTable';
import { AIDecisionsPanel } from '@/components/trading/AIDecisionsPanel';
import { LogsPanel } from '@/components/trading/LogsPanel';
import { TradingViewChart } from '@/components/trading/TradingViewChart';
import { AILearningPanel } from '@/components/trading/AILearningPanel';
import { DrawdownGauge } from '@/components/trading/DrawdownGauge';
import { ConfigPanel } from '@/components/trading/ConfigPanel';
import { ConnectionStatus } from '@/components/trading/ConnectionStatus';
import { useTradingData } from '@/hooks/useTradingData';

const Index = () => {
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

        {/* Main Content Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - AI Learning & Trades */}
          <div className="lg:col-span-2 space-y-4">
            <AILearningPanel />
            <TradesTable trades={trades} />
          </div>

          {/* Right Column - AI Decisions, Drawdown, Config */}
          <div className="space-y-4">
            <div className="h-[320px]">
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

        {/* Footer */}
        <footer className="text-center py-4 text-xs text-muted-foreground border-t border-border">
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
