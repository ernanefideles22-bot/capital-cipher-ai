import { TrendingUp, TrendingDown } from 'lucide-react';
import type { MarketData } from '@/types/trading';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface PriceCardProps {
  data: MarketData;
  isSelected?: boolean;
  onClick?: () => void;
  priceAnimation?: 'up' | 'down' | null;
  sparklineData?: number[];
}

// Simple SVG Sparkline component
const Sparkline = ({ data, isPositive }: { data: number[]; isPositive: boolean }) => {
  const { path, minY, maxY } = useMemo(() => {
    if (!data || data.length < 2) return { path: '', minY: 0, maxY: 0 };
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const width = 100;
    const height = 30;
    const padding = 2;
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return { x, y };
    });
    
    // Create smooth path using quadratic curves
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      pathD += ` Q ${prev.x} ${prev.y} ${midX} ${(prev.y + curr.y) / 2}`;
    }
    pathD += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
    
    return { path: pathD, minY: min, maxY: max };
  }, [data]);

  if (!data || data.length < 2) {
    return (
      <div className="h-8 flex items-center justify-center text-xs text-muted-foreground">
        Loading...
      </div>
    );
  }

  const trendColor = isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))';
  const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg 
      viewBox="0 0 100 30" 
      className="w-full h-8"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={trendColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Fill area under the line */}
      <path
        d={`${path} L 100 30 L 0 30 Z`}
        fill={`url(#${gradientId})`}
      />
      
      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke={trendColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Current price dot */}
      {data.length > 0 && (
        <circle
          cx="100"
          cy={30 - 2 - ((data[data.length - 1] - Math.min(...data)) / (Math.max(...data) - Math.min(...data) || 1)) * 26}
          r="2"
          fill={trendColor}
          className="animate-pulse"
        />
      )}
    </svg>
  );
};

export const PriceCard = ({ data, isSelected, onClick, priceAnimation, sparklineData }: PriceCardProps) => {
  const isPositive = data.changePercentage24h >= 0;
  
  // Determine sparkline trend (compare first and last)
  const sparklineTrend = useMemo(() => {
    if (!sparklineData || sparklineData.length < 2) return isPositive;
    return sparklineData[sparklineData.length - 1] >= sparklineData[0];
  }, [sparklineData, isPositive]);
  
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
        "price-ticker mb-2 transition-all duration-200",
        priceAnimation === 'up' && "text-profit scale-105",
        priceAnimation === 'down' && "text-loss scale-105"
      )}>
        ${data.price.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: data.price > 1000 ? 2 : 4 
        })}
      </div>

      {/* Sparkline Chart */}
      <div className="mb-2 -mx-1">
        <Sparkline data={sparklineData || []} isPositive={sparklineTrend} />
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
