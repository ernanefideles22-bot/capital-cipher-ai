import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';

export const PnLChart = () => {
  const data = useMemo(() => {
    const points = [];
    let cumulative = 0;
    const now = new Date();
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const dailyPnL = (Math.random() - 0.35) * 500; // Slight positive bias
      cumulative += dailyPnL;
      
      points.push({
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        pnl: cumulative,
        daily: dailyPnL,
      });
    }
    return points;
  }, []);

  const isPositive = data[data.length - 1]?.pnl >= 0;

  return (
    <div className="glass-card p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Curva de Equity</h3>
        </div>
        <span className="text-xs text-muted-foreground">Últimos 30 dias</span>
      </div>
      
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop 
                  offset="5%" 
                  stopColor={isPositive ? "hsl(142, 76%, 45%)" : "hsl(0, 72%, 51%)"} 
                  stopOpacity={0.3}
                />
                <stop 
                  offset="95%" 
                  stopColor={isPositive ? "hsl(142, 76%, 45%)" : "hsl(0, 72%, 51%)"} 
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(222, 30%, 18%)" 
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 10 }}
              axisLine={{ stroke: 'hsl(222, 30%, 18%)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis 
              tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 10 }}
              axisLine={{ stroke: 'hsl(222, 30%, 18%)' }}
              tickLine={false}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 10%)',
                border: '1px solid hsl(222, 30%, 18%)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'hsl(210, 20%, 95%)' }}
              formatter={(value: number) => [
                `$${value.toFixed(2)}`,
                'P&L Acumulado'
              ]}
            />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke={isPositive ? "hsl(142, 76%, 45%)" : "hsl(0, 72%, 51%)"}
              strokeWidth={2}
              fill="url(#pnlGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
