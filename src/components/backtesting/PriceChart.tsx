import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CandlestickChart } from 'lucide-react';
import { 
  ComposedChart, 
  Bar, 
  Line,
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Scatter
} from 'recharts';
import type { BacktestCandle, BacktestTrade } from '@/types/backtesting';

interface PriceChartProps {
  candles: BacktestCandle[];
  trades: BacktestTrade[];
  symbol: string;
}

export const PriceChart = ({ candles, trades, symbol }: PriceChartProps) => {
  // Sample candles for display (every 96th = ~1 day at 15min intervals)
  const sampleRate = Math.max(1, Math.floor(candles.length / 100));
  const sampledCandles = candles
    .filter((_, i) => i % sampleRate === 0)
    .map(c => ({
      time: new Date(c.time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      range: [c.low, c.high],
      body: [Math.min(c.open, c.close), Math.max(c.open, c.close)],
      bullish: c.close >= c.open,
    }));

  // Map trades to chart coordinates
  const tradeMarkers = trades.slice(-20).map(t => {
    const candleIndex = sampledCandles.findIndex(
      c => c.time === new Date(t.entryTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    );
    if (candleIndex === -1) return null;
    return {
      time: sampledCandles[candleIndex]?.time,
      price: t.entryPrice,
      side: t.side,
      pnl: t.pnl,
    };
  }).filter(Boolean);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CandlestickChart className="w-4 h-4 text-accent" />
          Gráfico de Preços - {symbol}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={sampledCandles}>
              <XAxis 
                dataKey="time" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                domain={['auto', 'auto']}
                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'close') return [`$${value.toFixed(2)}`, 'Fechamento'];
                  if (name === 'high') return [`$${value.toFixed(2)}`, 'Máxima'];
                  if (name === 'low') return [`$${value.toFixed(2)}`, 'Mínima'];
                  if (name === 'open') return [`$${value.toFixed(2)}`, 'Abertura'];
                  return [value, name];
                }}
              />
              
              {/* Price line */}
              <Line
                type="monotone"
                dataKey="close"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={false}
              />
              
              {/* Trade markers */}
              <Scatter
                data={tradeMarkers}
                dataKey="price"
                fill="hsl(var(--warning))"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex justify-center gap-6 mt-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-accent rounded" />
            <span className="text-muted-foreground">Preço</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-muted-foreground">Trades</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
