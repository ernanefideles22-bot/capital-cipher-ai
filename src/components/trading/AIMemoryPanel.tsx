import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  BookOpen,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Zap,
  BarChart3,
  Sparkles,
  History,
  Award,
  XCircle,
  Database,
  LineChart
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

interface LearnedPattern {
  id: string;
  name: string;
  description: string;
  confidence: number;
  timesDetected: number;
  successRate: number;
  lastSeen: Date;
  category: 'bullish' | 'bearish' | 'neutral';
}

interface TradeLesson {
  id: string;
  date: Date;
  symbol: string;
  lesson: string;
  outcome: 'positive' | 'negative' | 'neutral';
  impact: number; // -100 to 100
  applied: boolean;
}

interface StrategyEvolution {
  epoch: number;
  date: Date;
  changes: string[];
  performance: number;
}

interface MemoryStats {
  totalTradesAnalyzed: number;
  patternsLearned: number;
  lessonsStored: number;
  accuracyImprovement: number;
  daysLearning: number;
  lastUpdate: Date;
}

// Generate realistic AI memory data
const generatePatterns = (): LearnedPattern[] => [
  {
    id: '1',
    name: 'Acúmulo Institucional',
    description: 'Volume crescente em suportes com price action lateral indica entrada de grandes players',
    confidence: 92,
    timesDetected: 156,
    successRate: 78,
    lastSeen: new Date(Date.now() - 3600000),
    category: 'bullish'
  },
  {
    id: '2', 
    name: 'Distribuição em Topo',
    description: 'Aumento de volume em resistências com rejeições indica saída institucional',
    confidence: 88,
    timesDetected: 134,
    successRate: 72,
    lastSeen: new Date(Date.now() - 7200000),
    category: 'bearish'
  },
  {
    id: '3',
    name: 'Liquidity Grab',
    description: 'Movimento rápido além de níveis chave seguido de reversão = stop hunt',
    confidence: 85,
    timesDetected: 89,
    successRate: 68,
    lastSeen: new Date(Date.now() - 14400000),
    category: 'neutral'
  },
  {
    id: '4',
    name: 'Volume Divergence',
    description: 'Preço subindo com volume decrescente = fraqueza, provável reversão',
    confidence: 82,
    timesDetected: 201,
    successRate: 65,
    lastSeen: new Date(Date.now() - 1800000),
    category: 'bearish'
  },
  {
    id: '5',
    name: 'Break & Retest',
    description: 'Rompimento de estrutura seguido de pullback ao nível = entrada de alta probabilidade',
    confidence: 90,
    timesDetected: 178,
    successRate: 74,
    lastSeen: new Date(Date.now() - 5400000),
    category: 'bullish'
  },
  {
    id: '6',
    name: 'Fair Value Gap',
    description: 'Gaps de preço criados por movimentos impulsivos tendem a ser preenchidos',
    confidence: 79,
    timesDetected: 112,
    successRate: 61,
    lastSeen: new Date(Date.now() - 10800000),
    category: 'neutral'
  },
  {
    id: '7',
    name: 'Order Block',
    description: 'Última vela antes de movimento impulsivo = zona de alta demanda/oferta',
    confidence: 87,
    timesDetected: 145,
    successRate: 70,
    lastSeen: new Date(Date.now() - 2700000),
    category: 'bullish'
  },
  {
    id: '8',
    name: 'Asian Session Range',
    description: 'Range da sessão asiática frequentemente define direção do dia',
    confidence: 75,
    timesDetected: 230,
    successRate: 58,
    lastSeen: new Date(Date.now() - 43200000),
    category: 'neutral'
  },
];

