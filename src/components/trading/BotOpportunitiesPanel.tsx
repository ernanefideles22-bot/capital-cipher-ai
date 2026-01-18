import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Target, Shield, Zap, Brain, Loader2, BarChart2, Sparkles,
  Building2, Activity, Layers, ArrowUpCircle, ArrowDownCircle, Circle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { BotOpportunity, MultiPairAnalysisResult } from '@/hooks/useAutonomousBot';
import { FloatingPriceChart } from './FloatingPriceChart';

interface BotOpportunitiesPanelProps {
  opportunities: BotOpportunity[];
  lastAnalysis: MultiPairAnalysisResult | null;
  isAnalyzing: boolean;
  isRunning: boolean;
  onAnalyzeNow: () => void;
  onExecuteOpportunity?: (opportunity: BotOpportunity) => void;
  marketPrices?: Record<string, number>;
  lastExecutedSymbol?: string | null; // Auto-expand chart for this symbol
}

export const BotOpportunitiesPanel = ({
  opportunities,
  lastAnalysis,
  isAnalyzing,
  isRunning,
  onAnalyzeNow,
  onExecuteOpportunity,
  marketPrices = {},
  lastExecutedSymbol,
}: BotOpportunitiesPanelProps) => {
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  // Auto-expand chart when a trade is executed
  useEffect(() => {
    if (lastExecutedSymbol) {
      setExpandedChart(lastExecutedSymbol);
    }
  }, [lastExecutedSymbol]);
  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${price.toFixed(price < 1 ? 4 : 2)}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-profit';
    if (score >= 60) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 80) return 'bg-profit';
    if (confidence >= 60) return 'bg-warning';
    return 'bg-muted';
  };

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Oportunidades IA</h3>
          {isRunning && (
            <Badge variant="outline" className="border-profit text-profit text-[10px]">
              ATIVO
            </Badge>
          )}
          {lastAnalysis?.neuralEnabled && (
            <Badge variant="outline" className="border-purple-500 text-purple-400 text-[10px] gap-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              Neural
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onAnalyzeNow}
          disabled={isAnalyzing}
          className="h-7 px-2 text-xs gap-1"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" />
              Analisar Agora
            </>
          )}
        </Button>
      </div>

      {/* Neural Network Status */}
      {lastAnalysis?.neuralEnabled && (
        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-medium text-purple-400">
              Rede Neural Ativa
            </span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-500/50 text-purple-300">
              {lastAnalysis.neuralEpochs} épocas | {lastAnalysis.neuralAccuracy?.toFixed(1)}% precisão
            </Badge>
          </div>
          {lastAnalysis.neuralBonuses && lastAnalysis.neuralBonuses.length > 0 && (
            <div className="space-y-0.5 mt-1">
              {lastAnalysis.neuralBonuses.slice(0, 3).map((bonus, i) => (
                <p key={i} className="text-[10px] text-purple-300/80">{bonus}</p>
              ))}
            </div>
          )}
          {lastAnalysis.neuralInsights && (
            <p className="text-[10px] text-purple-300/70 mt-1 italic">
              💡 {lastAnalysis.neuralInsights}
            </p>
          )}
        </div>
      )}

      {/* Market Overview */}
      {lastAnalysis?.marketOverview && (
        <div className="p-2 rounded-lg bg-muted/30 border border-border mb-3">
          <p className="text-xs text-muted-foreground">{lastAnalysis.marketOverview}</p>
        </div>
      )}

      {/* Institutional Bias Panel */}
      {lastAnalysis?.institutionalBias && (
        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-medium text-blue-400">Análise Institucional</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-1">
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground">Mercado</p>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[9px] px-1 py-0",
                  lastAnalysis.institutionalBias.overall === 'RISK_ON' ? "border-profit text-profit" :
                  lastAnalysis.institutionalBias.overall === 'RISK_OFF' ? "border-loss text-loss" :
                  "border-muted-foreground text-muted-foreground"
                )}
              >
                {lastAnalysis.institutionalBias.overall === 'RISK_ON' ? '🟢 Risk On' :
                 lastAnalysis.institutionalBias.overall === 'RISK_OFF' ? '🔴 Risk Off' : '⚪ Neutro'}
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground">BTC Dom.</p>
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-500/50 text-blue-300">
                {lastAnalysis.institutionalBias.btcDominance === 'RISING' ? '📈 Subindo' :
                 lastAnalysis.institutionalBias.btcDominance === 'FALLING' ? '📉 Caindo' : '➡️ Estável'}
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground">Fase Wyckoff</p>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[9px] px-1 py-0",
                  lastAnalysis.institutionalBias.marketPhase === 'ACCUMULATION' ? "border-profit text-profit" :
                  lastAnalysis.institutionalBias.marketPhase === 'MARKUP' ? "border-profit text-profit" :
                  lastAnalysis.institutionalBias.marketPhase === 'DISTRIBUTION' ? "border-loss text-loss" :
                  "border-loss text-loss"
                )}
              >
                {lastAnalysis.institutionalBias.marketPhase === 'ACCUMULATION' ? '📥 Acumulação' :
                 lastAnalysis.institutionalBias.marketPhase === 'MARKUP' ? '🚀 Markup' :
                 lastAnalysis.institutionalBias.marketPhase === 'DISTRIBUTION' ? '📤 Distribuição' : '📉 Markdown'}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Top Pick Highlight */}
      {lastAnalysis?.topPick && (
        <div className={cn(
          "p-3 rounded-lg border mb-3 flex items-center justify-between",
          lastAnalysis.topPick.action === 'BUY' 
            ? "bg-profit/10 border-profit/30" 
            : "bg-loss/10 border-loss/30"
        )}>
          <div className="flex items-center gap-2">
            {lastAnalysis.topPick.action === 'BUY' ? (
              <TrendingUp className="w-5 h-5 text-profit" />
            ) : (
              <TrendingDown className="w-5 h-5 text-loss" />
            )}
            <div>
              <span className="font-bold text-sm">{lastAnalysis.topPick.symbol}</span>
              <p className="text-[10px] text-muted-foreground">Melhor oportunidade</p>
            </div>
          </div>
          <div className="text-right">
            <Badge className={cn(
              "text-xs",
              lastAnalysis.topPick.action === 'BUY' ? "bg-profit" : "bg-loss"
            )}>
              {lastAnalysis.topPick.action}
            </Badge>
            <p className={cn(
              "text-[10px] mt-0.5",
              lastAnalysis.topPick.urgency === 'high' ? "text-profit" :
              lastAnalysis.topPick.urgency === 'medium' ? "text-warning" : "text-muted-foreground"
            )}>
              Urgência: {lastAnalysis.topPick.urgency}
            </p>
          </div>
        </div>
      )}

      {/* Opportunities List */}
      <ScrollArea className="h-[280px]">
        {opportunities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma oportunidade encontrada</p>
            <p className="text-xs mt-1">Clique em "Analisar Agora" ou inicie o bot</p>
          </div>
        ) : (
          <div className="space-y-2">
            {opportunities.map((opp, index) => (
              <div
                key={`${opp.symbol}-${index}`}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  opp.recommendation === 'BUY' 
                    ? "bg-profit/5 border-profit/20 hover:border-profit/40" 
                    : opp.recommendation === 'SELL'
                    ? "bg-loss/5 border-loss/20 hover:border-loss/40"
                    : "bg-muted/30 border-border"
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {opp.recommendation === 'BUY' ? (
                      <TrendingUp className="w-4 h-4 text-profit" />
                    ) : opp.recommendation === 'SELL' ? (
                      <TrendingDown className="w-4 h-4 text-loss" />
                    ) : null}
                    <span className="font-semibold text-sm">{opp.symbol}</span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        opp.recommendation === 'BUY' ? "border-profit text-profit" :
                        opp.recommendation === 'SELL' ? "border-loss text-loss" :
                        "border-muted-foreground text-muted-foreground"
                      )}
                    >
                      {opp.recommendation}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedChart(expandedChart === opp.symbol ? null : opp.symbol)}
                      className="h-6 w-6 p-0"
                      title="Ver gráfico de níveis"
                    >
                      <BarChart2 className={cn(
                        "w-4 h-4 transition-colors",
                        expandedChart === opp.symbol ? "text-primary" : "text-muted-foreground"
                      )} />
                    </Button>
                    {opp.neuralAdjusted && (
                      <span title="Score ajustado por rede neural">
                        <Sparkles className="w-3 h-3 text-purple-400" />
                      </span>
                    )}
                    <span className={cn("text-sm font-bold font-mono", getScoreColor(opp.score))}>
                      {opp.score}
                    </span>
                    {opp.neuralAdjusted && opp.originalScore && opp.originalScore !== opp.score && (
                      <span className="text-[9px] text-purple-400/70 line-through">
                        {opp.originalScore}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">score</span>
                  </div>
                </div>

                {/* Floating Chart (when expanded) */}
                {expandedChart === opp.symbol && (
                  <div className="mb-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <FloatingPriceChart
                      opportunity={opp}
                      currentPrice={marketPrices[opp.symbol]}
                      onClose={() => setExpandedChart(null)}
                    />
                  </div>
                )}

                {/* Confidence Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">Confiança</span>
                    <span className="text-xs font-mono font-medium">{opp.confidence}%</span>
                  </div>
                  <Progress 
                    value={opp.confidence} 
                    className={cn("h-1.5", `[&>div]:${getConfidenceBg(opp.confidence)}`)}
                  />
                </div>

                {/* Price Levels */}
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <div className="p-1.5 rounded bg-muted/50 text-center">
                    <Target className="w-3 h-3 mx-auto mb-0.5 text-primary" />
                    <p className="text-[9px] text-muted-foreground">Entrada</p>
                    <p className="text-[10px] font-mono font-medium">{formatPrice(opp.entryPrice)}</p>
                  </div>
                  <div className="p-1.5 rounded bg-muted/50 text-center">
                    <Shield className="w-3 h-3 mx-auto mb-0.5 text-loss" />
                    <p className="text-[9px] text-muted-foreground">Stop Loss</p>
                    <p className="text-[10px] font-mono font-medium">{formatPrice(opp.stopLoss)}</p>
                  </div>
                  <div className="p-1.5 rounded bg-muted/50 text-center">
                    <TrendingUp className="w-3 h-3 mx-auto mb-0.5 text-profit" />
                    <p className="text-[9px] text-muted-foreground">Take Profit</p>
                    <p className="text-[10px] font-mono font-medium">{formatPrice(opp.takeProfit)}</p>
                  </div>
                </div>

                {/* Risk/Reward & Strategy */}
                <div className="flex items-center justify-between p-1.5 rounded bg-muted/30 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">R/R</span>
                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                      1:{opp.riskRewardRatio?.toFixed(2) || '—'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {opp.professionalStrategy && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 border-blue-500/50 text-blue-400">
                        {opp.professionalStrategy.replace('_', ' ')}
                      </Badge>
                    )}
                    {opp.suggestedStrategy && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-500/50 text-purple-400">
                        {opp.suggestedStrategy}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Institutional Signals */}
                {opp.institutionalSignals && (
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    <div className="text-center p-1 rounded bg-muted/30">
                      <p className="text-[8px] text-muted-foreground">Fluxo</p>
                      <div className={cn(
                        "text-[9px] font-medium",
                        opp.institutionalSignals.orderFlow === 'ACCUMULATION' ? "text-profit" :
                        opp.institutionalSignals.orderFlow === 'DISTRIBUTION' ? "text-loss" : "text-muted-foreground"
                      )}>
                        {opp.institutionalSignals.orderFlow === 'ACCUMULATION' ? '📥' :
                         opp.institutionalSignals.orderFlow === 'DISTRIBUTION' ? '📤' : '⚪'}
                      </div>
                    </div>
                    <div className="text-center p-1 rounded bg-muted/30">
                      <p className="text-[8px] text-muted-foreground">Smart $</p>
                      <div className={cn(
                        "text-[9px] font-medium",
                        opp.institutionalSignals.smartMoney === 'BULLISH' ? "text-profit" :
                        opp.institutionalSignals.smartMoney === 'BEARISH' ? "text-loss" : "text-muted-foreground"
                      )}>
                        {opp.institutionalSignals.smartMoney === 'BULLISH' ? '🐂' :
                         opp.institutionalSignals.smartMoney === 'BEARISH' ? '🐻' : '—'}
                      </div>
                    </div>
                    <div className="text-center p-1 rounded bg-muted/30">
                      <p className="text-[8px] text-muted-foreground">POC</p>
                      <div className={cn(
                        "text-[9px] font-medium",
                        opp.institutionalSignals.volumeProfile === 'ABOVE_POC' ? "text-profit" :
                        opp.institutionalSignals.volumeProfile === 'BELOW_POC' ? "text-loss" : "text-warning"
                      )}>
                        {opp.institutionalSignals.volumeProfile === 'ABOVE_POC' ? '⬆️' :
                         opp.institutionalSignals.volumeProfile === 'BELOW_POC' ? '⬇️' : '➡️'}
                      </div>
                    </div>
                    <div className="text-center p-1 rounded bg-muted/30">
                      <p className="text-[8px] text-muted-foreground">Liq.</p>
                      <div className={cn(
                        "text-[9px] font-medium",
                        opp.institutionalSignals.liquidityZone === 'NEAR_LIQUIDITY' ? "text-warning" : "text-profit"
                      )}>
                        {opp.institutionalSignals.liquidityZone === 'NEAR_LIQUIDITY' ? '⚠️' : '✅'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reasoning */}
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                  {opp.reasoning}
                </p>

                {/* Execute Button */}
                {onExecuteOpportunity && (opp.recommendation === 'BUY' || opp.recommendation === 'SELL') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onExecuteOpportunity(opp)}
                    className={cn(
                      "w-full mt-2 h-7 text-xs",
                      opp.recommendation === 'BUY' 
                        ? "border-profit text-profit hover:bg-profit/10" 
                        : "border-loss text-loss hover:bg-loss/10"
                    )}
                  >
                    Executar {opp.recommendation}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {lastAnalysis?.timestamp && (
        <div className="mt-3 pt-2 border-t border-border flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {lastAnalysis.pairsAnalyzed} pares analisados
          </span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(lastAnalysis.timestamp).toLocaleTimeString('pt-BR')}
          </span>
        </div>
      )}
    </Card>
  );
};
