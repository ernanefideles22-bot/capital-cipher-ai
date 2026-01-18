import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useTradingAI } from '@/hooks/useTradingAI';
import { 
  Bot, 
  Play, 
  Square, 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Settings,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export const TradingAIPanel = () => {
  const {
    loading,
    error,
    config,
    isRunning,
    lastAnalysis,
    logs,
    analyze,
    startAutoTrading,
    stopAutoTrading,
    updateConfig,
  } = useTradingAI();

  const [showSettings, setShowSettings] = useState(false);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Trading AI Nativo
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isRunning ? "default" : "secondary"} className="gap-1">
              {isRunning ? (
                <>
                  <Activity className="h-3 w-3 animate-pulse" />
                  Rodando
                </>
              ) : (
                <>
                  <Square className="h-3 w-3" />
                  Parado
                </>
              )}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {!isRunning ? (
            <Button 
              onClick={startAutoTrading} 
              className="flex-1 gap-2"
              disabled={loading}
            >
              <Play className="h-4 w-4" />
              Iniciar Bot
            </Button>
          ) : (
            <Button 
              onClick={stopAutoTrading} 
              variant="destructive"
              className="flex-1 gap-2"
            >
              <Square className="h-4 w-4" />
              Parar Bot
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => analyze('BTCUSDT')}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          </Button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="space-y-4 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-trade" className="text-sm">Executar Trades Automaticamente</Label>
              <Switch
                id="auto-trade"
                checked={config.autoTrade}
                onCheckedChange={(checked) => updateConfig({ autoTrade: checked })}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Alavancagem</Label>
                <span className="font-mono">{config.leverage}x</span>
              </div>
              <Slider
                value={[config.leverage]}
                onValueChange={([value]) => updateConfig({ leverage: value })}
                min={1}
                max={50}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Tamanho Posição</Label>
                <span className="font-mono">{config.positionSize}%</span>
              </div>
              <Slider
                value={[config.positionSize]}
                onValueChange={([value]) => updateConfig({ positionSize: value })}
                min={1}
                max={20}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Max Drawdown</Label>
                <span className="font-mono">{config.maxDrawdown}%</span>
              </div>
              <Slider
                value={[config.maxDrawdown]}
                onValueChange={([value]) => updateConfig({ maxDrawdown: value })}
                min={5}
                max={30}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Intervalo Análise</Label>
                <span className="font-mono">{config.intervalSeconds}s</span>
              </div>
              <Slider
                value={[config.intervalSeconds]}
                onValueChange={([value]) => updateConfig({ intervalSeconds: value })}
                min={30}
                max={300}
                step={10}
              />
            </div>
          </div>
        )}

        {/* Last Analysis */}
        {lastAnalysis && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{lastAnalysis.symbol}</span>
              <span className="text-xs text-muted-foreground">
                {lastAnalysis.timestamp.toLocaleTimeString()}
              </span>
            </div>

            {lastAnalysis.ticker && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/30 rounded p-2">
                  <p className="text-xs text-muted-foreground">Preço</p>
                  <p className="font-mono font-bold">
                    ${lastAnalysis.ticker.price.toLocaleString()}
                  </p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="text-xs text-muted-foreground">24h</p>
                  <p className={cn(
                    "font-mono font-bold",
                    lastAnalysis.ticker.change24h >= 0 ? "text-profit" : "text-loss"
                  )}>
                    {lastAnalysis.ticker.change24h >= 0 ? '+' : ''}
                    {lastAnalysis.ticker.change24h.toFixed(2)}%
                  </p>
                </div>
              </div>
            )}

            {lastAnalysis.indicators && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-muted/20 rounded p-2 text-center">
                  <p className="text-muted-foreground">RSI</p>
                  <p className={cn(
                    "font-mono font-bold",
                    lastAnalysis.indicators.rsi > 70 ? "text-loss" :
                    lastAnalysis.indicators.rsi < 30 ? "text-profit" : ""
                  )}>
                    {lastAnalysis.indicators.rsi}
                  </p>
                </div>
                <div className="bg-muted/20 rounded p-2 text-center">
                  <p className="text-muted-foreground">MACD</p>
                  <p className={cn(
                    "font-mono font-bold",
                    lastAnalysis.indicators.macd > 0 ? "text-profit" : "text-loss"
                  )}>
                    {lastAnalysis.indicators.macd}
                  </p>
                </div>
                <div className="bg-muted/20 rounded p-2 text-center">
                  <p className="text-muted-foreground">Volume</p>
                  <p className="font-mono font-bold">
                    {lastAnalysis.indicators.volumeRatio}x
                  </p>
                </div>
              </div>
            )}

            {lastAnalysis.decision && (
              <div className={cn(
                "rounded-lg p-3 border",
                lastAnalysis.decision.action === 'BUY' ? "border-profit/50 bg-profit/10" :
                lastAnalysis.decision.action === 'SELL' ? "border-loss/50 bg-loss/10" :
                "border-muted bg-muted/30"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {lastAnalysis.decision.action === 'BUY' ? (
                      <TrendingUp className="h-5 w-5 text-profit" />
                    ) : lastAnalysis.decision.action === 'SELL' ? (
                      <TrendingDown className="h-5 w-5 text-loss" />
                    ) : (
                      <Activity className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="font-bold">{lastAnalysis.decision.action}</span>
                  </div>
                  <Badge variant={lastAnalysis.decision.confidence >= 70 ? "default" : "secondary"}>
                    {lastAnalysis.decision.confidence}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lastAnalysis.decision.reasoning}
                </p>
                {lastAnalysis.decision.action !== 'HOLD' && (
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                    {lastAnalysis.decision.entry && (
                      <div>
                        <p className="text-muted-foreground">Entry</p>
                        <p className="font-mono">${lastAnalysis.decision.entry}</p>
                      </div>
                    )}
                    {lastAnalysis.decision.takeProfit && (
                      <div>
                        <p className="text-muted-foreground">TP</p>
                        <p className="font-mono text-profit">${lastAnalysis.decision.takeProfit}</p>
                      </div>
                    )}
                    {lastAnalysis.decision.stopLoss && (
                      <div>
                        <p className="text-muted-foreground">SL</p>
                        <p className="font-mono text-loss">${lastAnalysis.decision.stopLoss}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Logs */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Logs</p>
          <ScrollArea className="h-[120px] rounded border bg-muted/20 p-2">
            {logs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum log ainda...
              </p>
            ) : (
              <div className="space-y-1">
                {logs.slice().reverse().map((log, i) => (
                  <div key={i} className="text-xs flex gap-2">
                    <span className="text-muted-foreground font-mono whitespace-nowrap">
                      {log.time.toLocaleTimeString()}
                    </span>
                    <span className={cn(
                      log.type === 'error' && "text-destructive",
                      log.type === 'success' && "text-profit",
                      log.type === 'warning' && "text-yellow-500",
                    )}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};