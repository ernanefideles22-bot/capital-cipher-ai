export interface BacktestConfig {
  symbol: string;
  strategy: 'SCALP' | 'DAYTRADE' | 'SWING' | 'ALL';
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  leverage: number;
  riskPerTrade: number;
  maxDrawdown: number;
}

export interface BacktestTrade {
  id: string;
  entryTime: Date;
  exitTime: Date;
  entryPrice: number;
  exitPrice: number;
  side: 'LONG' | 'SHORT';
  strategy: 'SCALP' | 'DAYTRADE' | 'SWING';
  quantity: number;
  pnl: number;
  pnlPercentage: number;
  commission: number;
}

export interface BacktestCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestResults {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercentage: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  averageHoldingTime: number;
  totalCommissions: number;
  equityCurve: { time: number; equity: number; drawdown: number }[];
  trades: BacktestTrade[];
  monthlyReturns: { month: string; return: number }[];
}

export interface BacktestStatus {
  isRunning: boolean;
  progress: number;
  currentDate?: Date;
  tradesFound: number;
}
