import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { WebSocketStatus } from '@/hooks/useWebSocket';

interface ConnectionStatusProps {
  status: WebSocketStatus;
  isConnected: boolean;
  error: string | null;
  onReconnect: () => void;
}

export const ConnectionStatus = ({ 
  status, 
  isConnected, 
  error, 
  onReconnect 
}: ConnectionStatusProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-profit',
          bgColor: 'bg-profit/20',
          label: 'Conectado ao Bot',
          pulse: false,
        };
      case 'connecting':
        return {
          icon: RefreshCw,
          color: 'text-warning',
          bgColor: 'bg-warning/20',
          label: 'Conectando...',
          pulse: true,
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-loss',
          bgColor: 'bg-loss/20',
          label: error || 'Erro de conexão',
          pulse: false,
        };
      default:
        return {
          icon: WifiOff,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          label: 'Desconectado - Usando simulação',
          pulse: false,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgColor}`}>
            <Icon 
              className={`w-4 h-4 ${config.color} ${config.pulse ? 'animate-spin' : ''}`} 
            />
            <span className={`text-xs font-medium ${config.color}`}>
              {isConnected ? 'LIVE' : 'DEMO'}
            </span>
          </div>
          
          {!isConnected && status !== 'connecting' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReconnect}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Reconectar
            </Button>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{config.label}</p>
        {!isConnected && (
          <p className="text-xs text-muted-foreground mt-1">
            Execute o bot Python para dados reais
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
};
