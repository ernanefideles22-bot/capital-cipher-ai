import { useEffect, useMemo, useState } from 'react';
import { Settings, Zap, Shield, Target, Layers } from 'lucide-react';
import type { BotConfig } from '@/types/trading';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfigPanelProps {
  config: BotConfig;
  onUpdateConfig: (config: Partial<BotConfig>) => void;
}

export const ConfigPanel = ({ config, onUpdateConfig }: ConfigPanelProps) => {
  // Draft state so inputs always move smoothly; changes are applied only when user clicks OK.
  const [draft, setDraft] = useState<BotConfig>(config);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const isDirty = useMemo(() => {
    try {
      return JSON.stringify(draft) !== JSON.stringify(config);
    } catch {
      return true;
    }
  }, [draft, config]);

  const handleCancel = () => setDraft(config);
  const handleApply = () => {
    // Save to localStorage for persistence across page navigation
    try {
      localStorage.setItem('bot_config', JSON.stringify(draft));
    } catch {
      // ignore
    }
    onUpdateConfig(draft);
  };

  return (
    <div className="glass-card p-4 h-full">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Configurações</h3>
        </div>
        {isDirty && (
          <span className="text-xs text-muted-foreground">Alterações pendentes</span>
        )}
      </div>

      <div className="space-y-5">
        {/* Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-warning" />
            <Label className="text-sm">Modo Real</Label>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-xs font-medium',
                draft.mode === 'paper' ? 'text-accent' : 'text-muted-foreground'
              )}
            >
              Paper
            </span>
            <Switch
              checked={draft.mode === 'live'}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({ ...prev, mode: checked ? 'live' : 'paper' }))
              }
            />
            <span
              className={cn(
                'text-xs font-medium',
                draft.mode === 'live' ? 'text-warning' : 'text-muted-foreground'
              )}
            >
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
            <span
              className={cn(
                'text-xs font-medium',
                draft.marketMode === 'SPOT' ? 'text-accent' : 'text-muted-foreground'
              )}
            >
              Spot
            </span>
            <Switch
              checked={draft.marketMode === 'FUTURES'}
              onCheckedChange={(checked) =>
                setDraft((prev) => ({ ...prev, marketMode: checked ? 'FUTURES' : 'SPOT' }))
              }
            />
            <span
              className={cn(
                'text-xs font-medium',
                draft.marketMode === 'FUTURES' ? 'text-primary' : 'text-muted-foreground'
              )}
            >
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
            <span className="text-sm font-mono font-medium text-primary">{draft.leverage}x</span>
          </div>
          <Slider
            value={[draft.leverage]}
            onValueChange={([value]) => setDraft((prev) => ({ ...prev, leverage: value }))}
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
            <span className="text-sm font-mono font-medium">{draft.riskPerTrade}%</span>
          </div>
          <Slider
            value={[draft.riskPerTrade]}
            onValueChange={([value]) => setDraft((prev) => ({ ...prev, riskPerTrade: value }))}
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
            <span className="text-sm font-mono font-medium">{draft.maxConcurrentTrades}</span>
          </div>
          <Slider
            value={[draft.maxConcurrentTrades]}
            onValueChange={([value]) =>
              setDraft((prev) => ({ ...prev, maxConcurrentTrades: value }))
            }
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
            <span className="text-sm font-mono font-medium text-loss">{draft.maxDrawdown}%</span>
          </div>
          <Slider
            value={[draft.maxDrawdown]}
            onValueChange={([value]) => setDraft((prev) => ({ ...prev, maxDrawdown: value }))}
            min={5}
            max={25}
            step={1}
            className="w-full"
          />
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-border/40 flex items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={!isDirty}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={handleApply} disabled={!isDirty}>
            OK
          </Button>
        </div>
      </div>
    </div>
  );
};