const generateLessons = (): TradeLesson[] => [
  {
    id: '1',
    date: new Date(Date.now() - 86400000 * 2),
    symbol: 'BTCUSDT',
    lesson: 'Não abrir posições durante anúncios do FOMC - volatilidade extrema causa stops prematuros',
    outcome: 'negative',
    impact: -85,
    applied: true
  },
  {
    id: '2',
    date: new Date(Date.now() - 86400000 * 5),
    symbol: 'ETHUSDT',
    lesson: 'Scalps durante baixa liquidez (asiática) têm spreads maiores e slippage aumentado',
    outcome: 'negative',
    impact: -60,
    applied: true
  },
  {
    id: '3',
    date: new Date(Date.now() - 86400000 * 8),
    symbol: 'BTCUSDT',
    lesson: 'Confluência de 3+ indicadores gera win rate 15% maior que sinal único',
    outcome: 'positive',
    impact: 90,
    applied: true
  },
  {
    id: '4',
    date: new Date(Date.now() - 86400000 * 12),
    symbol: 'SOLUSDT',
    lesson: 'Altcoins seguem BTC em 78% dos casos - verificar correlação antes de entrar',
    outcome: 'positive',
    impact: 75,
    applied: true
  },
  {
    id: '5',
    date: new Date(Date.now() - 86400000 * 15),
    symbol: 'BTCUSDT',
    lesson: 'Trailing stop de 1.5x ATR preserva lucros em 67% dos trades vencedores',
    outcome: 'positive',
    impact: 82,
    applied: true
  },
  {
    id: '6',
    date: new Date(Date.now() - 86400000 * 20),
    symbol: 'ETHUSDT',
    lesson: 'Evitar trades após 3 perdas consecutivas - cooldown de 2h melhora recuperação',
    outcome: 'negative',
    impact: -70,
    applied: true
  },
  {
    id: '7',
    date: new Date(Date.now() - 86400000 * 25),
    symbol: 'BTCUSDT',
    lesson: 'Domingo 00h-08h UTC tem reversões falsas 40% mais frequentes',
    outcome: 'negative',
    impact: -55,
    applied: true
  },
  {
    id: '8',
    date: new Date(Date.now() - 86400000 * 30),
    symbol: 'SOLUSDT',
    lesson: 'Volume profile mostra zonas de valor com precisão 82% para reversões',
    outcome: 'positive',
    impact: 88,
    applied: true
  },
];

const generateEvolution = (): StrategyEvolution[] => {
  const evolutions: StrategyEvolution[] = [];
  let performance = 45;
  
  for (let i = 1; i <= 20; i++) {
    performance = Math.min(92, performance + (Math.random() - 0.2) * 8);
    
    const changes = [
      'Ajuste de peso: Scalp +5%',
      'Novo filtro de volatilidade adicionado',
      'Stop loss dinâmico ativado',
      'Filtro de sessão asiática implementado',
      'Cooldown após perdas aumentado',
      'Confluência mínima aumentada para 3',
      'Volume threshold ajustado',
      'Risk/Reward mínimo: 1.5',
    ];
    
    evolutions.push({
      epoch: i,
      date: new Date(Date.now() - (20 - i) * 86400000 * 3),
      changes: [changes[Math.floor(Math.random() * changes.length)]],
      performance: parseFloat(performance.toFixed(1)),
    });
  }
  
  return evolutions;
};

const generateMemoryStats = (): MemoryStats => ({
  totalTradesAnalyzed: 2847,
  patternsLearned: 23,
  lessonsStored: 156,
  accuracyImprovement: 34.5,
  daysLearning: 127,
  lastUpdate: new Date(),
});

interface AIMemoryPanelProps {
  isRealMode?: boolean;
}

