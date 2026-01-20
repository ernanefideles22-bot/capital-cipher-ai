import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  Zap, 
  TrendingUp, 
  Activity, 
  Layers, 
  Target,
  Sparkles,
  RefreshCw,
  Network,
  Power,
  Download,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  LineChart,
  Line,
} from 'recharts';
import { useNeuralNetwork, type NeuralState, type TrainingEpoch } from '@/hooks/useNeuralNetwork';
import { cn } from '@/lib/utils';

interface NeuronProps {
  active: boolean;
  x: number;
  y: number;
  label?: string;
  value?: number;
}

const Neuron = ({ active, x, y, label, value }: NeuronProps) => (
  <g transform={`translate(${x}, ${y})`}>
    <circle
      r={12}
      fill={active ? 'hsl(var(--accent))' : 'hsl(var(--muted))'}
      className={cn(
        'transition-all duration-300',
        active && 'animate-pulse'
      )}
      style={{
        filter: active ? 'drop-shadow(0 0 8px hsl(var(--accent)))' : 'none',
      }}
    />
    {value !== undefined && (
      <text
        y={4}
        textAnchor="middle"
        fontSize={8}
        fill="hsl(var(--foreground))"
        fontWeight="bold"
      >
        {(value * 100).toFixed(0)}
      </text>
    )}
    {label && (
      <text
        y={28}
        textAnchor="middle"
        fontSize={8}
        fill="hsl(var(--muted-foreground))"
      >
        {label}
      </text>
    )}
  </g>
);

const Connection = ({ x1, y1, x2, y2, weight, active }: {
  x1: number; y1: number; x2: number; y2: number; weight: number; active: boolean;
}) => (
  <line
    x1={x1}
    y1={y1}
    x2={x2}
    y2={y2}
    stroke={active ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
    strokeWidth={Math.max(0.5, weight * 3)}
    opacity={active ? 0.8 : 0.3}
    className={cn(active && 'animate-pulse')}
  />
);

const NeuralNetworkVisualization = ({ state, isTraining }: { state: NeuralState | null; isTraining: boolean }) => {
  const [activeNeurons, setActiveNeurons] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isTraining) {
      const interval = setInterval(() => {
        const newActive = new Set<string>();
        // Randomly activate neurons during training
        for (let i = 0; i < 15; i++) {
          newActive.add(`${Math.floor(Math.random() * 3)}-${Math.floor(Math.random() * 5)}`);
        }
        setActiveNeurons(newActive);
      }, 200);
      return () => clearInterval(interval);
    } else {
      setActiveNeurons(new Set());
    }
  }, [isTraining]);

  const factorWeights = state?.factor_weights || {};
  const inputLabels = ['Mom', 'Vol', 'Trend', 'Vlty', 'RSI'];
  const hiddenLayers = [
    [0.7, 0.5, 0.8, 0.6],
    [0.6, 0.7, 0.5, 0.8, 0.4],
    [0.8, 0.6, 0.7],
  ];
  const outputLabels = ['BUY', 'HOLD', 'SELL'];

  return (
    <svg viewBox="0 0 400 200" className="w-full h-full">
      {/* Connections */}
      {inputLabels.map((_, i) => 
        hiddenLayers[0].map((_, j) => (
          <Connection
            key={`in-h0-${i}-${j}`}
            x1={50}
            y1={25 + i * 35}
            x2={130}
            y2={35 + j * 40}
            weight={Object.values(factorWeights)[i] as number || 0.2}
            active={activeNeurons.has(`0-${i}`) || activeNeurons.has(`1-${j}`)}
          />
        ))
      )}
      {hiddenLayers[0].map((_, i) =>
        hiddenLayers[1].map((_, j) => (
          <Connection
            key={`h0-h1-${i}-${j}`}
            x1={130}
            y1={35 + i * 40}
            x2={200}
            y2={20 + j * 35}
            weight={0.5}
            active={activeNeurons.has(`1-${i}`) || activeNeurons.has(`2-${j}`)}
          />
        ))
      )}
      {hiddenLayers[1].map((_, i) =>
        hiddenLayers[2].map((_, j) => (
          <Connection
            key={`h1-h2-${i}-${j}`}
            x1={200}
            y1={20 + i * 35}
            x2={270}
            y2={50 + j * 45}
            weight={0.6}
            active={activeNeurons.has(`2-${i}`) || activeNeurons.has(`3-${j}`)}
          />
        ))
      )}
      {hiddenLayers[2].map((_, i) =>
        outputLabels.map((_, j) => (
          <Connection
            key={`h2-out-${i}-${j}`}
            x1={270}
            y1={50 + i * 45}
            x2={350}
            y2={50 + j * 50}
            weight={0.7}
            active={activeNeurons.has(`3-${i}`)}
          />
        ))
      )}

      {/* Input Layer */}
      {inputLabels.map((label, i) => (
        <Neuron
          key={`input-${i}`}
          x={50}
          y={25 + i * 35}
          label={label}
          value={Object.values(factorWeights)[i] as number || 0.2}
          active={activeNeurons.has(`0-${i}`)}
        />
      ))}

      {/* Hidden Layers */}
      {hiddenLayers[0].map((v, i) => (
        <Neuron key={`h0-${i}`} x={130} y={35 + i * 40} value={v} active={activeNeurons.has(`1-${i}`)} />
      ))}
      {hiddenLayers[1].map((v, i) => (
        <Neuron key={`h1-${i}`} x={200} y={20 + i * 35} value={v} active={activeNeurons.has(`2-${i}`)} />
      ))}
      {hiddenLayers[2].map((v, i) => (
        <Neuron key={`h2-${i}`} x={270} y={50 + i * 45} value={v} active={activeNeurons.has(`3-${i}`)} />
      ))}

      {/* Output Layer */}
      {outputLabels.map((label, i) => (
        <Neuron
          key={`output-${i}`}
          x={350}
          y={50 + i * 50}
          label={label}
          active={activeNeurons.has(`out-${i}`)}
        />
      ))}

      {/* Labels */}
      <text x={50} y={195} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
        Input
      </text>
      <text x={200} y={195} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
        Hidden Layers
      </text>
      <text x={350} y={195} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
        Output
      </text>
    </svg>
  );
};

