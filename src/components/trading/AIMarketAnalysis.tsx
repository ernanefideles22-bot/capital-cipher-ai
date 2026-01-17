import { useState } from 'react';
import { Brain, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MarketAnalysisResult {
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
  confidence: number;
  reasoning: string;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskRewardRatio: number | null;
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  signals: {
    bullish: string[];
    bearish: string[];
  };
  timeframe: 'short' | 'medium' | 'long';
  marketCondition: 'bullish' | 'bearish' | 'neutral' | 'volatile';
}

interface AIMarketAnalysisProps {
  marketData: {
    symbol: string;
    price: number;
    change24h: number;
    volume24h: number;
    high24h: number;
    low24h: number;
  };
}

export const AIMarketAnalysis = ({ marketData }: AIMarketAnalysisProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<MarketAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if user is authenticated first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Você precisa estar logado para usar a análise de IA');
      }

      const { data, error: fnError } = await supabase.functions.invoke('market-analysis', {
        body: {
          marketData: {
            symbol: marketData.symbol,
            price: marketData.price,
            change24h: marketData.change24h,
            volume24h: marketData.volume24h,
            high24h: marketData.high24h,
            low24h: marketData.low24h,
          },
          analysisType: 'full',
        },
      });

      if (fnError) throw fnError;

      if (data?.success && data?.analysis) {
        setAnalysis(data.analysis);
        toast.success('Análise de mercado concluída!');
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao analisar mercado';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'BUY':
        return { icon: TrendingUp, color: 'text-profit', bg: 'bg-profit/20', border: 'border-profit/30' };
      case 'SELL':
        return { icon: TrendingDown, color: 'text-loss', bg: 'bg-loss/20', border: 'border-loss/30' };
      case 'HOLD':
        return { icon: Minus, color: 'text-warning', bg: 'bg-warning/20', border: 'border-warning/30' };
      default:
        return { icon: AlertTriangle, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border' };
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '—';
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Análise IA</h3>
        </div>
        <Button
          size="sm"
          onClick={requestAnalysis}
          disabled={isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4" />
              Analisar {marketData.symbol}
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-loss/10 border border-loss/30 text-loss text-sm mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      {analysis && !error && (
        <div className="space-y-4">
          {/* Recommendation Header */}
          <div className={cn(
            "p-3 rounded-lg border flex items-center justify-between",
            getRecommendationStyle(analysis.recommendation).bg,
            getRecommendationStyle(analysis.recommendation).border
          )}>
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = getRecommendationStyle(analysis.recommendation).icon;
                return <Icon className={cn("w-6 h-6", getRecommendationStyle(analysis.recommendation).color)} />;
              })()}
              <div>
                <span className={cn(
                  "text-lg font-bold",
                  getRecommendationStyle(analysis.recommendation).color
                )}>
                  {analysis.recommendation}
                </span>
                <p className="text-xs text-muted-foreground">
                  {analysis.marketCondition.charAt(0).toUpperCase() + analysis.marketCondition.slice(1)} • {analysis.timeframe}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold font-mono">{analysis.confidence}%</div>
              <p className="text-xs text-muted-foreground">Confiança</p>
            </div>
          </div>

          {/* Confidence Bar */}
          <div className="space-y-1">
            <Progress 
              value={analysis.confidence} 
              className={cn(
                "h-2",
                analysis.confidence >= 70 ? "[&>div]:bg-profit" :
                analysis.confidence >= 50 ? "[&>div]:bg-warning" : "[&>div]:bg-loss"
              )}
            />
          </div>

          {/* Price Levels */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded bg-muted/50 text-center">
              <Target className="w-4 h-4 mx-auto mb-1 text-profit" />
              <p className="text-[10px] text-muted-foreground">Entrada</p>
              <p className="text-xs font-mono font-medium">{formatPrice(analysis.entryPrice)}</p>
            </div>
            <div className="p-2 rounded bg-muted/50 text-center">
              <Shield className="w-4 h-4 mx-auto mb-1 text-loss" />
              <p className="text-[10px] text-muted-foreground">Stop Loss</p>
              <p className="text-xs font-mono font-medium">{formatPrice(analysis.stopLoss)}</p>
            </div>
            <div className="p-2 rounded bg-muted/50 text-center">
              <TrendingUp className="w-4 h-4 mx-auto mb-1 text-profit" />
              <p className="text-[10px] text-muted-foreground">Take Profit</p>
              <p className="text-xs font-mono font-medium">{formatPrice(analysis.takeProfit)}</p>
            </div>
          </div>

          {/* Risk/Reward */}
          {analysis.riskRewardRatio && (
            <div className="flex items-center justify-between p-2 rounded bg-muted/50">
              <span className="text-xs text-muted-foreground">Risco/Retorno</span>
              <Badge variant="outline" className="font-mono">
                1:{analysis.riskRewardRatio.toFixed(2)}
              </Badge>
            </div>
          )}

          {/* Signals */}
          <div className="grid grid-cols-2 gap-2">
            {analysis.signals?.bullish?.length > 0 && (
              <div className="p-2 rounded bg-profit/10 border border-profit/20">
                <p className="text-[10px] font-medium text-profit mb-1">Sinais Bullish</p>
                <ul className="space-y-0.5">
                  {analysis.signals.bullish.slice(0, 3).map((signal, i) => (
                    <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                      <TrendingUp className="w-2.5 h-2.5 mt-0.5 text-profit shrink-0" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.signals?.bearish?.length > 0 && (
              <div className="p-2 rounded bg-loss/10 border border-loss/20">
                <p className="text-[10px] font-medium text-loss mb-1">Sinais Bearish</p>
                <ul className="space-y-0.5">
                  {analysis.signals.bearish.slice(0, 3).map((signal, i) => (
                    <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                      <TrendingDown className="w-2.5 h-2.5 mt-0.5 text-loss shrink-0" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Key Levels */}
          {(analysis.keyLevels?.support?.length > 0 || analysis.keyLevels?.resistance?.length > 0) && (
            <div className="p-2 rounded bg-muted/30 border border-border">
              <p className="text-[10px] font-medium text-muted-foreground mb-2">Níveis Chave</p>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {analysis.keyLevels?.resistance?.length > 0 && (
                  <div>
                    <span className="text-loss">Resistências:</span>
                    <div className="font-mono">
                      {analysis.keyLevels.resistance.slice(0, 2).map(r => formatPrice(r)).join(', ')}
                    </div>
                  </div>
                )}
                {analysis.keyLevels?.support?.length > 0 && (
                  <div>
                    <span className="text-profit">Suportes:</span>
                    <div className="font-mono">
                      {analysis.keyLevels.support.slice(0, 2).map(s => formatPrice(s)).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reasoning */}
          <div className="p-2 rounded bg-muted/30 border border-border">
            <p className="text-[10px] font-medium text-muted-foreground mb-1">Análise</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{analysis.reasoning}</p>
          </div>
        </div>
      )}

      {!analysis && !isLoading && !error && (
        <div className="text-center py-6 text-muted-foreground">
          <Brain className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Clique em "Analisar" para obter insights da IA</p>
        </div>
      )}
    </Card>
  );
};
