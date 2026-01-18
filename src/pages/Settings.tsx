import { ArrowLeft, Settings2, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ConfigPanel } from '@/components/trading/ConfigPanel';
import { BybitConnectionPanel } from '@/components/trading/BybitConnectionPanel';
import { VoiceSettingsPanel } from '@/components/trading/VoiceSettingsPanel';
import { useTradingData } from '@/hooks/useTradingData';
import { useBybitAccount } from '@/hooks/useBybitAccount';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { isRealMode } = useBybitAccount();
  const { config, updateConfig } = useTradingData({ isRealMode });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-accent" />
              <h1 className="text-xl font-bold">Configurações</h1>
            </div>
          </div>
          <Badge variant="outline" className={isRealMode ? 'border-profit text-profit' : 'border-warning text-warning'}>
            {isRealMode ? '🟢 Conta Real' : '🟡 Modo Demo'}
          </Badge>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1200px] mx-auto px-4 py-6 space-y-6">
        {/* Bot Configuration */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-muted-foreground" />
            Configurações do Bot
          </h2>
          <div className="max-w-xl">
            <ConfigPanel config={config} onUpdateConfig={updateConfig} />
          </div>
        </section>

        {/* Voice Settings */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-muted-foreground" />
            Configurações de Voz
          </h2>
          <div className="max-w-xl">
            <VoiceSettingsPanel />
          </div>
        </section>

        {/* Bybit Connection */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Conexão Bybit</h2>
          <div className="max-w-xl">
            <BybitConnectionPanel />
          </div>
        </section>
      </main>
    </div>
  );
};

export default SettingsPage;
