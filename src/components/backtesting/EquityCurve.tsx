import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { 
  ComposedChart, 
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import type { BacktestResults } from '@/types/backtesting';

interface EquityCurveProps {
  results: BacktestResults;
  initialCapital: number;
}

export const EquityCurve = ({ results, initialCapital }: EquityCurveProps) => {
  const data = results.equityCurve.map(point => ({
    time: new Date(point.time).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    }),
    equity: point.equity,
    drawdown: -point.drawdown,
  }));

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="w-4 h-4 text-accent" />
          Curva de Equity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--profit))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--profit))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--loss))" stopOpacity={0} />
                  <stop offset="95%" stopColor="hsl(var(--loss))" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              
              <XAxis 
                dataKey="time" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                interval="preserveStartEnd"
              />
              
              <YAxis 
                yAxisId="equity"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                domain={['dataMin - 1000', 'dataMax + 1000']}
              />
              
              <YAxis 
                yAxisId="drawdown"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickFormatter={(value) => `${value.toFixed(0)}%`}
                domain={[-20, 0]}
              />
              
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string) => {
                  if (name === 'equity') {
                    return [`$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, 'Equity'];
                  }
                  return [`${value.toFixed(1)}%`, 'Drawdown'];
                }}
              />
              
              <ReferenceLine 
                y={initialCapital} 
                yAxisId="equity"
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
              
              <Area
                yAxisId="drawdown"
                type="monotone"
                dataKey="drawdown"
                stroke="hsl(var(--loss))"
                strokeWidth={1}
                fill="url(#drawdownGradient)"
                fillOpacity={1}
              />
              
              <Area
                yAxisId="equity"
                type="monotone"
                dataKey="equity"
                stroke="hsl(var(--profit))"
                strokeWidth={2}
                fill="url(#equityGradient)"
                fillOpacity={1}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex justify-center gap-6 mt-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-profit rounded" />
            <span className="text-muted-foreground">Equity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-loss/30 rounded" />
            <span className="text-muted-foreground">Drawdown</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
