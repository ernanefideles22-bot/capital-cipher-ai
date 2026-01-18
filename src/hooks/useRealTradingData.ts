import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Trade, BotStats, LogEntry, AIDecision, MarketData } from '@/types/trading';

interface WalletInfo {
  totalEquity: number;
  totalWalletBalance: number;
  totalAvailableBalance: number;
  totalPnL: number;
}

interface RealTradingDataState {
  trades: Trade[];
  stats: BotStats;
  logs: LogEntry[];
  aiDecisions: AIDecision[];
  marketData: Record<string, MarketData>;
  wallet: WalletInfo | null;
  positions: any[];
  loading: boolean;
}

const emptyStats: BotStats = {
  status: 'PAUSED',
  totalTrades: 0,
  winRate: 0,
  totalPnL: 0,
  dailyPnL: 0,
  weeklyPnL: 0,
  monthlyPnL: 0,
  currentDrawdown: 0,
  maxDrawdown: 10,
  sharpeRatio: 0,
  profitFactor: 0,
};

export function useRealTradingData(userId: string | undefined) {
  const [state, setState] = useState<RealTradingDataState>({
    trades: [],
    stats: { ...emptyStats },
    logs: [],
    aiDecisions: [],
    marketData: {},
    wallet: null,
    positions: [],
    loading: true,
  });

  // Add a log entry
  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      message,
    };
    setState(prev => ({
      ...prev,
      logs: [entry, ...prev.logs.slice(0, 99)],
    }));
  }, []);

  // Clear logs
  const clearLogs = useCallback(() => {
    setState(prev => ({
      ...prev,
      logs: [],
    }));
  }, []);

  // Add an AI decision
  const addAIDecision = useCallback((decision: Omit<AIDecision, 'id' | 'timestamp'>) => {
    const entry: AIDecision = {
      ...decision,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setState(prev => ({
      ...prev,
      aiDecisions: [entry, ...prev.aiDecisions.slice(0, 9)],
    }));
  }, []);

  // Load trades from database
  const loadTrades = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('opened_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const trades: Trade[] = (data || []).map((t) => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side as 'LONG' | 'SHORT',
        strategy: (t.strategy || 'SCALP') as 'SCALP' | 'DAYTRADE' | 'SWING',
        entryPrice: Number(t.entry_price),
        exitPrice: t.exit_price ? Number(t.exit_price) : undefined,
        quantity: Number(t.quantity),
        leverage: t.leverage || 1,
        stopLoss: t.stop_loss ? Number(t.stop_loss) : undefined,
        takeProfit: t.take_profit ? Number(t.take_profit) : undefined,
        pnl: t.pnl ? Number(t.pnl) : undefined,
        pnlPercentage: t.pnl_percentage ? Number(t.pnl_percentage) : undefined,
        status: t.status as 'OPEN' | 'CLOSED' | 'CANCELLED',
        openedAt: new Date(t.opened_at),
        closedAt: t.closed_at ? new Date(t.closed_at) : undefined,
      }));

      // Calculate stats from real trades
      const closedTrades = trades.filter(t => t.status === 'CLOSED');
      const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
      const totalPnL = closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);

      // Calculate daily/weekly/monthly P&L
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const dailyPnL = closedTrades
        .filter(t => t.closedAt && t.closedAt >= todayStart)
        .reduce((acc, t) => acc + (t.pnl || 0), 0);
      
      const weeklyPnL = closedTrades
        .filter(t => t.closedAt && t.closedAt >= weekStart)
        .reduce((acc, t) => acc + (t.pnl || 0), 0);
      
      const monthlyPnL = closedTrades
        .filter(t => t.closedAt && t.closedAt >= monthStart)
        .reduce((acc, t) => acc + (t.pnl || 0), 0);

      const stats: BotStats = {
        status: 'PAUSED',
        totalTrades: closedTrades.length,
        winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
        totalPnL,
        dailyPnL,
        weeklyPnL,
        monthlyPnL,
        currentDrawdown: 0,
        maxDrawdown: 10,
        sharpeRatio: 0,
        profitFactor: closedTrades.length > 0 
          ? Math.abs(winningTrades.reduce((acc, t) => acc + (t.pnl || 0), 0)) / 
            Math.max(1, Math.abs(closedTrades.filter(t => (t.pnl || 0) < 0).reduce((acc, t) => acc + (t.pnl || 0), 0)))
          : 0,
      };

      setState(prev => ({
        ...prev,
        trades,
        stats,
        loading: false,
      }));

      if (trades.length > 0) {
        addLog('INFO', `${trades.length} trades reais carregados do histórico`);
      }
    } catch (error) {
      console.error('Error loading real trades:', error);
      addLog('ERROR', 'Erro ao carregar trades reais');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [userId, addLog]);

  // Add a new trade
  const addTrade = useCallback(async (trade: Trade, aiConfidence?: number, aiReasoning?: string) => {
    if (!userId) return { error: new Error('User not authenticated') };

    try {
      const { data, error } = await supabase
        .from('trades')
        .insert({
          user_id: userId,
          symbol: trade.symbol,
          side: trade.side,
          strategy: trade.strategy,
          entry_price: trade.entryPrice,
          exit_price: trade.exitPrice,
          quantity: trade.quantity,
          leverage: trade.leverage,
          stop_loss: trade.stopLoss,
          take_profit: trade.takeProfit,
          pnl: trade.pnl,
          pnl_percentage: trade.pnlPercentage,
          status: trade.status,
          ai_confidence: aiConfidence,
          ai_reasoning: aiReasoning,
          opened_at: trade.openedAt?.toISOString(),
          closed_at: trade.closedAt?.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      setState(prev => ({
        ...prev,
        trades: [trade, ...prev.trades],
        stats: {
          ...prev.stats,
          totalTrades: prev.stats.totalTrades + (trade.status === 'CLOSED' ? 1 : 0),
        },
      }));

      addLog('SUCCESS', `Trade real salvo: ${trade.side} ${trade.symbol} @ $${trade.entryPrice.toFixed(2)}`);
      return { data, error: null };
    } catch (error: any) {
      addLog('ERROR', `Erro ao salvar trade: ${error.message}`);
      return { data: null, error };
    }
  }, [userId, addLog]);

  // Update wallet data
  const updateWallet = useCallback((wallet: WalletInfo) => {
    setState(prev => ({ ...prev, wallet }));
  }, []);

  // Update positions
  const updatePositions = useCallback((positions: any[]) => {
    setState(prev => ({ ...prev, positions }));
  }, []);

  // Update market data (from Bybit API)
  const updateMarketData = useCallback((data: MarketData) => {
    setState(prev => ({
      ...prev,
      marketData: {
        ...prev.marketData,
        [data.symbol]: data,
      },
    }));
  }, []);

  // Set bot status
  const setBotStatus = useCallback((status: BotStats['status']) => {
    setState(prev => ({
      ...prev,
      stats: { ...prev.stats, status },
    }));
  }, []);

  // Clear all data
  const clearData = useCallback(() => {
    setState({
      trades: [],
      stats: { ...emptyStats },
      logs: [{ id: crypto.randomUUID(), timestamp: new Date(), level: 'INFO', message: '🔄 Modo REAL ativado - Aguardando dados da Bybit' }],
      aiDecisions: [],
      marketData: {},
      wallet: null,
      positions: [],
      loading: false,
    });
  }, []);

  // Load data on mount
  useEffect(() => {
    if (userId) {
      loadTrades();
    }
  }, [userId, loadTrades]);

  return {
    ...state,
    addLog,
    addAIDecision,
    addTrade,
    updateWallet,
    updatePositions,
    updateMarketData,
    setBotStatus,
    loadTrades,
    clearData,
    clearLogs,
  };
}
