import { Settings, Zap, Shield, Target, Layers } from 'lucide-react';
import type { BotConfig } from '@/types/trading';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ConfigPanelProps {
  config: BotConfig;
  onUpdateConfig: (config: Partial<BotConfig>) => void;
}

export const ConfigPanel = ({ config, onUpdateConfig }: ConfigPanelProps) => {
  return (
    <div className="glass-card p-4 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold">Configurações</h3>
      </div>
      
      <div className="space-y-5">
        {/* Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-warning" />
            <Label className="text-sm">Modo Real</Label>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-medium",
              config.mode === 'paper' ? "text-accent" : "text-muted-foreground"
            )}>
              Paper
            </span>
            <Switch
              checked={config.mode === 'live'}
              onCheckedChange={(checked) => 
                onUpdateConfig({ mode: checked ? 'live' : 'paper' })
              }
            />
            <span className={cn(
              "text-xs font-medium",
              config.mode === 'live' ? "text-warning" : "text-muted-foreground"
            )}>
              Live
            </span>
          </div>
        </div>

        {/* Market Mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <Label className="text-sm">Mercado</Label>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-medium",
              config.marketMode === 'SPOT' ? "text-accent" : "text-muted-foreground"
            )}>
              Spot
            </span>
            <Switch
              checked={config.marketMode === 'FUTURES'}
              onCheckedChange={(checked) => 
                onUpdateConfig({ marketMode: checked ? 'FUTURES' : 'SPOT' })
              }
            />
            <span className={cn(
              "text-xs font-medium",
              config.marketMode === 'FUTURES' ? "text-primary" : "text-muted-foreground"
            )}>
              Futures
            </span>
          </div>
        </div>

        {/* Leverage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <Label className="text-sm">Alavancagem</Label>
            </div>
            <span className="text-sm font-mono font-medium text-primary">{config.leverage}x</span>
          </div>
          <Slider
            value={[config.leverage]}
            onValueChange={([value]) => onUpdateConfig({ leverage: value })}
            min={1}
            max={20}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1x</span>
            <span>20x</span>
          </div>
        </div>

        {/* Risk Per Trade */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-profit" />
              <Label className="text-sm">Risco por Trade</Label>
            </div>
            <span className="text-sm font-mono font-medium">{config.riskPerTrade}%</span>
          </div>
          <Slider
            value={[config.riskPerTrade]}
            onValueChange={([value]) => onUpdateConfig({ riskPerTrade: value })}
            min={0.5}
            max={5}
            step={0.5}
            className="w-full"
          />
        </div>

        {/* Max Concurrent Trades */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Trades Simultâneos</Label>
            <span className="text-sm font-mono font-medium">{config.maxConcurrentTrades}</span>
          </div>
          <Slider
            value={[config.maxConcurrentTrades]}
            onValueChange={([value]) => onUpdateConfig({ maxConcurrentTrades: value })}
            min={1}
            max={10}
            step={1}
            className="w-full"
          />
        </div>

        {/* Max Drawdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Drawdown Máximo</Label>
            <span className="text-sm font-mono font-medium text-loss">{config.maxDrawdown}%</span>
          </div>
          <Slider
            value={[config.maxDrawdown]}
            onValueChange={([value]) => onUpdateConfig({ maxDrawdown: value })}
            min={5}
            max={25}
            step={1}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};
