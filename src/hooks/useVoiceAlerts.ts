import { useCallback, useRef } from 'react';

interface VoiceAlertOptions {
  enabled: boolean;
  volume: number;
  rate: number;
  pitch: number;
}

const defaultOptions: VoiceAlertOptions = {
  enabled: true,
  volume: 1,
  rate: 1,
  pitch: 1,
};

export const useVoiceAlerts = (options: Partial<VoiceAlertOptions> = {}) => {
  const settings = { ...defaultOptions, ...options };
  const isSpeaking = useRef(false);

  const speak = useCallback((text: string) => {
    if (!settings.enabled || !('speechSynthesis' in window)) {
      console.warn('Speech synthesis not available');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = settings.volume;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.lang = 'pt-BR';

    // Try to get a Brazilian Portuguese voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (voice) =>
        voice.lang === 'pt-BR' ||
        voice.lang.startsWith('pt')
    ) || voices.find(
      (voice) =>
        voice.name.includes('Google') ||
        voice.name.includes('Microsoft')
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      isSpeaking.current = true;
    };

    utterance.onend = () => {
      isSpeaking.current = false;
    };

    window.speechSynthesis.speak(utterance);
  }, [settings.enabled, settings.volume, settings.rate, settings.pitch]);

  const announceTradeOpened = useCallback((symbol: string, side: 'LONG' | 'SHORT', confidence: number) => {
    const sideText = side === 'LONG' ? 'compra' : 'venda';
    const confidencePercent = Math.round(confidence * 100);
    speak(`Abrindo posição de ${sideText} em ${formatSymbol(symbol)} com ${confidencePercent} porcento de confiança`);
  }, [speak]);

  const announceTradeClosed = useCallback((symbol: string, pnl: number, reason: string) => {
    const pnlText = pnl >= 0 
      ? `lucro de ${Math.abs(pnl).toFixed(2)} dólares` 
      : `prejuízo de ${Math.abs(pnl).toFixed(2)} dólares`;
    const reasonText = reason === 'TP' ? 'take profit atingido' : reason === 'SL' ? 'stop loss acionado' : 'saída manual';
    speak(`Trade de ${formatSymbol(symbol)} fechado com ${pnlText}. ${reasonText}`);
  }, [speak]);

  const announceAlert = useCallback((message: string) => {
    speak(message);
  }, [speak]);

  return {
    speak,
    announceTradeOpened,
    announceTradeClosed,
    announceAlert,
    isSpeaking: isSpeaking.current,
  };
};

// Helper to format symbol names for speech in Portuguese
const formatSymbol = (symbol: string): string => {
  const symbolMap: Record<string, string> = {
    'BTCUSDT': 'Bitcoin',
    'ETHUSDT': 'Ethereum',
    'BNBUSDT': 'BNB',
    'SOLUSDT': 'Solana',
    'XRPUSDT': 'XRP',
    'ADAUSDT': 'Cardano',
    'DOGEUSDT': 'Dogecoin',
    'DOTUSDT': 'Polkadot',
    'MATICUSDT': 'Polygon',
    'LINKUSDT': 'Chainlink',
    'AVAXUSDT': 'Avalanche',
  };
  return symbolMap[symbol] || symbol.replace('USDT', '');
};
