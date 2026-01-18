import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, ExternalLink, AlertCircle, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { updateGlobalSentiment } from '@/hooks/useNewsSentiment';

interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  relevance: number;
  summary?: string;
  coins?: string[];
}

// Simulated news feed - In production, this would come from a real API
const generateMockNews = (): NewsItem[] => {
  const sources = ['CoinDesk', 'CoinTelegraph', 'Bloomberg Crypto', 'Reuters', 'The Block', 'Decrypt'];
  const sentiments: ('bullish' | 'bearish' | 'neutral')[] = ['bullish', 'bearish', 'neutral'];
  const coins = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB'];
  
  const headlines = [
    { title: 'Bitcoin ETF registra entrada recorde de $1.2 bilhões', sentiment: 'bullish' as const, coins: ['BTC'] },
    { title: 'Ethereum atinge novo marco com upgrade Dencun', sentiment: 'bullish' as const, coins: ['ETH'] },
    { title: 'Fed mantém taxas de juros estáveis - mercados reagem', sentiment: 'neutral' as const, coins: ['BTC', 'ETH'] },
    { title: 'Reguladores europeus aprovam novo framework crypto', sentiment: 'bullish' as const, coins: ['BTC', 'ETH'] },
    { title: 'Grandes investidores acumulam Bitcoin antes do halving', sentiment: 'bullish' as const, coins: ['BTC'] },
    { title: 'Solana processa 50 milhões de transações em 24h', sentiment: 'bullish' as const, coins: ['SOL'] },
    { title: 'Analistas alertam para possível correção de curto prazo', sentiment: 'bearish' as const, coins: ['BTC', 'ETH'] },
    { title: 'Volume de derivativos de crypto atinge máxima histórica', sentiment: 'neutral' as const, coins: ['BTC'] },
    { title: 'BlackRock aumenta participação em ETF de Bitcoin', sentiment: 'bullish' as const, coins: ['BTC'] },
    { title: 'Tensões geopolíticas elevam demanda por ativos digitais', sentiment: 'bullish' as const, coins: ['BTC'] },
    { title: 'Bybit anuncia expansão para novos mercados', sentiment: 'neutral' as const, coins: ['BTC', 'ETH'] },
    { title: 'Métricas on-chain indicam acumulação institucional', sentiment: 'bullish' as const, coins: ['BTC'] },
  ];

  const now = new Date();
  return headlines.map((headline, index) => ({
    id: `news-${index}-${Date.now()}`,
    title: headline.title,
    source: sources[Math.floor(Math.random() * sources.length)],
    publishedAt: new Date(now.getTime() - index * 1000 * 60 * (5 + Math.random() * 30)).toISOString(),
    url: '#',
    sentiment: headline.sentiment,
    relevance: Math.round(70 + Math.random() * 30),
    coins: headline.coins,
    summary: `Análise detalhada sobre ${headline.title.toLowerCase()}...`
  }));
};

export const LiveNewsPanel = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [aiAnalysis, setAiAnalysis] = useState<{
    overallSentiment: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    summary: string;
  } | null>(null);

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      const newNews = generateMockNews();
      setNews(newNews);
      setLastUpdate(new Date());
      
      // Calculate AI analysis based on news sentiment
      const bullishCount = newNews.filter(n => n.sentiment === 'bullish').length;
      const bearishCount = newNews.filter(n => n.sentiment === 'bearish').length;
      const totalWithSentiment = bullishCount + bearishCount;
      
      let overallSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      let confidence = 50;
      
      if (totalWithSentiment > 0) {
        const bullishRatio = bullishCount / newNews.length;
        const bearishRatio = bearishCount / newNews.length;
        
        if (bullishRatio > 0.5) {
          overallSentiment = 'bullish';
          confidence = Math.round(60 + bullishRatio * 30);
        } else if (bearishRatio > 0.5) {
          overallSentiment = 'bearish';
          confidence = Math.round(60 + bearishRatio * 30);
        } else {
          confidence = Math.round(40 + Math.random() * 20);
        }
      }
      
      const summary = overallSentiment === 'bullish' 
        ? 'Fluxo de notícias predominantemente positivo. IA favorecerá posições LONG.'
        : overallSentiment === 'bearish'
        ? 'Notícias indicam cautela. IA favorecerá posições SHORT.'
        : 'Mercado em consolidação. IA aguardará sinais mais claros.';
      
      setAiAnalysis({
        overallSentiment,
        confidence,
        summary
      });
      
      // Update global sentiment for AI trading decisions
      updateGlobalSentiment({
        overallSentiment,
        confidence,
        summary,
        bullishCount,
        bearishCount,
        totalNews: newNews.length,
      });
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchNews, 120000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return `${Math.floor(diffMins / 1440)}d`;
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return <TrendingUp className="h-3 w-3 text-[hsl(var(--profit))]" />;
      case 'bearish':
        return <TrendingDown className="h-3 w-3 text-[hsl(var(--loss))]" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return 'border-[hsl(var(--profit)/0.3)] bg-[hsl(var(--profit)/0.1)] text-[hsl(var(--profit))]';
      case 'bearish':
        return 'border-[hsl(var(--loss)/0.3)] bg-[hsl(var(--loss)/0.1)] text-[hsl(var(--loss))]';
      default:
        return 'border-border bg-muted/50 text-muted-foreground';
    }
  };

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">📰 Notícias ao Vivo • Análise IA</CardTitle>
          <Badge variant="outline" className="text-[10px] border-primary/50 text-primary gap-1">
            <Brain className="h-3 w-3" />
            Influenciando Trades
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {aiAnalysis && (
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                getSentimentColor(aiAnalysis.overallSentiment)
              )}
            >
              {getSentimentIcon(aiAnalysis.overallSentiment)}
              <span className="ml-1">
                {aiAnalysis.overallSentiment === 'bullish' ? 'Alta' : 
                 aiAnalysis.overallSentiment === 'bearish' ? 'Baixa' : 'Neutro'}
              </span>
              <span className="ml-1 opacity-70">{aiAnalysis.confidence}%</span>
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            Atualizado: {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={fetchNews}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {/* AI Analysis Summary */}
        {aiAnalysis && (
          <div className={cn(
            "mb-3 p-2 rounded-md border text-xs",
            getSentimentColor(aiAnalysis.overallSentiment)
          )}>
            <div className="flex items-center gap-1 mb-1">
              <AlertCircle className="h-3 w-3" />
              <span className="font-medium">Análise IA:</span>
            </div>
            <p className="opacity-90">{aiAnalysis.summary}</p>
          </div>
        )}
        
        {/* News Ticker - Horizontal Scrolling */}
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {news.slice(0, 8).map((item) => (
              <div 
                key={item.id}
                className={cn(
                  "flex-shrink-0 w-[280px] p-2 rounded-md border cursor-pointer",
                  "hover:bg-muted/30 transition-colors",
                  getSentimentColor(item.sentiment)
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1">
                    {getSentimentIcon(item.sentiment)}
                    <span className="text-[10px] font-medium opacity-70">{item.source}</span>
                  </div>
                  <span className="text-[10px] opacity-50">{formatTimeAgo(item.publishedAt)}</span>
                </div>
                <p className="text-xs font-medium line-clamp-2 mb-1">{item.title}</p>
                <div className="flex items-center gap-1">
                  {item.coins?.map(coin => (
                    <span key={coin} className="inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] font-semibold h-4 bg-secondary text-secondary-foreground">
                      {coin}
                    </span>
                  ))}
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-auto">
                    {item.relevance}% relevante
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
