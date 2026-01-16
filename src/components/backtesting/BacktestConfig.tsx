import { Calendar, Play, RotateCcw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import type { BacktestConfig as BacktestConfigType, BacktestStatus } from '@/types/backtesting';

interface BacktestConfigProps {
  config: BacktestConfigType;
  status: BacktestStatus;
  onUpdateConfig: (updates: Partial<BacktestConfigType>) => void;
  onRunBacktest: () => void;
  onReset: () => void;
}

export const BacktestConfig = ({
  config,
  status,
  onUpdateConfig,
  onRunBacktest,
  onReset,
}: BacktestConfigProps) => {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="w-4 h-4 text-accent" />
          Configuração do Backtest
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Symbol & Strategy */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Ativo</Label>
            <Select 
              value={config.symbol} 
              onValueChange={(value) => onUpdateConfig({ symbol: value })}
              disabled={status.isRunning}
            >
              <SelectTrigger className="h-9 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BTCUSDT">BTC/USDT</SelectItem>
                <SelectItem value="ETHUSDT">ETH/USDT</SelectItem>
                <SelectItem value="SOLUSDT">SOL/USDT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs">Estratégia</Label>
            <Select 
              value={config.strategy} 
              onValueChange={(value: any) => onUpdateConfig({ strategy: value })}
              disabled={status.isRunning}
            >
              <SelectTrigger className="h-9 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                <SelectItem value="SCALP">Scalp</SelectItem>
                <SelectItem value="DAYTRADE">Day Trade</SelectItem>
                <SelectItem value="SWING">Swing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Data Início
            </Label>
            <Input
              type="date"
              className="h-9 bg-card"
              value={config.startDate.toISOString().split('T')[0]}
              onChange={(e) => onUpdateConfig({ startDate: new Date(e.target.value) })}
              disabled={status.isRunning}
            />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Data Fim
            </Label>
            <Input
              type="date"
              className="h-9 bg-card"
              value={config.endDate.toISOString().split('T')[0]}
              onChange={(e) => onUpdateConfig({ endDate: new Date(e.target.value) })}
              disabled={status.isRunning}
            />
          </div>
        </div>

        {/* Capital & Leverage */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Capital Inicial ($)</Label>
            <Input
              type="number"
              className="h-9 bg-card"
              value={config.initialCapital}
              onChange={(e) => onUpdateConfig({ initialCapital: Number(e.target.value) })}
              disabled={status.isRunning}
            />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs">Alavancagem: {config.leverage}x</Label>
            <Slider
              value={[config.leverage]}
              onValueChange={([value]) => onUpdateConfig({ leverage: value })}
              min={1}
              max={20}
              step={1}
              disabled={status.isRunning}
              className="mt-2"
            />
          </div>
        </div>

        {/* Risk Settings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Risco/Trade: {config.riskPerTrade}%</Label>
            <Slider
              value={[config.riskPerTrade]}
              onValueChange={([value]) => onUpdateConfig({ riskPerTrade: value })}
              min={0.5}
              max={5}
              step={0.5}
              disabled={status.isRunning}
              className="mt-2"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs">Max Drawdown: {config.maxDrawdown}%</Label>
            <Slider
              value={[config.maxDrawdown]}
              onValueChange={([value]) => onUpdateConfig({ maxDrawdown: value })}
              min={5}
              max={25}
              step={1}
              disabled={status.isRunning}
              className="mt-2"
            />
          </div>
        </div>

        {/* Progress */}
        {status.isRunning && (
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Processando...</span>
              <span>{status.progress}% • {status.tradesFound} trades</span>
            </div>
            <Progress value={status.progress} className="h-2" />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onRunBacktest}
            disabled={status.isRunning}
            className="flex-1 gap-2"
          >
            <Play className="w-4 h-4" />
            {status.isRunning ? 'Executando...' : 'Executar Backtest'}
          </Button>
          <Button
            variant="outline"
            onClick={onReset}
            disabled={status.isRunning}
            size="icon"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
