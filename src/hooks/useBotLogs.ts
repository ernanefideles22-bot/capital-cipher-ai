import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { LogEntry } from '@/types/trading';

export function useBotLogs() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const writeLog = useCallback(async (level: LogEntry['level'], message: string, details?: any) => {
    if (!userId) return;

    try {
      const { error } = await supabase.from('bot_logs').insert({
        user_id: userId,
        level,
        message,
        details: details ? JSON.parse(JSON.stringify(details)) : null,
        timestamp: new Date().toISOString()
      });

      if (error) {
        console.error('Failed to insert log to Supabase:', error);
      }
    } catch (e) {
      console.error('Error writing log to database:', e);
    }
  }, [userId]);

  return { writeLog };
}
