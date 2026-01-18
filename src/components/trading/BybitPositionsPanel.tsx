import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, RefreshCw, BarChart3, Loader2, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FloatingPositionChart } from './FloatingPositionChart';

interface Position {
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealisedPnl: string;
  leverage: string;
  positionValue: string;
  liqPrice: string;
}

interface BybitPositionsPanelProps {
  positions: Position[];
  loading?: boolean;
  onRefresh?: () => void;
  autoExpandNewPositions?: boolean;
}

export const BybitPositionsPanel = ({ 
  positions, 
  loading, 
  onRefresh,
  autoExpandNewPositions = true 
}: BybitPositionsPanelProps) => {
  const [expandedPosition, setExpandedPosition] = useState<string | null>(null);
  const prevPositionsRef = useRef<Position[]>([]);
  const totalPnL = positions.reduce((sum, pos) => sum + parseFloat(pos.unrealisedPnl || '0'), 0);

  // Auto-expand new positions
  useEffect(() => {
    if (!autoExpandNewPositions) return;
    
    const prevSymbols = new Set(prevPositionsRef.current.map(p => p.symbol));
    const newPosition = positions.find(p => !prevSymbols.has(p.symbol));
    
    if (newPosition) {
      const newPosKey = `${newPosition.symbol}-${positions.findIndex(p => p.symbol === newPosition.symbol)}`;
      setExpandedPosition(newPosKey);
    }
    
    prevPositionsRef.current = positions;
  }, [positions, autoExpandNewPositions]);
  
  return (
    <Card className="glass-card h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Posições Bybit
            {positions.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {positions.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {positions.length > 0 && (
              <Badge 
                variant="outline" 
                className={cn(
                  "font-mono text-xs",
                  totalPnL >= 0 ? "border-profit text-profit" : "border-loss text-loss"
                )}
              >
                {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)} USDT
              </Badge>
            )}
            {onRefresh && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {loading && positions.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando posições...
          </div>
        ) : positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <BarChart3 className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhuma posição aberta</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[280px]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium h-8">Par</TableHead>
                  <TableHead className="text-xs font-medium h-8">Lado</TableHead>
                  <TableHead className="text-xs font-medium h-8 text-right">Tamanho</TableHead>
                  <TableHead className="text-xs font-medium h-8 text-right">Entrada</TableHead>
                  <TableHead className="text-xs font-medium h-8 text-right">Mark</TableHead>
                  <TableHead className="text-xs font-medium h-8 text-right">P&L</TableHead>
                  <TableHead className="text-xs font-medium h-8 text-right">Liq.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((pos, idx) => {
                  const pnl = parseFloat(pos.unrealisedPnl || '0');
                  const isLong = pos.side === 'Buy';
                  const posKey = `${pos.symbol}-${idx}`;
                  const isExpanded = expandedPosition === posKey;
                  
                  return (
                    <React.Fragment key={idx}>
                      <TableRow 
                        className={cn(
                          "hover:bg-muted/30 cursor-pointer transition-colors",
                          isExpanded && "bg-muted/20"
                        )}
                        onClick={() => setExpandedPosition(isExpanded ? null : posKey)}
                      >
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedPosition(isExpanded ? null : posKey);
                              }}
                            >
                              <LineChart className={cn(
                                "h-3.5 w-3.5 transition-colors",
                                isExpanded ? "text-primary" : "text-muted-foreground"
                              )} />
                            </Button>
                            <span className="font-mono text-xs font-medium">{pos.symbol.replace('USDT', '')}</span>
                            <Badge variant="outline" className="text-[10px] px-1 h-4">
                              {pos.leverage || '1'}x
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge 
                            variant={isLong ? 'default' : 'destructive'} 
                            className={cn(
                              "text-[10px] px-1.5 h-5",
                              isLong ? "bg-profit/20 text-profit hover:bg-profit/30" : "bg-loss/20 text-loss hover:bg-loss/30"
                            )}
                          >
                            <span className="flex items-center gap-0.5">
                              {isLong ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {isLong ? 'LONG' : 'SHORT'}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-xs">
                          {parseFloat(pos.size).toFixed(4)}
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
                          ${parseFloat(pos.entryPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-xs">
                          ${parseFloat(pos.markPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <span className={cn(
                            "font-mono text-xs font-medium flex items-center justify-end gap-0.5",
                            pnl >= 0 ? "text-profit" : "text-loss"
                          )}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
                          {pos.liqPrice && pos.liqPrice !== '0' 
                            ? `$${parseFloat(pos.liqPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                      {/* Expanded Chart Row */}
                      {isExpanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={7} className="p-0">
                            <div className="p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                              <FloatingPositionChart
                                position={pos}
                                onClose={() => setExpandedPosition(null)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
