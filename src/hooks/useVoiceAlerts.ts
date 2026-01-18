import { useCallback, useRef } from 'react';

interface VoiceAlertOptions {
  enabled: boolean;
  volume: number;
  rate: number;
  pitch: number;
  useElevenLabs: boolean;
}

const defaultOptions: VoiceAlertOptions = {
  enabled: true,
  volume: 1,
  rate: 1,
  pitch: 1,
  useElevenLabs: true, // Use ElevenLabs by default
};

// Audio context for playing beep sounds
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Play a beep sound
const playBeep = (frequency: number = 800, duration: number = 150, volume: number = 0.3) => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  } catch (error) {
    console.warn('Failed to play beep:', error);
  }
};

export const playVoiceToggleSound = (enabled: boolean) => {
  if (enabled) {
    // Ascending tone for enabling
    playBeep(600, 100, 0.2);
    setTimeout(() => playBeep(800, 100, 0.2), 100);
    setTimeout(() => playBeep(1000, 150, 0.25), 200);
  } else {
    // Descending tone for disabling
    playBeep(800, 100, 0.2);
    setTimeout(() => playBeep(600, 100, 0.2), 100);
    setTimeout(() => playBeep(400, 150, 0.15), 200);
  }
};

// ElevenLabs TTS function
const speakWithElevenLabs = async (text: string, volume: number = 1): Promise<boolean> => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!response.ok) {
      console.error('ElevenLabs TTS failed:', response.status);
      return false;
    }

    const data = await response.json();
    
    if (data.audioContent) {
      // Play audio using data URI
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      const audio = new Audio(audioUrl);
      audio.volume = volume;
      await audio.play();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    return false;
  }
};

// Browser TTS fallback
const speakWithBrowser = (text: string, settings: VoiceAlertOptions): void => {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not available');
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.volume = settings.volume;
  utterance.rate = settings.rate;
  utterance.pitch = settings.pitch;
  utterance.lang = 'pt-BR';

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(
    (voice) => voice.lang === 'pt-BR' || voice.lang.startsWith('pt')
  ) || voices.find(
    (voice) => voice.name.includes('Google') || voice.name.includes('Microsoft')
  );

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
};

export const useVoiceAlerts = (options: Partial<VoiceAlertOptions> = {}) => {
  const settings = { ...defaultOptions, ...options };
  const isSpeaking = useRef(false);
  const audioQueue = useRef<string[]>([]);
  const isProcessingQueue = useRef(false);

  const processQueue = useCallback(async () => {
    if (isProcessingQueue.current || audioQueue.current.length === 0) return;
    
    isProcessingQueue.current = true;
    
    while (audioQueue.current.length > 0) {
      const text = audioQueue.current.shift();
      if (!text) continue;
      
      isSpeaking.current = true;
      
      if (settings.useElevenLabs) {
        const success = await speakWithElevenLabs(text, settings.volume);
        if (!success) {
          // Fallback to browser TTS
          speakWithBrowser(text, settings);
        }
      } else {
        speakWithBrowser(text, settings);
      }
      
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    isSpeaking.current = false;
    isProcessingQueue.current = false;
  }, [settings]);

  const speak = useCallback((text: string) => {
    if (!settings.enabled) return;
    
    audioQueue.current.push(text);
    processQueue();
  }, [settings.enabled, processQueue]);

  const announceTradeOpened = useCallback((symbol: string, side: 'LONG' | 'SHORT', confidence: number) => {
    const sideText = side === 'LONG' ? 'compra' : 'venda';
    const confidencePercent = Math.round(confidence * 100);
    const text = `Abrindo posição de ${sideText} em ${formatSymbol(symbol)} com ${confidencePercent} por cento de confiança`;
    speak(text);
  }, [speak]);

  const announceTradeClosed = useCallback((symbol: string, pnl: number, reason: string) => {
    const pnlText = pnl >= 0 
      ? `lucro de ${Math.abs(pnl).toFixed(2)} dólares` 
      : `prejuízo de ${Math.abs(pnl).toFixed(2)} dólares`;
    const reasonText = reason === 'TP' ? 'take profit atingido' : reason === 'SL' ? 'stop loss acionado' : 'saída manual';
    const text = `Trade de ${formatSymbol(symbol)} fechado com ${pnlText}. ${reasonText}`;
    speak(text);
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
