import { useState, useEffect } from 'react';
import { Volume2, Play, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ELEVENLABS_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Feminina, clara e profissional', lang: 'Multi' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Feminina, suave e natural', lang: 'Multi' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'Masculina, grave e confiante', lang: 'Multi' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Masculina, jovem e dinâmica', lang: 'Multi' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Masculina, madura e autoritária', lang: 'Multi' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', description: 'Masculina, casual e amigável', lang: 'Multi' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Masculina, profissional e calma', lang: 'Multi' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'Feminina, energética e alegre', lang: 'Multi' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', description: 'Feminina, quente e expressiva', lang: 'Multi' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Feminina, suave e gentil', lang: 'Multi' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Masculina, formal e confiável', lang: 'Multi' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', description: 'Masculina, grave e séria', lang: 'Multi' },
];

interface VoiceSettings {
  enabled: boolean;
  useElevenLabs: boolean;
  voiceId: string;
  volume: number;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  enabled: true,
  useElevenLabs: false,
  voiceId: 'EXAVITQu4vr4xnSDxMaL',
  volume: 0.8,
};

export const getVoiceSettings = (): VoiceSettings => {
  try {
    const stored = localStorage.getItem('voiceSettings');
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load voice settings:', e);
  }
  return DEFAULT_SETTINGS;
};

export const saveVoiceSettings = (settings: VoiceSettings): void => {
  try {
    localStorage.setItem('voiceSettings', JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save voice settings:', e);
  }
};

export const VoiceSettingsPanel = () => {
  const [settings, setSettings] = useState<VoiceSettings>(getVoiceSettings);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    saveVoiceSettings(settings);
  }, [settings]);

  const updateSetting = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const speakWithBrowser = (text: string) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Voz não disponível neste navegador.');
      setIsPlaying(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = settings.volume;
    utterance.lang = 'pt-BR';
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    window.speechSynthesis.speak(utterance);
  };

  const testVoice = async () => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    const testText = '4Asas Trading: alerta de voz ativo em português.';
    
    try {
      if (settings.useElevenLabs) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text: testText, voiceId: settings.voiceId }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.audioContent) {
            const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
            const audio = new Audio(audioUrl);
            audio.volume = settings.volume;
            audio.onended = () => setIsPlaying(false);
            audio.onerror = () => speakWithBrowser(testText);
            await audio.play();
            return;
          }
        }

        toast.warning('ElevenLabs indisponível. Usando voz do navegador.');
      }
      
      speakWithBrowser(testText);
    } catch (error) {
      console.warn('Voice test fallback:', error);
      toast.warning('Usando voz do navegador.');
      speakWithBrowser(testText);
    }
  };

  const selectedVoice = ELEVENLABS_VOICES.find(v => v.id === settings.voiceId);

  return (
    <div className="glass-card p-4 space-y-5">
      <div className="flex items-center gap-2">
        <Volume2 className="w-5 h-5 text-accent" />
        <h3 className="font-semibold">Alertas de Voz</h3>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="voice-enabled" className="text-sm font-medium">Alertas de Voz</Label>
          <p className="text-xs text-muted-foreground">Receba alertas sonoros para trades</p>
        </div>
        <Switch
          id="voice-enabled"
          checked={settings.enabled}
          onCheckedChange={(checked) => updateSetting('enabled', checked)}
        />
      </div>

      {settings.enabled && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="use-elevenlabs" className="text-sm font-medium">ElevenLabs (Premium)</Label>
              <p className="text-xs text-muted-foreground">Opcional. Se falhar, usa voz do navegador.</p>
            </div>
            <Switch
              id="use-elevenlabs"
              checked={settings.useElevenLabs}
              onCheckedChange={(checked) => updateSetting('useElevenLabs', checked)}
            />
          </div>

          {settings.useElevenLabs && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Escolher Voz</Label>
              <Select
                value={settings.voiceId}
                onValueChange={(value) => updateSetting('voiceId', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma voz" />
                </SelectTrigger>
                <SelectContent>
                  {ELEVENLABS_VOICES.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{voice.name}</span>
                        <span className="text-xs text-muted-foreground">{voice.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedVoice && (
                <p className="text-xs text-muted-foreground">
                  {selectedVoice.description}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Volume</Label>
              <span className="text-xs text-muted-foreground">{Math.round(settings.volume * 100)}%</span>
            </div>
            <Slider
              value={[settings.volume]}
              onValueChange={([value]) => updateSetting('volume', value)}
              min={0}
              max={1}
              step={0.1}
              className="w-full"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={testVoice}
            disabled={isPlaying}
            className="w-full gap-2"
          >
            {isPlaying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reproduzindo...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Testar Voz
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
};
