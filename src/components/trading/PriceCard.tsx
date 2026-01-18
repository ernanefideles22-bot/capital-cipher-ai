import { TrendingUp, TrendingDown } from 'lucide-react';
import type { MarketData } from '@/types/trading';
import { cn } from '@/lib/utils';

interface PriceCardProps {
  data: MarketData;
  isSelected?: boolean;
  onClick?: () => void;
  priceAnimation?: 'up' | 'down' | null;
}

export const PriceCard = ({ data, isSelected, onClick, priceAnimation }: PriceCardProps) => {
  const isPositive = data.changePercentage24h >= 0;
  
  return (
    <div 
      className={cn(
        "glass-card p-4 transition-all cursor-pointer",
        isSelected 
          ? "border-primary ring-2 ring-primary/20 bg-primary/5" 
          : "hover:border-primary/30",
        priceAnimation === 'up' && "ring-2 ring-profit/50 bg-profit/5",
        priceAnimation === 'down' && "ring-2 ring-loss/50 bg-loss/5"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          "text-sm font-medium",
          isSelected ? "text-primary" : "text-muted-foreground"
        )}>
          {data.symbol}
        </span>
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded transition-all",
          isPositive ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
        )}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isPositive ? '+' : ''}{data.changePercentage24h.toFixed(2)}%
        </div>
      </div>
      
      <div className={cn(
        "price-ticker mb-3 transition-all duration-200",
        priceAnimation === 'up' && "text-profit scale-105",
        priceAnimation === 'down' && "text-loss scale-105"
      )}>
        ${data.price.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: data.price > 1000 ? 2 : 4 
        })}
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground block">24h High</span>
          <span className="font-mono text-profit">${data.high24h.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">24h Low</span>
          <span className="font-mono text-loss">${data.low24h.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
};
