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
    utterance.lang = 'en-US';

    // Try to get a natural sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (voice) =>
        voice.name.includes('Google') ||
        voice.name.includes('Samantha') ||
        voice.name.includes('Daniel') ||
        voice.name.includes('Microsoft')
    ) || voices.find((voice) => voice.lang.startsWith('en'));

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
    const sideText = side === 'LONG' ? 'long' : 'short';
    const confidencePercent = Math.round(confidence * 100);
    speak(`Opening ${sideText} position on ${formatSymbol(symbol)} with ${confidencePercent}% confidence`);
  }, [speak]);

  const announceTradeClosed = useCallback((symbol: string, pnl: number, reason: string) => {
    const pnlText = pnl >= 0 ? `profit of ${Math.abs(pnl).toFixed(2)} dollars` : `loss of ${Math.abs(pnl).toFixed(2)} dollars`;
    const reasonText = reason === 'TP' ? 'take profit hit' : reason === 'SL' ? 'stop loss triggered' : 'manual exit';
    speak(`Closed ${formatSymbol(symbol)} with ${pnlText}. ${reasonText}`);
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

// Helper to format symbol names for speech
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
  };
  return symbolMap[symbol] || symbol.replace('USDT', '');
};
