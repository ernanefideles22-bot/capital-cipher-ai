import { useState, useEffect, useCallback } from 'react';

export interface NewsSentiment {
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
  bullishCount: number;
  bearishCount: number;
  totalNews: number;
}

// Global sentiment state that can be accessed by other hooks
let globalSentiment: NewsSentiment = {
  overallSentiment: 'neutral',
  confidence: 50,
  summary: 'Aguardando análise de notícias...',
  bullishCount: 0,
  bearishCount: 0,
  totalNews: 0,
};

const listeners: Set<(sentiment: NewsSentiment) => void> = new Set();

export const updateGlobalSentiment = (sentiment: NewsSentiment) => {
  globalSentiment = sentiment;
  listeners.forEach(listener => listener(sentiment));
};

export const getGlobalSentiment = (): NewsSentiment => globalSentiment;

export const useNewsSentiment = () => {
  const [sentiment, setSentiment] = useState<NewsSentiment>(globalSentiment);

  useEffect(() => {
    const handleUpdate = (newSentiment: NewsSentiment) => {
      setSentiment(newSentiment);
    };

    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const updateSentiment = useCallback((newSentiment: NewsSentiment) => {
    updateGlobalSentiment(newSentiment);
  }, []);

  return {
    sentiment,
    updateSentiment,
  };
};
