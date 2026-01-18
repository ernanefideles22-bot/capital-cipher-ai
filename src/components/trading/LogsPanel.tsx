import { Terminal, Info, AlertTriangle, CheckCircle, XCircle, Brain, Trash2 } from 'lucide-react';
import type { LogEntry } from '@/types/trading';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface LogsPanelProps {
  logs: LogEntry[];
  isRealMode?: boolean;
  onClearLogs?: () => void;
}

const levelConfig = {
  INFO: { icon: Info, color: 'text-accent', bg: 'bg-accent/10' },
  WARN: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  ERROR: { icon: XCircle, color: 'text-loss', bg: 'bg-loss/10' },
  SUCCESS: { icon: CheckCircle, color: 'text-profit', bg: 'bg-profit/10' },
  AI: { icon: Brain, color: 'text-primary', bg: 'bg-primary/10' },
};

export const LogsPanel = ({ logs, isRealMode = false, onClearLogs }: LogsPanelProps) => {
  return (
    <div className="glass-card h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Terminal className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold">Logs do Sistema</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {logs.length} entradas
        </span>
        {onClearLogs && logs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearLogs}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Limpar
          </Button>
        )}
        <span className="ml-auto" />
        {isRealMode ? (
          <span className="text-xs px-2 py-1 rounded bg-profit/10 text-profit border border-profit/30">
            🟢 Real
          </span>
        ) : (
          <span className="text-xs px-2 py-1 rounded bg-warning/10 text-warning border border-warning/30">
            🟡 Demo
          </span>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 terminal-log">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Aguardando logs...
          </div>
        ) : (
          logs.map((log, index) => {
            const config = levelConfig[log.level];
            const Icon = config.icon;
            
            return (
              <div 
                key={log.id} 
                className={cn(
                  "terminal-log-entry flex items-start gap-2",
                  index === 0 && "animate-slide-up"
                )}
              >
                <div className={cn(
                  "flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5",
                  config.bg
                )}>
                  <Icon className={cn("w-3 h-3", config.color)} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(log.timestamp).toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", config.bg, config.color)}>
                      {log.level}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5 break-words">{log.message}</p>
                  {log.details && (
                    <p className="text-xs text-muted-foreground mt-1">{log.details}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
