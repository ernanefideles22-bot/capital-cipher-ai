import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface NeuralState {
  id: string;
  accuracy: number;
  win_rate: number;
  loss_value: number;
  total_epochs: number;
  strategy_weights: Record<string, number>;
  factor_weights: Record<string, number>;
  symbol_performance: Record<string, { wins: number; losses: number; pnl: number }>;
  last_trained_at: string;
}

export interface TrainingEpoch {
  epoch_number: number;
  accuracy_before: number;
  accuracy_after: number;
  loss_before: number;
  loss_after: number;
  trades_processed: number;
  accuracy_improvement: number;
  trained_at: string;
}

export interface TradeExperience {
  trade_id?: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price?: number;
  pnl?: number;
  pnl_percentage?: number;
  outcome?: 'WIN' | 'LOSS' | 'BREAKEVEN';
  ai_confidence?: number;
  strategy_used?: string;
  rsi_entry?: number;
  volume_ratio?: number;
  ema_trend?: string;
}

interface UseNeuralNetworkOptions {
  autoTrainInterval?: number; // ms between auto-training cycles (default: 120000 = 2 min)
  enableAutoTraining?: boolean;
}

export const useNeuralNetwork = (options: UseNeuralNetworkOptions = {}) => {
  const { autoTrainInterval = 120000, enableAutoTraining = true } = options;
  
  const [neuralState, setNeuralState] = useState<NeuralState | null>(null);
  const [trainingHistory, setTrainingHistory] = useState<TrainingEpoch[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoTrainingEnabled, setAutoTrainingEnabled] = useState(enableAutoTraining);
  const [lastTrainingTime, setLastTrainingTime] = useState<Date | null>(null);
  const [pendingExperiences, setPendingExperiences] = useState(0);
  
  const autoTrainIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoTrainingRef = useRef(false);

  // Load neural state
  const loadState = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('neural-training', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'getState' },
      });

      if (fnError) throw fnError;
      
      if (data?.state) {
        setNeuralState({
          ...data.state,
          accuracy: Number(data.state.accuracy),
          win_rate: Number(data.state.win_rate),
          loss_value: Number(data.state.loss_value),
        });
      }
      
      // Check pending experiences count
      const { count } = await supabase
        .from('trade_experiences')
        .select('id', { count: 'exact', head: true })
        .eq('learned', false);
      
      setPendingExperiences(count || 0);
    } catch (err) {
      console.error('Error loading neural state:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar estado neural');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load training history
  const loadHistory = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error: fnError } = await supabase.functions.invoke('neural-training', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'getHistory' },
      });

      if (fnError) throw fnError;
      setTrainingHistory(data?.history || []);
    } catch (err) {
      console.error('Error loading training history:', err);
    }
  }, []);

  // Import all historical trades that haven't been processed yet
  const importHistoricalTrades = useCallback(async () => {
    setIsImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      // Get all closed trades that don't have a corresponding experience
      const { data: existingExps } = await supabase
        .from('trade_experiences')
        .select('trade_id')
        .eq('user_id', session.user.id);
      
      const processedTradeIds = new Set((existingExps || []).map(e => e.trade_id).filter(Boolean));

      // Get closed trades not yet processed
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'CLOSED')
        .not('exit_price', 'is', null);

      if (tradesError) throw tradesError;

      const newTrades = (trades || []).filter(t => !processedTradeIds.has(t.id));
      
      if (newTrades.length === 0) {
        toast.info('Todos os trades históricos já foram importados');
        return 0;
      }

      // Convert trades to experiences
      const experiences = newTrades.map(trade => {
        const pnl = trade.pnl || 0;
        const outcome = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN';
        
        return {
          user_id: session.user.id,
          trade_id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          entry_price: trade.entry_price,
          exit_price: trade.exit_price,
          pnl: trade.pnl,
          pnl_percentage: trade.pnl_percentage,
          outcome,
          ai_confidence: trade.ai_confidence,
          strategy_used: trade.strategy || 'DAYTRADE',
          learned: false,
        };
      });

      // Insert all experiences
      const { error: insertError } = await supabase
        .from('trade_experiences')
        .insert(experiences);

      if (insertError) throw insertError;

      toast.success(`🧠 ${experiences.length} trades históricos importados para aprendizado!`);
      setPendingExperiences(prev => prev + experiences.length);
      
      return experiences.length;
    } catch (err) {
      console.error('Error importing historical trades:', err);
      toast.error('Erro ao importar trades históricos');
      return 0;
    } finally {
      setIsImporting(false);
    }
  }, []);

  // Save trade experience for learning
  const saveExperience = useCallback(async (experience: TradeExperience) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('trade_experiences')
        .insert({
          user_id: session.user.id,
          trade_id: experience.trade_id,
          symbol: experience.symbol,
          side: experience.side,
          entry_price: experience.entry_price,
          exit_price: experience.exit_price,
          pnl: experience.pnl,
          pnl_percentage: experience.pnl_percentage,
          outcome: experience.outcome,
          ai_confidence: experience.ai_confidence,
          strategy_used: experience.strategy_used,
          rsi_entry: experience.rsi_entry,
          volume_ratio: experience.volume_ratio,
          ema_trend: experience.ema_trend,
          learned: false,
        });

      if (error) throw error;
      console.log('Experience saved for learning:', experience.symbol);
      setPendingExperiences(prev => prev + 1);
    } catch (err) {
      console.error('Error saving experience:', err);
    }
  }, []);

  // Train neural network
  const train = useCallback(async (learningRate: number = 0.01) => {
    if (isTraining) return null;
    
    setIsTraining(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error: fnError } = await supabase.functions.invoke('neural-training', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'train', learningRate },
      });

      if (fnError) throw fnError;

      if (data?.success) {
        if (data.tradesProcessed > 0) {
          toast.success(`🧠 Época ${data.epochCompleted} concluída! Precisão: ${data.accuracy.toFixed(1)}% (+${data.improvement?.accuracy?.toFixed(1) || 0}%)`);
        }
        
        setLastTrainingTime(new Date());
        setPendingExperiences(0);
        
        // Refresh state
        await loadState();
        await loadHistory();

        return {
          epoch: data.epochCompleted,
          tradesProcessed: data.tradesProcessed,
          accuracy: data.accuracy,
          winRate: data.winRate,
          improvement: data.improvement,
        };
      }
      
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro no treinamento';
      setError(message);
      console.error('Training error:', err);
      return null;
    } finally {
      setIsTraining(false);
    }
  }, [isTraining, loadState, loadHistory]);

  // Auto-training cycle
  const runAutoTrainingCycle = useCallback(async () => {
    if (!isAutoTrainingRef.current || isTraining) return;
    
    console.log('🧠 Auto-training cycle starting...');
    
    // First, import any new closed trades
    const imported = await importHistoricalTrades();
    
    // Then train if there are pending experiences
    const { count } = await supabase
      .from('trade_experiences')
      .select('id', { count: 'exact', head: true })
      .eq('learned', false);
    
    if ((count || 0) > 0) {
      console.log(`🧠 Training on ${count} pending experiences...`);
      await train(0.01);
    } else {
      console.log('🧠 No new experiences to learn from');
    }
  }, [importHistoricalTrades, train, isTraining]);

  // Start auto-training
  const startAutoTraining = useCallback(() => {
    if (autoTrainIntervalRef.current) return;
    
    isAutoTrainingRef.current = true;
    setAutoTrainingEnabled(true);
    
    console.log('🧠 Auto-training ENABLED - running every', autoTrainInterval / 1000, 'seconds');
    toast.success('🧠 Treinamento neural automático ATIVADO');
    
    // Run immediately
    runAutoTrainingCycle();
    
    // Set up interval
    autoTrainIntervalRef.current = setInterval(runAutoTrainingCycle, autoTrainInterval);
  }, [autoTrainInterval, runAutoTrainingCycle]);

  // Stop auto-training
  const stopAutoTraining = useCallback(() => {
    isAutoTrainingRef.current = false;
    setAutoTrainingEnabled(false);
    
    if (autoTrainIntervalRef.current) {
      clearInterval(autoTrainIntervalRef.current);
      autoTrainIntervalRef.current = null;
    }
    
    console.log('🧠 Auto-training DISABLED');
    toast.info('🧠 Treinamento neural automático desativado');
  }, []);

  // Toggle auto-training
  const toggleAutoTraining = useCallback(() => {
    if (autoTrainingEnabled) {
      stopAutoTraining();
    } else {
      startAutoTraining();
    }
  }, [autoTrainingEnabled, startAutoTraining, stopAutoTraining]);

  // Analyze with neural memory
  const analyzeWithMemory = useCallback(async (symbol: string, marketData: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error: fnError } = await supabase.functions.invoke('neural-training', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'analyzeWithMemory', symbol, marketData },
      });

      if (fnError) throw fnError;
      return data?.analysis;
    } catch (err) {
      console.error('Error in neural analysis:', err);
      return null;
    }
  }, []);

  // Auto-save experience when trade closes
  const recordTradeOutcome = useCallback(async (trade: {
    id: string;
    symbol: string;
    side: string;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercentage?: number;
    aiConfidence?: number;
    strategy?: string;
  }) => {
    const outcome = trade.pnl > 0 ? 'WIN' : trade.pnl < 0 ? 'LOSS' : 'BREAKEVEN';
    
    await saveExperience({
      trade_id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      entry_price: trade.entryPrice,
      exit_price: trade.exitPrice,
      pnl: trade.pnl,
      pnl_percentage: trade.pnlPercentage,
      outcome,
      ai_confidence: trade.aiConfidence,
      strategy_used: trade.strategy,
    });
  }, [saveExperience]);

  // Initial load and auto-start training
  useEffect(() => {
    loadState();
    loadHistory();
    
    // Auto-start training if enabled
    if (enableAutoTraining) {
      // Delay start to allow initial load
      const timeout = setTimeout(() => {
        startAutoTraining();
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [loadState, loadHistory, enableAutoTraining, startAutoTraining]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoTrainIntervalRef.current) {
        clearInterval(autoTrainIntervalRef.current);
      }
    };
  }, []);

  return {
    neuralState,
    trainingHistory,
    isTraining,
    isImporting,
    isLoading,
    error,
    autoTrainingEnabled,
    lastTrainingTime,
    pendingExperiences,
    train,
    saveExperience,
    recordTradeOutcome,
    analyzeWithMemory,
    refreshState: loadState,
    importHistoricalTrades,
    startAutoTraining,
    stopAutoTraining,
    toggleAutoTraining,
  };
};
