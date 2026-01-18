import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Zap,
  BarChart3,
  Activity,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Minus
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
} from 'recharts';

interface StrategyWeight {
  name: string;
  weight: number;
  winRate: number;
  trades: number;
  trend: 'up' | 'down' | 'stable';
  pnl: number;
}

interface LearningMetric {
  epoch: number;
  accuracy: number;
  loss: number;
  winRate: number;
}

interface AILearningPanelProps {
  className?: string;
  isRealMode?: boolean;
}

// Generate realistic AI learning data
const generateLearningData = (): LearningMetric[] => {
  const data: LearningMetric[] = [];
  let accuracy = 45;
  let loss = 0.8;
  let winRate = 48;
  
  for (let i = 1; i <= 50; i++) {
    // Gradual improvement with some noise
    accuracy = Math.min(92, accuracy + (Math.random() - 0.3) * 2);
    loss = Math.max(0.05, loss - (Math.random() * 0.03));
    winRate = Math.min(78, winRate + (Math.random() - 0.35) * 1.5);
    
    data.push({
      epoch: i,
      accuracy: parseFloat(accuracy.toFixed(1)),
      loss: parseFloat(loss.toFixed(3)),
      winRate: parseFloat(winRate.toFixed(1)),
    });
  }
  
  return data;
};

const generateStrategyWeights = (): StrategyWeight[] => [
  { 
    name: 'Scalp', 
    weight: 35, 
    winRate: 72, 
    trades: 156, 
    trend: 'up', 
    pnl: 4520 
  },
  { 
    name: 'DayTrade', 
    weight: 40, 
    winRate: 68, 
    trades: 89, 
    trend: 'stable', 
    pnl: 6230 
  },
  { 
    name: 'Swing', 
    weight: 25, 
    winRate: 75, 
    trades: 23, 
    trend: 'down', 
    pnl: 3890 
  },
];

const generateRadarData = () => [
  { metric: 'Volume', value: 85, fullMark: 100 },
  { metric: 'Momentum', value: 72, fullMark: 100 },
  { metric: 'Trend', value: 90, fullMark: 100 },
  { metric: 'Volatility', value: 65, fullMark: 100 },
  { metric: 'Liquidity', value: 78, fullMark: 100 },
  { metric: 'Institutional', value: 88, fullMark: 100 },
];

export const AILearningPanel = ({ className, isRealMode = false }: AILearningPanelProps) => {
  const [activeTab, setActiveTab] = useState('evolution');
  
  const learningData = useMemo(() => generateLearningData(), []);
  const strategyWeights = useMemo(() => generateStrategyWeights(), []);
  const radarData = useMemo(() => generateRadarData(), []);
  
  const currentAccuracy = learningData[learningData.length - 1]?.accuracy || 0;
  const currentWinRate = learningData[learningData.length - 1]?.winRate || 0;
  const totalTrades = strategyWeights.reduce((acc, s) => acc + s.trades, 0);
  const totalPnL = strategyWeights.reduce((acc, s) => acc + s.pnl, 0);

  // Hide panel in real mode - AI uses demo memories internally but doesn't show them
  if (isRealMode) {
    return null;
  }

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    if (trend === 'up') return <ChevronUp className="w-3 h-3 text-profit" />;
    if (trend === 'down') return <ChevronDown className="w-3 h-3 text-loss" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <Card className={`glass-card ${className}`}>
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base">
            <Brain className="w-5 h-5 text-accent animate-pulse" />
            IA Evolutiva
          </div>
          <Badge variant="outline" className="text-xs bg-accent/10 border-accent/50 text-accent">
            <Sparkles className="w-3 h-3 mr-1" />
            Aprendendo
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-3">
        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Precisão</div>
            <div className="text-lg font-bold font-mono text-accent">{currentAccuracy}%</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
            <div className="text-lg font-bold font-mono text-profit">{currentWinRate}%</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Trades</div>
            <div className="text-lg font-bold font-mono text-foreground">{totalTrades}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">P&L</div>
            <div className="text-lg font-bold font-mono text-profit">+${totalPnL.toLocaleString()}</div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 mb-3 bg-muted/30">
            <TabsTrigger value="evolution" className="text-xs data-[state=active]:bg-accent/20">
              <Activity className="w-3 h-3 mr-1" />
              Evolução
            </TabsTrigger>
            <TabsTrigger value="strategies" className="text-xs data-[state=active]:bg-accent/20">
              <BarChart3 className="w-3 h-3 mr-1" />
              Estratégias
            </TabsTrigger>
            <TabsTrigger value="analysis" className="text-xs data-[state=active]:bg-accent/20">
              <Target className="w-3 h-3 mr-1" />
              Análise
            </TabsTrigger>
          </TabsList>

          <TabsContent value="evolution" className="mt-0">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={learningData}>
                  <defs>
                    <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="winRateGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--profit))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--profit))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="epoch" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    domain={[40, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}%`,
                      name === 'accuracy' ? 'Precisão' : 'Win Rate'
                    ]}
                    labelFormatter={(label) => `Época ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="accuracy"
                    stroke="hsl(var(--accent))"
                    fill="url(#accuracyGradient)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="winRate"
                    stroke="hsl(var(--profit))"
                    fill="url(#winRateGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-2">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-0.5 bg-accent rounded" />
                <span className="text-muted-foreground">Precisão IA</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-0.5 bg-profit rounded" />
                <span className="text-muted-foreground">Win Rate</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="strategies" className="mt-0 space-y-2">
            {strategyWeights.map((strategy) => (
              <div 
                key={strategy.name}
                className="p-2 rounded-lg bg-muted/20 border border-border/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent" />
                    <span className="font-medium text-sm">{strategy.name}</span>
                    <TrendIcon trend={strategy.trend} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {strategy.trades} trades
                    </Badge>
                    <span className={`text-xs font-mono ${strategy.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      +${strategy.pnl.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Peso IA</span>
                    <span className="font-mono">{strategy.weight}%</span>
                  </div>
                  <Progress value={strategy.weight} className="h-1.5" />
                </div>
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-muted-foreground">Win Rate</span>
                  <span className="font-mono text-profit">{strategy.winRate}%</span>
                </div>
              </div>
            ))}
            
            <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border/50">
              <Sparkles className="w-3 h-3 inline mr-1" />
              Pesos ajustados automaticamente baseado em performance
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="mt-0">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis 
                    dataKey="metric" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                  />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke="hsl(var(--accent))"
                    fill="hsl(var(--accent))"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Score']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center text-xs text-muted-foreground">
              Análise multi-fator em tempo real
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
