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
  keyLevels: { support: number[]; resistance: number[] };
  signals: { bullish: string[]; bearish: string[] };
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

const recommendationLabel: Record<string, string> = {
  BUY: 'COMPRA',
  SELL: 'VENDA',
  HOLD: 'MANTER',
  WAIT: 'AGUARDAR',
};

const marketConditionLabel: Record<string, string> = {
  bullish: 'mercado comprador',
  bearish: 'mercado vendedor',
  neutral: 'mercado neutro',
  volatile: 'mercado volátil',
};

const timeframeLabel: Record<string, string> = {
  short: 'curto prazo',
  medium: 'médio prazo',
  long: 'longo prazo',
};

const translateSignal = (text: string) => {
  const dictionary: Record<string, string> = {
    'Strong macro uptrend': 'Tendência macro forte de alta',
    'High trading volume supporting current price levels': 'Volume alto sustentando os níveis atuais de preço',
    'Institutional demand remains high': 'Demanda institucional continua alta',
    'Negative 24h change indicates short-term profit taking': 'Queda nas últimas 24h indica realização de lucro no curto prazo',
    'RSI likely in overbought territory on daily timeframe': 'RSI provavelmente em região de sobrecompra no diário',
    'Failure to break and hold': 'Falha em romper e sustentar',
    'support': 'suporte',
    'resistance': 'resistência',
    'breakout': 'rompimento',
    'pullback': 'correção',
    'consolidation': 'consolidação',
    'bullish': 'comprador',
    'bearish': 'vendedor',
    'overbought': 'sobrecomprado',
    'oversold': 'sobrevendido',
  };

  let translated = text;
  for (const [from, to] of Object.entries(dictionary)) {
    translated = translated.replace(new RegExp(from, 'gi'), to);
  }
  return translated;
};

const translateReasoning = (text: string, symbol: string) => {
  if (!text) return 'Sem análise textual disponível para este ativo.';

  const hasEnglish = /\b(currently|trading|showing|signs|after|while|trend|price|support|resistance|entry|breakout|liquidity|zone|risk|reward|confirmed|before)\b/i.test(text);
  if (!hasEnglish) return text;

  return `Resumo técnico em português para ${symbol}: o ativo está em região importante de decisão. A IA identificou força de tendência, zonas de suporte e resistência, volume relevante e possível fase de consolidação. Para uma entrada mais segura, aguarde confirmação de rompimento, rejeição em suporte ou retorno para uma zona de liquidez com melhor relação risco/retorno. Texto original: ${text}`;
};

