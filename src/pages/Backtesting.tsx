import { Link } from 'react-router-dom';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BacktestConfig } from '@/components/backtesting/BacktestConfig';
import { BacktestStats } from '@/components/backtesting/BacktestStats';
import { EquityCurve } from '@/components/backtesting/EquityCurve';
import { MonthlyReturns } from '@/components/backtesting/MonthlyReturns';
import { TradesList } from '@/components/backtesting/TradesList';
import { PriceChart } from '@/components/backtesting/PriceChart';
import { useBacktesting } from '@/hooks/useBacktesting';

const Backtesting = () => {
  const {
    config,
    updateConfig,
    status,
    results,
    candles,
    runBacktest,
    resetBacktest,
  } = useBacktesting();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-card px-4 py-3 flex items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-accent" />
            <h1 className="text-lg font-semibold tracking-tight">
              Backtesting Visual
            </h1>
          </div>
          <span className="status-badge bg-accent/20 text-accent border border-accent/30">
            Simulador
          </span>
        </div>

        {results && (
          <div className="hidden md:flex items-center gap-6 font-mono text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Trades</span>
              <span className="text-foreground font-semibold">{results.totalTrades}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Win Rate</span>
              <span className="profit-text font-semibold">{results.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Retorno</span>
              <span className={results.totalPnL >= 0 ? "profit-text font-semibold" : "loss-text font-semibold"}>
                {results.totalPnLPercentage >= 0 ? '+' : ''}{results.totalPnLPercentage.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </header>

      <main className="container py-4 space-y-4">
        {/* Config + Quick Stats */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1">
            <BacktestConfig
              config={config}
              status={status}
              onUpdateConfig={updateConfig}
              onRunBacktest={runBacktest}
              onReset={resetBacktest}
            />
          </div>
          
          {results ? (
            <div className="lg:col-span-3">
              <BacktestStats results={results} initialCapital={config.initialCapital} />
            </div>
          ) : (
            <div className="lg:col-span-3 flex items-center justify-center glass-card rounded-xl min-h-[200px]">
              <div className="text-center text-muted-foreground">
                <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">Configure e execute o backtest</p>
                <p className="text-sm mt-1">
                  Teste suas estratégias em dados históricos antes de operar em tempo real
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Charts */}
        {results && candles.length > 0 && (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <EquityCurve results={results} initialCapital={config.initialCapital} />
              <PriceChart candles={candles} trades={results.trades} symbol={config.symbol} />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1">
                <MonthlyReturns results={results} />
              </div>
              <div className="lg:col-span-2">
                <TradesList trades={results.trades} />
              </div>
            </section>
          </>
        )}

        {/* Footer */}
        <footer className="text-center py-4 text-xs text-muted-foreground border-t border-border">
          <p>Backtesting Institucional • Simulação de estratégias em dados históricos</p>
          <p className="mt-1">⚠️ Resultados passados não garantem retornos futuros</p>
        </footer>
      </main>
    </div>
  );
};

export default Backtesting;