export const NeuralNetworkPanel = ({ className }: { className?: string }) => {
  const { 
    neuralState, 
    trainingHistory, 
    isTraining, 
    isImporting,
    isLoading,
    autoTrainingEnabled,
    lastTrainingTime,
    pendingExperiences,
    train,
    refreshState,
    importHistoricalTrades,
    toggleAutoTraining,
  } = useNeuralNetwork({ enableAutoTraining: true });

  const strategyData = useMemo(() => {
    if (!neuralState?.strategy_weights) return [];
    return Object.entries(neuralState.strategy_weights).map(([name, weight]) => ({
      name,
      weight: (weight as number) * 100,
      performance: neuralState.symbol_performance 
        ? Object.values(neuralState.symbol_performance as Record<string, any>).reduce(
            (acc, p) => acc + (p.wins || 0), 0
          )
        : 0,
    }));
  }, [neuralState]);

  const factorData = useMemo(() => {
    if (!neuralState?.factor_weights) return [];
    return Object.entries(neuralState.factor_weights).map(([metric, value]) => ({
      metric: metric.charAt(0).toUpperCase() + metric.slice(1),
      value: (value as number) * 100,
      fullMark: 100,
    }));
  }, [neuralState]);

  const historyChartData = useMemo(() => {
    return trainingHistory.map(epoch => ({
      epoch: epoch.epoch_number,
      accuracy: Number(epoch.accuracy_after),
      loss: Number(epoch.loss_after) * 100,
    }));
  }, [trainingHistory]);

  if (isLoading) {
    return (
      <Card className={cn('border-border/50', className)}>
        <CardContent className="p-6 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-border/50 overflow-hidden', className)}>
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-lg",
              autoTrainingEnabled 
                ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20 animate-pulse" 
                : "bg-gradient-to-br from-purple-500/20 to-blue-500/20"
            )}>
              <Brain className={cn(
                "w-5 h-5",
                autoTrainingEnabled ? "text-green-400" : "text-purple-400"
              )} />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Rede Neural AI
                {autoTrainingEnabled && (
                  <Badge variant="outline" className="border-green-500/50 text-green-400 text-[10px] animate-pulse">
                    AUTO
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {neuralState?.total_epochs || 0} épocas • {pendingExperiences} pendentes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge 
              variant="outline" 
              className={cn(
                'text-xs cursor-pointer transition-colors',
                autoTrainingEnabled 
                  ? 'border-green-500/50 text-green-400 hover:bg-green-500/10' 
                  : 'border-muted text-muted-foreground hover:bg-muted/20'
              )}
              onClick={toggleAutoTraining}
            >
              {autoTrainingEnabled ? (
                <>
                  <Zap className="w-3 h-3 mr-1" />
                  ON
                </>
              ) : (
                <>
                  <Power className="w-3 h-3 mr-1" />
                  OFF
                </>
              )}
            </Badge>
          </div>
        </div>
        
        {/* Training Controls */}
        <div className="flex items-center gap-1 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => importHistoricalTrades()}
            disabled={isImporting || isTraining}
            className="text-xs flex-1"
          >
            {isImporting ? (
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Download className="w-3 h-3 mr-1" />
            )}
            Importar Histórico
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => train()}
            disabled={isTraining || isImporting}
            className="text-xs flex-1"
          >
            {isTraining ? (
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 mr-1" />
            )}
            Treinar Agora
          </Button>
        </div>
        
        {lastTrainingTime && (
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            Último treino: {lastTrainingTime.toLocaleTimeString()}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-3">
        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Precisão</div>
            <div className="text-lg font-bold font-mono text-purple-400">
              {(neuralState?.accuracy || 50).toFixed(1)}%
            </div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
            <div className="text-lg font-bold font-mono text-profit">
              {(neuralState?.win_rate || 50).toFixed(1)}%
            </div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Loss</div>
            <div className="text-lg font-bold font-mono text-blue-400">
              {(neuralState?.loss_value || 1).toFixed(3)}
            </div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
            <div className="text-xs text-muted-foreground mb-1">Épocas</div>
            <div className="text-lg font-bold font-mono text-foreground">
              {neuralState?.total_epochs || 0}
            </div>
          </div>
        </div>

        <Tabs defaultValue="network" className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-8 mb-2">
            <TabsTrigger value="network" className="text-xs">
              <Network className="w-3 h-3 mr-1" />
              Rede
            </TabsTrigger>
            <TabsTrigger value="evolution" className="text-xs">
              <TrendingUp className="w-3 h-3 mr-1" />
              Evolução
            </TabsTrigger>
            <TabsTrigger value="strategies" className="text-xs">
              <Layers className="w-3 h-3 mr-1" />
              Pesos
            </TabsTrigger>
            <TabsTrigger value="factors" className="text-xs">
              <Target className="w-3 h-3 mr-1" />
              Fatores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="network" className="mt-0">
            <div className="h-[200px] bg-muted/10 rounded-lg border border-border/30 p-2">
              <NeuralNetworkVisualization state={neuralState} isTraining={isTraining} />
            </div>
            <div className="mt-2 text-center text-xs text-muted-foreground">
              5 inputs → 4-5-3 hidden → 3 outputs (BUY/HOLD/SELL)
            </div>
          </TabsContent>

          <TabsContent value="evolution" className="mt-0">
            <div className="h-[200px]">
              {historyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyChartData}>
                    <defs>
                      <linearGradient id="accuracyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
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
                    />
                    <Area
                      type="monotone"
                      dataKey="accuracy"
                      stroke="hsl(var(--accent))"
                      fill="url(#accuracyGrad)"
                      strokeWidth={2}
                      name="Precisão"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  <Brain className="w-6 h-6 mr-2 opacity-50" />
                  Treine para ver evolução
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="strategies" className="mt-0">
            <div className="space-y-2">
              {strategyData.map((strategy) => (
                <div
                  key={strategy.name}
                  className="p-2 rounded-lg bg-muted/20 border border-border/30"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{strategy.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {strategy.weight.toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress value={strategy.weight} className="h-2" />
                </div>
              ))}
              {strategyData.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-6">
                  <Layers className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  Pesos serão atualizados com treinamento
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="factors" className="mt-0">
            <div className="h-[200px]">
              {factorData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={factorData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis 
                      dataKey="metric" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    />
                    <Radar
                      name="Peso"
                      dataKey="value"
                      stroke="hsl(var(--accent))"
                      fill="hsl(var(--accent))"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  <Target className="w-6 h-6 mr-2 opacity-50" />
                  Fatores serão calibrados com trades
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
