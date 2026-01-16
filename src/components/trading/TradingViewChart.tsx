import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CandlestickChart, ZoomIn, ZoomOut, Maximize2, TrendingUp, TrendingDown } from 'lucide-react';

interface Candle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface TradeMarker {
  time: Time;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle';
  text: string;
  size?: number;
}

interface TradingViewChartProps {
  symbol?: string;
  candles?: Candle[];
  trades?: TradeMarker[];
  height?: number;
}

// Generate realistic OHLC data
const generateCandleData = (symbol: string, days: number = 90): Candle[] => {
  const candles: Candle[] = [];
  const basePrice = symbol === 'BTCUSDT' ? 95000 : symbol === 'ETHUSDT' ? 3200 : 180;
  let price = basePrice;
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const volatility = basePrice * 0.015;
    const trend = Math.sin(i / 20) * 0.003;
    
    const open = price;
    const change = (Math.random() - 0.5 + trend) * volatility;
    price = Math.max(basePrice * 0.8, Math.min(basePrice * 1.2, price + change));
    const close = price;
    
    const highExtra = Math.random() * volatility * 0.3;
    const lowExtra = Math.random() * volatility * 0.3;
    
    candles.push({
      time: (date.getTime() / 1000) as Time,
      open,
      high: Math.max(open, close) + highExtra,
      low: Math.min(open, close) - lowExtra,
      close,
      volume: Math.random() * 1000000000 + 500000000,
    });
  }
  
  return candles;
};

// Generate trade markers from AI decisions
const generateTradeMarkers = (candles: Candle[]): TradeMarker[] => {
  const markers: TradeMarker[] = [];
  const tradeCount = Math.floor(candles.length * 0.15);
  
  for (let i = 0; i < tradeCount; i++) {
    const candleIndex = Math.floor(Math.random() * (candles.length - 10)) + 5;
    const candle = candles[candleIndex];
    const isLong = Math.random() > 0.5;
    const isWin = Math.random() > 0.35;
    
    markers.push({
      time: candle.time,
      position: isLong ? 'belowBar' : 'aboveBar',
      color: isWin ? '#22c55e' : '#ef4444',
      shape: isLong ? 'arrowUp' : 'arrowDown',
      text: isWin ? (isLong ? 'L+' : 'S+') : (isLong ? 'L-' : 'S-'),
      size: 1,
    });
  }
  
  return markers.sort((a, b) => (a.time as number) - (b.time as number));
};

export const TradingViewChart = ({ 
  symbol = 'BTCUSDT', 
  candles: externalCandles,
  trades: externalTrades,
  height = 400 
}: TradingViewChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);

  const timeframes = ['15m', '1H', '4H', '1D', '1W'];

  const initChart = useCallback(() => {
    if (!chartContainerRef.current) return;

    // Clear existing chart
    if (chartRef.current) {
      chartRef.current.remove();
    }

    // Create chart with TradingView-like styling (using hex colors - lightweight-charts doesn't support HSL)
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#6b7280',
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#3b82f6',
          width: 1,
          style: 2,
          labelBackgroundColor: '#3b82f6',
        },
        horzLine: {
          color: '#3b82f6',
          width: 1,
          style: 2,
          labelBackgroundColor: '#3b82f6',
        },
      },
      rightPriceScale: {
        borderColor: '#334155',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    // Candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Volume series
    const volumeSeries = chart.addHistogramSeries({
      color: 'rgba(79, 172, 254, 0.3)',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Load data
    const candleData = externalCandles || generateCandleData(symbol);
    const tradeMarkers = externalTrades || generateTradeMarkers(candleData);
    
    candlestickSeries.setData(candleData as CandlestickData[]);
    
    // Volume data
    const volumeData = candleData.map(c => ({
      time: c.time,
      value: c.volume || 0,
      color: c.close >= c.open ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
    }));
    volumeSeries.setData(volumeData);

    // Add trade markers
    candlestickSeries.setMarkers(tradeMarkers as any);

    // Calculate price info
    if (candleData.length > 0) {
      const lastCandle = candleData[candleData.length - 1];
      const firstCandle = candleData[0];
      setCurrentPrice(lastCandle.close);
      setPriceChange(((lastCandle.close - firstCandle.close) / firstCandle.close) * 100);
    }

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: height,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [symbol, height, externalCandles, externalTrades]);

  useEffect(() => {
    const cleanup = initChart();
    return () => {
      cleanup?.();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [initChart]);

  const handleZoomIn = () => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleLogicalRange();
      if (visibleRange) {
        const newRange = {
          from: visibleRange.from + (visibleRange.to - visibleRange.from) * 0.2,
          to: visibleRange.to - (visibleRange.to - visibleRange.from) * 0.2,
        };
        timeScale.setVisibleLogicalRange(newRange);
      }
    }
  };

  const handleZoomOut = () => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleLogicalRange();
      if (visibleRange) {
        const newRange = {
          from: visibleRange.from - (visibleRange.to - visibleRange.from) * 0.3,
          to: visibleRange.to + (visibleRange.to - visibleRange.from) * 0.3,
        };
        timeScale.setVisibleLogicalRange(newRange);
      }
    }
  };

  const handleFitContent = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CandlestickChart className="w-5 h-5 text-accent" />
              {symbol}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono font-bold text-foreground">
                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <Badge 
                variant="outline"
                className={priceChange >= 0 ? 'text-profit border-profit/50' : 'text-loss border-loss/50'}
              >
                {priceChange >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Timeframe Selector */}
            <div className="flex bg-muted/30 rounded-md p-0.5 border border-border/50">
              {timeframes.map((tf) => (
                <Button
                  key={tf}
                  variant="ghost"
                  size="sm"
                  className={`px-2 py-1 h-7 text-xs ${
                    selectedTimeframe === tf
                      ? 'bg-accent/20 text-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setSelectedTimeframe(tf)}
                >
                  {tf}
                </Button>
              ))}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 border-l border-border/50 pl-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleFitContent}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={chartContainerRef} style={{ height: `${height}px` }} />
        
        {/* Trade Legend */}
        <div className="flex justify-center gap-6 py-2 border-t border-border/50 bg-muted/10">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-profit" />
            <span className="text-muted-foreground">Long Win</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-profit" />
            <span className="text-muted-foreground">Short Win</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-loss" />
            <span className="text-muted-foreground">Long Loss</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-loss" />
            <span className="text-muted-foreground">Short Loss</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
