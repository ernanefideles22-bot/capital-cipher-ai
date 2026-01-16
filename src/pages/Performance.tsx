import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useTradesDB } from '@/hooks/useTradesDB';
import { exportToCSV, exportToExcel, exportSummaryToCSV } from '@/utils/exportTrades';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { ArrowLeft, TrendingUp, TrendingDown, Target, Activity, Download, DollarSign, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import type { Trade } from '@/types/trading';

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const Performance = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loadTrades, loadBotStats } = useTradesDB(user?.id);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      const [tradesResult, statsResult] = await Promise.all([
        loadTrades(500),
        loadBotStats()
      ]);
      
      if (tradesResult.data) {
        setTrades(tradesResult.data);
      }
      if (statsResult.data) {
        setStats(statsResult.data);
      }
      setLoading(false);
    };
    
    fetchData();
  }, [user, loadTrades, loadBotStats]);

  // Calculate cumulative P&L data
  const cumulativePnLData = trades
    .filter(t => t.status === 'CLOSED' && t.pnl !== undefined)
    .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime())
    .reduce((acc, trade, index) => {
      const prevPnL = acc.length > 0 ? acc[acc.length - 1].cumulativePnL : 0;
      acc.push({
        date: new Date(trade.closedAt!).toLocaleDateString('pt-BR'),
        pnl: trade.pnl || 0,
        cumulativePnL: prevPnL + (trade.pnl || 0),
        trade: index + 1,
      });
      return acc;
    }, [] as { date: string; pnl: number; cumulativePnL: number; trade: number }[]);

  // Calculate daily P&L
  const dailyPnLData = trades
    .filter(t => t.status === 'CLOSED' && t.pnl !== undefined)
    .reduce((acc, trade) => {
      const date = new Date(trade.closedAt!).toLocaleDateString('pt-BR');
      const existing = acc.find(d => d.date === date);
      if (existing) {
        existing.pnl += trade.pnl || 0;
        existing.trades += 1;
      } else {
        acc.push({ date, pnl: trade.pnl || 0, trades: 1 });
      }
      return acc;
    }, [] as { date: string; pnl: number; trades: number }[])
    .slice(-30);

  // Calculate symbol distribution
  const symbolData = trades
    .filter(t => t.status === 'CLOSED')
    .reduce((acc, trade) => {
      const existing = acc.find(d => d.symbol === trade.symbol);
      if (existing) {
        existing.trades += 1;
        existing.pnl += trade.pnl || 0;
      } else {
        acc.push({ symbol: trade.symbol, trades: 1, pnl: trade.pnl || 0 });
      }
      return acc;
    }, [] as { symbol: string; trades: number; pnl: number }[])
    .sort((a, b) => b.trades - a.trades);

  // Win/Loss distribution
  const winLossData = [
    { name: 'Ganhos', value: trades.filter(t => t.status === 'CLOSED' && (t.pnl || 0) > 0).length, color: '#22c55e' },
    { name: 'Perdas', value: trades.filter(t => t.status === 'CLOSED' && (t.pnl || 0) < 0).length, color: '#ef4444' },
  ];

  // Strategy performance
  const strategyData = trades
    .filter(t => t.status === 'CLOSED' && t.strategy)
    .reduce((acc, trade) => {
      const existing = acc.find(d => d.strategy === trade.strategy);
      if (existing) {
        existing.trades += 1;
        existing.pnl += trade.pnl || 0;
        if ((trade.pnl || 0) > 0) existing.wins += 1;
      } else {
        acc.push({ 
          strategy: trade.strategy!, 
          trades: 1, 
          pnl: trade.pnl || 0,
          wins: (trade.pnl || 0) > 0 ? 1 : 0
        });
      }
      return acc;
    }, [] as { strategy: string; trades: number; pnl: number; wins: number }[]);

  // Calculate metrics
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
  const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + (t.pnl || 0), 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((s, t) => s + (t.pnl || 0), 0) / losingTrades.length) : 0;
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
  const bestTrade = Math.max(...closedTrades.map(t => t.pnl || 0), 0);
  const worstTrade = Math.min(...closedTrades.map(t => t.pnl || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Dashboard de Performance</h1>
              <p className="text-sm text-muted-foreground">Análise detalhada dos seus trades</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToCSV(trades, 'trades');
                toast.success('Trades exportados para CSV!');
              }}
              disabled={trades.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToExcel(trades, 'trades');
                toast.success('Trades exportados para Excel!');
              }}
              disabled={trades.length === 0}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                exportSummaryToCSV({
                  totalPnL,
                  winRate,
                  totalTrades: closedTrades.length,
                  profitFactor,
                  avgWin,
                  avgLoss,
                  bestTrade,
                  worstTrade
                }, 'performance_summary');
                toast.success('Resumo exportado!');
              }}
              disabled={trades.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar Resumo
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="h-4 w-4" />
                P&L Total
              </div>
              <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${totalPnL.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Target className="h-4 w-4" />
                Win Rate
              </div>
              <p className="text-2xl font-bold">{winRate.toFixed(1)}%</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Activity className="h-4 w-4" />
                Total Trades
              </div>
              <p className="text-2xl font-bold">{closedTrades.length}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                Profit Factor
              </div>
              <p className="text-2xl font-bold">{profitFactor.toFixed(2)}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Melhor Trade
              </div>
              <p className="text-2xl font-bold text-green-500">${bestTrade.toFixed(2)}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Pior Trade
              </div>
              <p className="text-2xl font-bold text-red-500">${worstTrade.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pnl" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pnl">Evolução P&L</TabsTrigger>
            <TabsTrigger value="daily">P&L Diário</TabsTrigger>
            <TabsTrigger value="symbols">Por Ativo</TabsTrigger>
            <TabsTrigger value="strategy">Por Estratégia</TabsTrigger>
          </TabsList>

          <TabsContent value="pnl" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Evolução do P&L Acumulado</CardTitle>
                <CardDescription>Crescimento do lucro/prejuízo ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  {cumulativePnLData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cumulativePnLData}>
                        <defs>
                          <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="trade" stroke="#888" fontSize={12} />
                        <YAxis stroke="#888" fontSize={12} tickFormatter={(v) => `$${v}`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                          formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="cumulativePnL" 
                          stroke="#22c55e" 
                          fill="url(#colorPnL)" 
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Nenhum trade fechado ainda
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="daily" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>P&L Diário</CardTitle>
                <CardDescription>Lucro/prejuízo por dia (últimos 30 dias)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  {dailyPnLData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyPnLData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" stroke="#888" fontSize={10} angle={-45} textAnchor="end" height={80} />
                        <YAxis stroke="#888" fontSize={12} tickFormatter={(v) => `$${v}`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                          formatter={(value: number, name: string) => [
                            name === 'pnl' ? `$${value.toFixed(2)}` : value,
                            name === 'pnl' ? 'P&L' : 'Trades'
                          ]}
                        />
                        <Bar 
                          dataKey="pnl" 
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Nenhum trade fechado ainda
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="symbols" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição por Ativo</CardTitle>
                  <CardDescription>Número de trades por par</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {symbolData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={symbolData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            dataKey="trades"
                            nameKey="symbol"
                            label={({ symbol, percent }) => `${symbol} ${(percent * 100).toFixed(0)}%`}
                          >
                            {symbolData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        Nenhum trade ainda
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>P&L por Ativo</CardTitle>
                  <CardDescription>Lucro/prejuízo acumulado por par</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {symbolData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={symbolData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis type="number" stroke="#888" fontSize={12} tickFormatter={(v) => `$${v}`} />
                          <YAxis type="category" dataKey="symbol" stroke="#888" fontSize={12} width={80} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                            formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
                          />
                          <Bar 
                            dataKey="pnl"
                            radius={[0, 4, 4, 0]}
                          >
                            {symbolData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        Nenhum trade ainda
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="strategy" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Win/Loss Ratio</CardTitle>
                  <CardDescription>Proporção de trades vencedores vs perdedores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {closedTrades.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={winLossData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {winLossData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        Nenhum trade fechado ainda
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance por Estratégia</CardTitle>
                  <CardDescription>Comparação entre SCALP, DAYTRADE e SWING</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {strategyData.length > 0 ? (
                      strategyData.map((strategy, index) => (
                        <div key={strategy.strategy} className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{strategy.strategy}</span>
                            <span className={`font-bold ${strategy.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              ${strategy.pnl.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{strategy.trades} trades</span>
                            <span>Win Rate: {((strategy.wins / strategy.trades) * 100).toFixed(1)}%</span>
                          </div>
                          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${(strategy.wins / strategy.trades) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                        Nenhum trade com estratégia definida
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Recent Trades Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Métricas Avançadas</CardTitle>
            <CardDescription>Estatísticas detalhadas de performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Média de Ganho</p>
                <p className="text-xl font-bold text-green-500">${avgWin.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Média de Perda</p>
                <p className="text-xl font-bold text-red-500">${avgLoss.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Trades Vencedores</p>
                <p className="text-xl font-bold">{winningTrades.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-1">Trades Perdedores</p>
                <p className="text-xl font-bold">{losingTrades.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Performance;
