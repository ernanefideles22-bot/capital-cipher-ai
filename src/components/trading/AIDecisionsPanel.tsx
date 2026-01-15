import { Brain, TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import type { AIDecision } from '@/types/trading';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface AIDecisionsPanelProps {
  decisions: AIDecision[];
}

const actionIcons = {
  BUY: TrendingUp,
  SELL: TrendingDown,
  HOLD: Minus,
  SKIP: X,
};

const actionColors = {
  BUY: 'text-profit',
  SELL: 'text-loss',
  HOLD: 'text-accent',
  SKIP: 'text-muted-foreground',
};

export const AIDecisionsPanel = ({ decisions }: AIDecisionsPanelProps) => {
  return (
    <div className="glass-card h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Brain className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Decisões da IA</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        {decisions.map((decision, index) => {
          const ActionIcon = actionIcons[decision.action];
          
          return (
            <div 
              key={decision.id} 
              className={cn(
                "p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 transition-all",
                index === 0 && "animate-slide-up"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{decision.symbol}</span>
                  <div className={cn(
                    "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded",
                    decision.action === 'BUY' && "bg-profit/20 text-profit",
                    decision.action === 'SELL' && "bg-loss/20 text-loss",
                    decision.action === 'HOLD' && "bg-accent/20 text-accent",
                    decision.action === 'SKIP' && "bg-muted text-muted-foreground"
                  )}>
                    <ActionIcon className="w-3 h-3" />
                    {decision.action}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(decision.timestamp).toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
              
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                {decision.reasoning}
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Confiança</span>
                  <span className={cn(
                    "font-mono font-medium",
                    decision.confidence >= 80 ? "text-profit" : 
                    decision.confidence >= 60 ? "text-warning" : "text-loss"
                  )}>
                    {decision.confidence.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={decision.confidence} 
                  className="h-1.5 bg-muted"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/50">
                <div className="text-xs">
                  <span className="text-muted-foreground block">Fluxo Inst.</span>
                  <span className={cn(
                    "font-mono",
                    decision.indicators.institutionalFlow > 0 ? "text-profit" : "text-loss"
                  )}>
                    {decision.indicators.institutionalFlow > 0 ? '+' : ''}
                    {decision.indicators.institutionalFlow.toFixed(1)}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground block">Tendência</span>
                  <span className="font-mono">{decision.indicators.trendStrength.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
