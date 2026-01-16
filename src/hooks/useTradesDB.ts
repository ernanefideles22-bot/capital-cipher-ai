import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Trade } from '@/types/trading';

export const useTradesDB = (userId: string | undefined) => {
  const saveTrade = useCallback(async (trade: Trade, aiConfidence?: number, aiReasoning?: string) => {
    if (!userId) return { error: new Error('User not authenticated') };

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

    return { data, error };
  }, [userId]);

  const updateTrade = useCallback(async (tradeId: string, updates: Partial<Trade>) => {
    if (!userId) return { error: new Error('User not authenticated') };

    const { data, error } = await supabase
      .from('trades')
      .update({
        exit_price: updates.exitPrice,
        pnl: updates.pnl,
        pnl_percentage: updates.pnlPercentage,
        status: updates.status,
        closed_at: updates.closedAt?.toISOString(),
      })
      .eq('id', tradeId)
      .eq('user_id', userId)
      .select()
      .single();

    return { data, error };
  }, [userId]);

  const loadTrades = useCallback(async (limit = 50) => {
    if (!userId) return { data: [], error: new Error('User not authenticated') };

    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('opened_at', { ascending: false })
      .limit(limit);

    if (error) return { data: [], error };

    const trades: Trade[] = (data || []).map((t) => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side as 'LONG' | 'SHORT',
      strategy: t.strategy as 'SCALP' | 'DAYTRADE' | 'SWING',
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

    return { data: trades, error: null };
  }, [userId]);

  const updateBotStats = useCallback(async (stats: {
    totalTrades?: number;
    winCount?: number;
    totalPnl?: number;
    dailyPnl?: number;
    weeklyPnl?: number;
    monthlyPnl?: number;
    maxDrawdown?: number;
  }) => {
    if (!userId) return { error: new Error('User not authenticated') };

    const { error } = await supabase
      .from('bot_stats')
      .update({
        total_trades: stats.totalTrades,
        win_count: stats.winCount,
        total_pnl: stats.totalPnl,
        daily_pnl: stats.dailyPnl,
        weekly_pnl: stats.weeklyPnl,
        monthly_pnl: stats.monthlyPnl,
        max_drawdown: stats.maxDrawdown,
      })
      .eq('user_id', userId);

    return { error };
  }, [userId]);

  const loadBotStats = useCallback(async () => {
    if (!userId) return { data: null, error: new Error('User not authenticated') };

    const { data, error } = await supabase
      .from('bot_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    return { data, error };
  }, [userId]);

  return {
    saveTrade,
    updateTrade,
    loadTrades,
    updateBotStats,
    loadBotStats,
  };
};