export const AIMemoryPanel = ({ isRealMode = false }: AIMemoryPanelProps) => {
  const [activeTab, setActiveTab] = useState('patterns');
  
  const patterns = useMemo(() => generatePatterns(), []);
  const lessons = useMemo(() => generateLessons(), []);
  const evolution = useMemo(() => generateEvolution(), []);
  const stats = useMemo(() => generateMemoryStats(), []);

  // Hide panel in real mode - AI uses demo memories internally but doesn't show them
  if (isRealMode) {
    return null;
  }

  const categoryColors = {
    bullish: 'text-profit border-profit/50 bg-profit/10',
    bearish: 'text-loss border-loss/50 bg-loss/10',
    neutral: 'text-warning border-warning/50 bg-warning/10',
  };

  const lessonsByOutcome = useMemo(() => {
    const positive = lessons.filter(l => l.outcome === 'positive').length;
    const negative = lessons.filter(l => l.outcome === 'negative').length;
    const neutral = lessons.filter(l => l.outcome === 'neutral').length;
    return [
      { name: 'Lições Positivas', value: positive, color: '#22c55e' },
      { name: 'Lições Negativas', value: negative, color: '#ef4444' },
      { name: 'Lições Neutras', value: neutral, color: '#f59e0b' },
    ];
  }, [lessons]);

  const patternSuccessData = useMemo(() => 
    patterns.slice(0, 6).map(p => ({
      name: p.name.split(' ')[0],
      success: p.successRate,
      detections: p.timesDetected,
    }))
  , [patterns]);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base">
            <Database className="w-5 h-5 text-accent animate-pulse" />
            Memória da IA
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-accent/10 border-accent/50 text-accent">
              <Sparkles className="w-3 h-3 mr-1" />
              {stats.daysLearning} dias
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              Atualizado agora
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-3">
        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Trades Analisados</div>
            <div className="text-lg font-bold font-mono text-foreground">{stats.totalTradesAnalyzed.toLocaleString()}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Padrões</div>
            <div className="text-lg font-bold font-mono text-accent">{stats.patternsLearned}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Lições</div>
            <div className="text-lg font-bold font-mono text-warning">{stats.lessonsStored}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Melhoria</div>
            <div className="text-lg font-bold font-mono text-profit">+{stats.accuracyImprovement}%</div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 mb-3 bg-muted/30">
            <TabsTrigger value="patterns" className="text-xs data-[state=active]:bg-accent/20">
              <Lightbulb className="w-3 h-3 mr-1" />
              Padrões
            </TabsTrigger>
            <TabsTrigger value="lessons" className="text-xs data-[state=active]:bg-accent/20">
              <BookOpen className="w-3 h-3 mr-1" />
              Lições
            </TabsTrigger>
            <TabsTrigger value="evolution" className="text-xs data-[state=active]:bg-accent/20">
              <LineChart className="w-3 h-3 mr-1" />
              Evolução
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs data-[state=active]:bg-accent/20">
              <BarChart3 className="w-3 h-3 mr-1" />
              Insights
            </TabsTrigger>
          </TabsList>

          {/* Patterns Tab */}
          <TabsContent value="patterns" className="mt-0">
            <ScrollArea className="h-[350px] pr-2">
              <div className="space-y-2">
                {patterns.map((pattern) => (
                  <div 
                    key={pattern.id}
                    className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-accent" />
                        <span className="font-medium text-sm">{pattern.name}</span>
                        <Badge variant="outline" className={`text-xs ${categoryColors[pattern.category]}`}>
                          {pattern.category === 'bullish' ? 'Alta' : pattern.category === 'bearish' ? 'Baixa' : 'Neutro'}
                        </Badge>
                      </div>
                      <span className="text-xs font-mono text-profit">{pattern.confidence}%</span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">{pattern.description}</p>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                          <Target className="w-3 h-3 inline mr-1" />
                          {pattern.timesDetected}x detectado
                        </span>
                        <span className="text-profit">
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                          {pattern.successRate}% sucesso
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {Math.floor((Date.now() - pattern.lastSeen.getTime()) / 3600000)}h atrás
                      </span>
                    </div>
                    
                    <Progress value={pattern.confidence} className="h-1" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Lessons Tab */}
          <TabsContent value="lessons" className="mt-0">
            <ScrollArea className="h-[350px] pr-2">
              <div className="space-y-2">
                {lessons.map((lesson) => (
                  <div 
                    key={lesson.id}
                    className={`p-3 rounded-lg border space-y-2 ${
                      lesson.outcome === 'positive' 
                        ? 'bg-profit/5 border-profit/30' 
                        : lesson.outcome === 'negative'
                          ? 'bg-loss/5 border-loss/30'
                          : 'bg-muted/20 border-border/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {lesson.outcome === 'positive' ? (
                          <CheckCircle className="w-4 h-4 text-profit" />
                        ) : lesson.outcome === 'negative' ? (
                          <XCircle className="w-4 h-4 text-loss" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-warning" />
                        )}
                        <Badge variant="outline" className="text-xs">
                          {lesson.symbol}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono ${lesson.impact >= 0 ? 'text-profit' : 'text-loss'}`}>
                          Impacto: {lesson.impact >= 0 ? '+' : ''}{lesson.impact}
                        </span>
                        {lesson.applied && (
                          <Badge variant="outline" className="text-xs bg-accent/10 border-accent/50 text-accent">
                            <Zap className="w-3 h-3 mr-1" />
                            Aplicado
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-foreground">{lesson.lesson}</p>
                    
                    <div className="text-xs text-muted-foreground">
                      <History className="w-3 h-3 inline mr-1" />
                      {lesson.date.toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Evolution Tab */}
          <TabsContent value="evolution" className="mt-0">
            <div className="space-y-3">
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolution}>
                    <defs>
                      <linearGradient id="evolutionGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="epoch" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 10 }}
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
                      formatter={(value: number) => [`${value}%`, 'Performance']}
                      labelFormatter={(label) => `Época ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="performance"
                      stroke="#22c55e"
                      fill="url(#evolutionGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              <ScrollArea className="h-[150px] pr-2">
                <div className="space-y-2">
                  {evolution.slice(-5).reverse().map((evo) => (
                    <div 
                      key={evo.epoch}
                      className="p-2 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Época {evo.epoch}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {evo.changes[0]}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-profit">
                        {evo.performance}%
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="mt-0">
            <div className="grid grid-cols-2 gap-3">
              {/* Pattern Success Chart */}
              <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
                  <Target className="w-3 h-3 text-accent" />
                  Taxa de Sucesso por Padrão
                </h4>
                <div className="h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={patternSuccessData} layout="vertical">
                      <XAxis 
                        type="number" 
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 9 }}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 9 }}
                        width={60}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                        formatter={(value: number) => [`${value}%`, 'Sucesso']}
                      />
                      <Bar dataKey="success" radius={[0, 4, 4, 0]}>
                        {patternSuccessData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.success >= 70 ? '#22c55e' : entry.success >= 60 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Lessons Distribution */}
              <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-accent" />
                  Distribuição de Lições
                </h4>
                <div className="h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={lessonsByOutcome}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {lessonsByOutcome.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-3 mt-1">
                  {lessonsByOutcome.map((item) => (
                    <div key={item.name} className="flex items-center gap-1 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Insights */}
              <div className="col-span-2 p-3 rounded-lg bg-muted/20 border border-border/50">
                <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
                  <Award className="w-3 h-3 text-accent" />
                  Principais Descobertas
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-start gap-2 p-2 rounded bg-profit/10 border border-profit/30">
                    <TrendingUp className="w-4 h-4 text-profit mt-0.5" />
                    <div>
                      <p className="font-medium text-profit">Melhor Hora</p>
                      <p className="text-muted-foreground">14h-16h UTC (abertura NY)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-loss/10 border border-loss/30">
                    <TrendingDown className="w-4 h-4 text-loss mt-0.5" />
                    <div>
                      <p className="font-medium text-loss">Evitar</p>
                      <p className="text-muted-foreground">Domingos e feriados US</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-accent/10 border border-accent/30">
                    <Target className="w-4 h-4 text-accent mt-0.5" />
                    <div>
                      <p className="font-medium text-accent">Melhor Setup</p>
                      <p className="text-muted-foreground">Break & Retest (74% WR)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded bg-warning/10 border border-warning/30">
                    <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                    <div>
                      <p className="font-medium text-warning">Aprendido</p>
                      <p className="text-muted-foreground">Cooldown após 3 perdas</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
