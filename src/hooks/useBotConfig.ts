import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { BotConfig } from '@/types/trading';
import { toast } from 'sonner';

const DEFAULT_CONFIG: BotConfig = {
  mode: 'paper',
  marketMode: 'FUTURES',
  leverage: 5,
  maxDrawdown: 10,
  maxConcurrentTrades: 3,
  riskPerTrade: 2,
  assets: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
};

interface UseBotConfigReturn {
  config: BotConfig;
  loading: boolean;
  saving: boolean;
  updateConfig: (newConfig: Partial<BotConfig>) => Promise<void>;
  refreshConfig: () => Promise<void>;
}

export function useBotConfig(): UseBotConfigReturn {
  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load config from database
  const refreshConfig = useCallback(async () => {
    if (!userId) {
      // Load from localStorage as fallback
      try {
        const saved = localStorage.getItem('bot_config');
        if (saved) {
          const parsed = JSON.parse(saved);
          setConfig({ ...DEFAULT_CONFIG, ...parsed });
        }
      } catch {
        // ignore
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('bot_config')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading bot config:', error);
        // Fallback to localStorage
        const saved = localStorage.getItem('bot_config');
        if (saved) {
          setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
        }
      } else if (data?.bot_config) {
        const dbConfig = data.bot_config as Record<string, unknown>;
        setConfig({
          mode: 'paper',
          marketMode: dbConfig.marketMode === 'SPOT' || dbConfig.marketMode === 'FUTURES' ? dbConfig.marketMode : DEFAULT_CONFIG.marketMode,
          leverage: typeof dbConfig.leverage === 'number' ? dbConfig.leverage : DEFAULT_CONFIG.leverage,
          maxDrawdown: typeof dbConfig.maxDrawdown === 'number' ? dbConfig.maxDrawdown : DEFAULT_CONFIG.maxDrawdown,
          maxConcurrentTrades: typeof dbConfig.maxConcurrentTrades === 'number' ? dbConfig.maxConcurrentTrades : DEFAULT_CONFIG.maxConcurrentTrades,
          riskPerTrade: typeof dbConfig.riskPerTrade === 'number' ? dbConfig.riskPerTrade : DEFAULT_CONFIG.riskPerTrade,
          assets: Array.isArray(dbConfig.assets) ? dbConfig.assets as string[] : DEFAULT_CONFIG.assets,
        });
      }
    } catch (err) {
      console.error('Error loading config:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load config when userId changes
  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  // Save config to database
  const updateConfig = useCallback(async (newConfig: Partial<BotConfig>) => {
    const updatedConfig: BotConfig = { ...config, ...newConfig, mode: 'paper' };
    
    // Update local state immediately
    setConfig(updatedConfig);
    
    // Save to localStorage as backup
    try {
      localStorage.setItem('bot_config', JSON.stringify(updatedConfig));
    } catch {
      // ignore
    }

    if (!userId) {
      toast.success('Configurações salvas localmente');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          bot_config: updatedConfig,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error saving bot config:', error);
        toast.error('Erro ao salvar configurações na nuvem');
      } else {
        toast.success('Configurações salvas na nuvem ☁️');
      }
    } catch (err) {
      console.error('Error saving config:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  }, [config, userId]);

  return {
    config,
    loading,
    saving,
    updateConfig,
    refreshConfig,
  };
}