export const AIMarketAnalysis = ({ marketData }: AIMarketAnalysisProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<MarketAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    const formatInvokeError = (err: unknown) => {
      if (!err) return 'Erro ao analisar mercado';
      if (err instanceof Error) {
        const anyErr = err as any;
        const status = anyErr?.context?.status ?? anyErr?.status;
        const body = anyErr?.context?.body;
        if (body && typeof body === 'string') {
          try {
            const parsed = JSON.parse(body);
            if (parsed?.error) return String(parsed.error);
          } catch {
            // ignore
          }
        }
        if (typeof status === 'number') return `Erro ${status}: ${err.message}`;
        return err.message;
      }
      return 'Erro ao analisar mercado';
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Você precisa estar logado para usar a análise de IA');

      const price = Number(marketData.price);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Dados de preço inválidos. Aguarde o carregamento do mercado.');
      }

      const payload = {
        symbol: marketData.symbol,
        price,
        change24h: Number(marketData.change24h) || 0,
        volume24h: Number.isFinite(Number(marketData.volume24h)) ? Number(marketData.volume24h) : 0,
        high24h: typeof marketData.high24h === 'number' && marketData.high24h > 0 ? marketData.high24h : price,
        low24h: typeof marketData.low24h === 'number' && marketData.low24h > 0 ? marketData.low24h : price,
      };

      const invoke = (accessToken: string) => supabase.functions.invoke('market-analysis', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { marketData: payload, analysisType: 'full', language: 'pt-BR' },
      });

      let result = await invoke(session.access_token);
      const status = (result.error as any)?.context?.status ?? (result.error as any)?.status;
      if (result.error && (status === 401 || /unauthorized|401/i.test(result.error.message))) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session?.access_token) {
          throw new Error('Sua sessão expirou. Faça login novamente.');
        }
        result = await invoke(refreshed.session.access_token);
      }

      const { data, error: fnError } = result;
      if (fnError) throw fnError;

      if (data?.success && data?.analysis) {
        setAnalysis(data.analysis);
        toast.success('Análise de mercado concluída!');
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Resposta inválida do serviço de análise');
      }
    } catch (err) {
      const message = formatInvokeError(err);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'BUY': return { icon: TrendingUp, color: 'text-profit', bg: 'bg-profit/20', border: 'border-profit/30' };
      case 'SELL': return { icon: TrendingDown, color: 'text-loss', bg: 'bg-loss/20', border: 'border-loss/30' };
      case 'HOLD': return { icon: Minus, color: 'text-warning', bg: 'bg-warning/20', border: 'border-warning/30' };
      default: return { icon: AlertTriangle, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border' };
    }
  };

  const formatPrice = (price: number | null) => price === null ? '—' : `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Análise IA</h3>
        </div>
        <Button size="sm" onClick={requestAnalysis} disabled={isLoading} className="gap-2">
          {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Analisando...</> : <><Brain className="w-4 h-4" />Analisar</>}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-loss/10 border border-loss/30 text-loss text-sm mb-4">
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>
        </div>
      )}

      {analysis && !error && (
        <div className="space-y-4">
          <div className={cn('p-3 rounded-lg border flex items-center justify-between', getRecommendationStyle(analysis.recommendation).bg, getRecommendationStyle(analysis.recommendation).border)}>
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = getRecommendationStyle(analysis.recommendation).icon;
                return <Icon className={cn('w-6 h-6', getRecommendationStyle(analysis.recommendation).color)} />;
              })()}
              <div>
                <span className={cn('text-lg font-bold', getRecommendationStyle(analysis.recommendation).color)}>{recommendationLabel[analysis.recommendation] || analysis.recommendation}</span>
                <p className="text-xs text-muted-foreground">{marketConditionLabel[analysis.marketCondition] || analysis.marketCondition} • {timeframeLabel[analysis.timeframe] || analysis.timeframe}</p>
              </div>
            </div>
            <div className="text-right"><div className="text-2xl font-bold font-mono">{analysis.confidence}%</div><p className="text-xs text-muted-foreground">Confiança</p></div>
          </div>

          <Progress value={analysis.confidence} className={cn('h-2', analysis.confidence >= 70 ? '[&>div]:bg-profit' : analysis.confidence >= 50 ? '[&>div]:bg-warning' : '[&>div]:bg-loss')} />

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded bg-muted/50 text-center"><Target className="w-4 h-4 mx-auto mb-1 text-profit" /><p className="text-[10px] text-muted-foreground">Entrada</p><p className="text-xs font-mono font-medium">{formatPrice(analysis.entryPrice)}</p></div>
            <div className="p-2 rounded bg-muted/50 text-center"><Shield className="w-4 h-4 mx-auto mb-1 text-loss" /><p className="text-[10px] text-muted-foreground">Stop Loss</p><p className="text-xs font-mono font-medium">{formatPrice(analysis.stopLoss)}</p></div>
            <div className="p-2 rounded bg-muted/50 text-center"><TrendingUp className="w-4 h-4 mx-auto mb-1 text-profit" /><p className="text-[10px] text-muted-foreground">Take Profit</p><p className="text-xs font-mono font-medium">{formatPrice(analysis.takeProfit)}</p></div>
          </div>

          {analysis.riskRewardRatio && <div className="flex items-center justify-between p-2 rounded bg-muted/50"><span className="text-xs text-muted-foreground">Risco/Retorno</span><Badge variant="outline" className="font-mono">1:{analysis.riskRewardRatio.toFixed(2)}</Badge></div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {analysis.signals?.bullish?.length > 0 && <div className="p-2 rounded bg-profit/10 border border-profit/20"><p className="text-[10px] font-medium text-profit mb-1">Sinais de Alta</p><ul className="space-y-0.5">{analysis.signals.bullish.slice(0, 3).map((signal, i) => <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1"><TrendingUp className="w-2.5 h-2.5 mt-0.5 text-profit shrink-0" />{translateSignal(signal)}</li>)}</ul></div>}
            {analysis.signals?.bearish?.length > 0 && <div className="p-2 rounded bg-loss/10 border border-loss/20"><p className="text-[10px] font-medium text-loss mb-1">Sinais de Baixa</p><ul className="space-y-0.5">{analysis.signals.bearish.slice(0, 3).map((signal, i) => <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1"><TrendingDown className="w-2.5 h-2.5 mt-0.5 text-loss shrink-0" />{translateSignal(signal)}</li>)}</ul></div>}
          </div>

          {(analysis.keyLevels?.support?.length > 0 || analysis.keyLevels?.resistance?.length > 0) && <div className="p-2 rounded bg-muted/30 border border-border"><p className="text-[10px] font-medium text-muted-foreground mb-2">Níveis Chave</p><div className="grid grid-cols-2 gap-2 text-[10px]">{analysis.keyLevels?.resistance?.length > 0 && <div><span className="text-loss">Resistências:</span><div className="font-mono">{analysis.keyLevels.resistance.slice(0, 2).map(r => formatPrice(r)).join(', ')}</div></div>}{analysis.keyLevels?.support?.length > 0 && <div><span className="text-profit">Suportes:</span><div className="font-mono">{analysis.keyLevels.support.slice(0, 2).map(s => formatPrice(s)).join(', ')}</div></div>}</div></div>}

          <div className="p-2 rounded bg-muted/30 border border-border"><p className="text-[10px] font-medium text-muted-foreground mb-1">Análise</p><p className="text-xs text-foreground/80 leading-relaxed">{translateReasoning(analysis.reasoning, marketData.symbol)}</p></div>
        </div>
      )}

      {!analysis && !isLoading && !error && <div className="text-center py-6 text-muted-foreground"><Brain className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">Clique em "Analisar" para obter insights da IA</p></div>}
    </Card>
  );
};
