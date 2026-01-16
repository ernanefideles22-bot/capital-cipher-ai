import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBybitAPI } from '@/hooks/useBybitAPI';
import { Wallet, RefreshCw, CheckCircle, XCircle, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WalletInfo {
  totalEquity: number;
  totalWalletBalance: number;
  totalAvailableBalance: number;
  totalPnL: number;
}

export const BybitConnectionPanel = () => {
  const { loading, error, connected, testConnection, getWalletBalance, getPositions } = useBybitAPI();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const refreshData = async () => {
    const isConnected = await testConnection();
    
    if (isConnected) {
      const walletData = await getWalletBalance();
      if (walletData) {
        setWallet(walletData);
      }
      
      const positionsData = await getPositions();
      setPositions(positionsData);
      
      setLastUpdate(new Date());
      toast.success('Dados da Bybit atualizados');
    } else {
      toast.error('Falha ao conectar com a Bybit');
    }
  };

  useEffect(() => {
    refreshData();
    
    // Auto refresh every 30 seconds
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Bybit Account
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={connected ? "default" : connected === false ? "destructive" : "secondary"}>
              {connected === null ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : connected ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <XCircle className="h-3 w-3 mr-1" />
              )}
              {connected === null ? 'Verificando...' : connected ? 'Conectado' : 'Desconectado'}
            </Badge>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={refreshData}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
            {error}
          </div>
        )}
        
        {wallet && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Equity Total</p>
              <p className="text-lg font-bold font-mono">
                ${wallet.totalEquity.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Saldo Disponível</p>
              <p className="text-lg font-bold font-mono">
                ${wallet.totalAvailableBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 col-span-2">
              <p className="text-xs text-muted-foreground">P&L Não Realizado</p>
              <p className={cn(
                "text-lg font-bold font-mono flex items-center gap-1",
                wallet.totalPnL >= 0 ? "text-profit" : "text-loss"
              )}>
                {wallet.totalPnL >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {wallet.totalPnL >= 0 ? '+' : ''}${wallet.totalPnL.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}
        
        {positions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Posições Abertas ({positions.length})</h4>
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {positions.map((pos, idx) => (
                <div key={idx} className="bg-muted/20 rounded p-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-medium">{pos.symbol}</span>
                    <Badge variant={pos.side === 'Buy' ? 'default' : 'destructive'} className="text-xs">
                      {pos.side === 'Buy' ? 'LONG' : 'SHORT'}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Tamanho: {pos.size}</span>
                    <span className={cn(
                      parseFloat(pos.unrealisedPnl) >= 0 ? "text-profit" : "text-loss"
                    )}>
                      P&L: ${parseFloat(pos.unrealisedPnl).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {lastUpdate && (
          <p className="text-xs text-muted-foreground text-center">
            Última atualização: {lastUpdate.toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
};