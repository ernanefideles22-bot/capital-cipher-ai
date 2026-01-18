export type TradeSide = 'LONG' | 'SHORT';
export type TradeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type StrategyType = 'SCALP' | 'DAYTRADE' | 'SWING' | 'AI_AUTO';
export type BotStatus = 'RUNNING' | 'PAUSED' | 'STOPPED';
export type MarketMode = 'SPOT' | 'FUTURES';

export interface Trade {
  id: string;
  symbol: string;
  side: TradeSide;
  strategy: StrategyType;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  leverage: number;
  stopLoss: number;
  takeProfit: number;
  pnl?: number;
  pnlPercentage?: number;
  status: TradeStatus;
  openedAt: Date;
  closedAt?: Date;
  notes?: string;
  aiConfidence?: number;
  aiReasoning?: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercentage24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

export interface BotConfig {
  mode: 'paper' | 'live';
  marketMode: MarketMode;
  leverage: number;
  maxDrawdown: number;
  maxConcurrentTrades: number;
  riskPerTrade: number;
  assets: string[];
}

export interface BotStats {
  status: BotStatus;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  currentDrawdown: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
}

export interface AIDecision {
  id: string;
  timestamp: Date;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD' | 'SKIP';
  confidence: number;
  reasoning: string;
  indicators: {
    institutionalFlow: number;
    volumeCluster: boolean;
    trendStrength: number;
    riskScore: number;
  };
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'AI' | 'TRADE';
  message: string;
  details?: string;
}
