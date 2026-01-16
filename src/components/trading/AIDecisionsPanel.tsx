import { Brain, TrendingUp, TrendingDown, Minus, X, Newspaper } from 'lucide-react';
import type { AIDecision } from '@/types/trading';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useNewsSentiment } from '@/hooks/useNewsSentiment';
import { Badge } from '@/components/ui/badge';

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
  const { sentiment } = useNewsSentiment();
  
  // Check if decision reasoning mentions news sentiment
  const hasNewsSentimentInfluence = (reasoning: string) => {
    return reasoning.includes('📰');
  };
  
  // Get sentiment influence indicator
  const getSentimentInfluence = (decision: AIDecision) => {
    const hasSentiment = hasNewsSentimentInfluence(decision.reasoning);
    
    if (!hasSentiment) return null;
    
    if (sentiment.overallSentiment === 'bullish') {
      return {
        label: 'BULLISH',
        color: 'bg-profit/20 text-profit border-profit/30',
        icon: TrendingUp,
        boost: '+' + Math.round((sentiment.confidence - 50) * 0.3) + '%',
      };
    } else if (sentiment.overallSentiment === 'bearish') {
      return {
        label: 'BEARISH',
        color: 'bg-loss/20 text-loss border-loss/30',
        icon: TrendingDown,
        boost: '+' + Math.round((sentiment.confidence - 50) * 0.3) + '%',
      };
    } else {
      return {
        label: 'NEUTRO',
        color: 'bg-muted text-muted-foreground border-border',
        icon: Minus,
        boost: '±0%',
      };
    }
  };

  return (
    <div className="glass-card h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Decisões da IA</h3>
          </div>
        </div>
        
        {/* Current News Sentiment Indicator */}
        <div className={cn(
          "mt-2 p-2 rounded-md border flex items-center justify-between text-xs",
          sentiment.overallSentiment === 'bullish' && "bg-profit/10 border-profit/30",
          sentiment.overallSentiment === 'bearish' && "bg-loss/10 border-loss/30",
          sentiment.overallSentiment === 'neutral' && "bg-muted/50 border-border"
        )}>
          <div className="flex items-center gap-1.5">
            <Newspaper className="w-3.5 h-3.5" />
            <span className="font-medium">Sentimento Atual:</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] py-0 h-5",
                sentiment.overallSentiment === 'bullish' && "border-profit/50 text-profit",
                sentiment.overallSentiment === 'bearish' && "border-loss/50 text-loss",
                sentiment.overallSentiment === 'neutral' && "border-border text-muted-foreground"
              )}
            >
              {sentiment.overallSentiment === 'bullish' && <TrendingUp className="w-3 h-3 mr-1" />}
              {sentiment.overallSentiment === 'bearish' && <TrendingDown className="w-3 h-3 mr-1" />}
              {sentiment.overallSentiment === 'neutral' && <Minus className="w-3 h-3 mr-1" />}
              {sentiment.overallSentiment.toUpperCase()}
            </Badge>
            <span className="font-mono">{sentiment.confidence}%</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
        {decisions.map((decision, index) => {
          const ActionIcon = actionIcons[decision.action];
          const sentimentInfluence = getSentimentInfluence(decision);
          
          return (
            <div 
              key={decision.id} 
              className={cn(
                "p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/30 transition-all",
                index === 0 && "animate-slide-up",
                sentimentInfluence && "ring-1 ring-primary/20"
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
              
              {/* News Sentiment Influence Badge */}
              {sentimentInfluence && (
                <div className={cn(
                  "mb-2 px-2 py-1 rounded border flex items-center justify-between text-[10px]",
                  sentimentInfluence.color
                )}>
                  <div className="flex items-center gap-1">
                    <Newspaper className="w-3 h-3" />
                    <span>Notícias {sentimentInfluence.label}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-semibold">
                    <sentimentInfluence.icon className="w-3 h-3" />
                    <span>Confiança {sentimentInfluence.boost}</span>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                {decision.reasoning.split(' | ')[0]}
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
