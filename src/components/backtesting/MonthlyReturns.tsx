import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import type { BacktestResults } from '@/types/backtesting';

interface MonthlyReturnsProps {
  results: BacktestResults;
}

export const MonthlyReturns = ({ results }: MonthlyReturnsProps) => {
  const data = results.monthlyReturns.map(m => ({
    month: m.month.slice(5), // Just MM
    return: m.return,
    label: new Date(m.month + '-01').toLocaleDateString('pt-BR', { 
      month: 'short', 
      year: '2-digit' 
    }),
  }));

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="w-4 h-4 text-accent" />
          Retornos Mensais
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis 
                dataKey="label" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickFormatter={(value) => `${value.toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Retorno']}
                labelFormatter={(label) => label}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="return" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={entry.return >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
