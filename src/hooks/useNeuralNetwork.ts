import { useState, useCallback, useEffect } from 'react';
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

export const useNeuralNetwork = () => {
  const [neuralState, setNeuralState] = useState<NeuralState | null>(null);
  const [trainingHistory, setTrainingHistory] = useState<TrainingEpoch[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      console.error('Error saving experience:', err);
    }
  }, []);

  // Train neural network
  const train = useCallback(async (learningRate: number = 0.01) => {
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
        toast.success(`🧠 Época ${data.epochCompleted} concluída! Precisão: ${data.accuracy.toFixed(1)}%`);
        
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro no treinamento';
      setError(message);
      toast.error(message);
    } finally {
      setIsTraining(false);
    }
  }, [loadState, loadHistory]);

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

    // Auto-train after every 5 new experiences
    const { data } = await supabase
      .from('trade_experiences')
      .select('id')
      .eq('learned', false);
    
    if (data && data.length >= 5) {
      console.log('Auto-training after 5 new experiences...');
      await train();
    }
  }, [saveExperience, train]);

  // Initial load
  useEffect(() => {
    loadState();
    loadHistory();
  }, [loadState, loadHistory]);

  return {
    neuralState,
    trainingHistory,
    isTraining,
    isLoading,
    error,
    train,
    saveExperience,
    recordTradeOutcome,
    analyzeWithMemory,
    refreshState: loadState,
  };
};
