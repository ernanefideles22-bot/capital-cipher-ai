import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBybitAPI } from '@/hooks/useBybitAPI';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface BybitOrdersPanelProps {
  isConnected: boolean;
}

export function BybitOrdersPanel({ isConnected }: BybitOrdersPanelProps) {
  const { getOrderHistory, getActiveOrders, loading } = useBybitAPI();
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    if (!isConnected) return;
    
    setRefreshing(true);
    try {
      const [history, active] = await Promise.all([
        getOrderHistory(50),
        getActiveOrders()
      ]);
      setOrderHistory(history);
      setActiveOrders(active);
    } catch (error) {
      console.error('Erro ao buscar ordens:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchOrders();
      const interval = setInterval(fetchOrders, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; label: string }> = {
      'Filled': { variant: 'default', icon: <CheckCircle className="h-3 w-3" />, label: 'Executada' },
      'PartiallyFilled': { variant: 'secondary', icon: <AlertCircle className="h-3 w-3" />, label: 'Parcial' },
      'New': { variant: 'outline', icon: <Clock className="h-3 w-3" />, label: 'Pendente' },
      'Cancelled': { variant: 'destructive', icon: <XCircle className="h-3 w-3" />, label: 'Cancelada' },
      'Rejected': { variant: 'destructive', icon: <XCircle className="h-3 w-3" />, label: 'Rejeitada' },
    };

    const config = statusConfig[status] || { variant: 'outline' as const, icon: null, label: status };
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 text-xs">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(parseInt(timestamp)), 'dd/MM HH:mm:ss');
    } catch {
      return '-';
    }
  };

  const OrderRow = ({ order }: { order: any }) => (
    <div className="flex items-center justify-between p-3 border-b border-border/50 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{order.symbol}</span>
            <Badge variant={order.side === 'Buy' ? 'default' : 'destructive'} className="text-xs">
              {order.side === 'Buy' ? 'LONG' : 'SHORT'}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {order.orderType} • Qty: {parseFloat(order.qty).toFixed(4)}
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className="flex items-center gap-2 justify-end">
          {getStatusBadge(order.orderStatus)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {order.avgPrice && parseFloat(order.avgPrice) > 0 
            ? `Preço: $${parseFloat(order.avgPrice).toFixed(2)}`
            : order.price && parseFloat(order.price) > 0 
              ? `Limite: $${parseFloat(order.price).toFixed(2)}`
              : 'Market'
          }
        </div>
        <div className="text-xs text-muted-foreground">
          {formatTime(order.createdTime)}
        </div>
      </div>
    </div>
  );

  if (!isConnected) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico de Ordens Bybit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Conecte à Bybit para ver o histórico de ordens
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Ordens Bybit
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchOrders}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mx-3 mb-2" style={{ width: 'calc(100% - 24px)' }}>
            <TabsTrigger value="active" className="text-xs">
              Ativas ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              Histórico ({orderHistory.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="mt-0">
            <ScrollArea className="h-[300px]">
              {activeOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma ordem ativa
                </p>
              ) : (
                activeOrders.map((order, idx) => (
                  <OrderRow key={order.orderId || idx} order={order} />
                ))
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="history" className="mt-0">
            <ScrollArea className="h-[300px]">
              {orderHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma ordem no histórico
                </p>
              ) : (
                orderHistory.map((order, idx) => (
                  <OrderRow key={order.orderId || idx} order={order} />
                ))
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
