import { z } from 'zod';

// Schema for raw WebSocket Market Data (incoming snake_case)
export const wsMarketDataSchema = z.object({
  symbol: z.string().min(1),
  price: z.number().positive(),
  change_24h: z.number().optional().default(0),
  change_percentage_24h: z.number().optional().default(0),
  high_24h: z.number().positive().optional(),
  low_24h: z.number().positive().optional(),
  volume_24h: z.number().nonnegative().optional().default(0),
  timestamp: z.number().positive().optional().default(() => Date.now()),
});

// Schema for raw WebSocket Bot Stats (incoming snake_case)
export const wsBotStatsSchema = z.object({
  status: z.enum(['RUNNING', 'PAUSED', 'STOPPED']).or(z.string().transform(val => {
    const upper = val.toUpperCase();
    if (upper === 'RUNNING' || upper === 'PAUSED' || upper === 'STOPPED') return upper;
    return 'PAUSED' as const;
  })).default('PAUSED'),
  total_trades: z.number().int().nonnegative().optional().default(0),
  win_rate: z.number().min(0).max(100).optional().default(0),
  total_pnl: z.number().optional().default(0),
  daily_pnl: z.number().optional().default(0),
  weekly_pnl: z.number().optional().default(0),
  monthly_pnl: z.number().optional().default(0),
  current_drawdown: z.number().min(0).optional().default(0),
  max_drawdown: z.number().min(0).optional().default(10),
  sharpe_ratio: z.number().optional().default(0),
  profit_factor: z.number().optional().default(0),
});

// Schema for raw WebSocket Trade data (incoming snake_case)
export const wsTradeSchema = z.object({
  id: z.string().optional().default(() => crypto.randomUUID()),
  symbol: z.string().min(1),
  side: z.enum(['BUY', 'SELL', 'LONG', 'SHORT']).transform(val => {
    const upper = val.toUpperCase();
    return (upper === 'BUY' || upper === 'LONG') ? 'LONG' as const : 'SHORT' as const;
  }),
  strategy: z.enum(['SCALP', 'DAYTRADE', 'SWING', 'AI_AUTO']).or(z.string().transform(val => {
    const upper = val.toUpperCase();
    if (upper === 'SCALP' || upper === 'DAYTRADE' || upper === 'SWING' || upper === 'AI_AUTO') return upper;
    return 'SCALP' as const;
  })).default('SCALP'),
  entry_price: z.number().positive(),
  exit_price: z.number().positive().optional(),
  quantity: z.number().positive(),
  leverage: z.number().int().positive().optional().default(1),
  stop_loss: z.number().positive().optional().default(0),
  take_profit: z.number().positive().optional().default(0),
  pnl: z.number().optional().default(0),
  pnl_percentage: z.number().optional().default(0),
  status: z.enum(['OPEN', 'CLOSED', 'CANCELLED']).or(z.string().transform(val => {
    const upper = val.toUpperCase();
    if (upper === 'OPEN' || upper === 'CLOSED' || upper === 'CANCELLED') return upper;
    return 'OPEN' as const;
  })).default('OPEN'),
  opened_at: z.string().or(z.number()).or(z.date()).transform(val => new Date(val).toISOString()).optional().default(() => new Date().toISOString()),
  closed_at: z.string().or(z.number()).or(z.date()).transform(val => new Date(val).toISOString()).optional(),
});

// Schema for raw WebSocket Log data (incoming snake_case)
export const wsLogSchema = z.object({
  timestamp: z.string().or(z.number()).or(z.date()).transform(val => new Date(val).toISOString()).optional().default(() => new Date().toISOString()),
  level: z.enum(['INFO', 'WARN', 'ERROR', 'SUCCESS', 'AI', 'TRADE']).or(z.string().transform(val => {
    const upper = val.toUpperCase();
    if (upper === 'INFO' || upper === 'WARN' || upper === 'ERROR' || upper === 'SUCCESS' || upper === 'AI' || upper === 'TRADE') return upper;
    return 'INFO' as const;
  })).default('INFO'),
  message: z.string().min(1),
});

// Schema for raw WebSocket AI Decision data (incoming snake_case)
export const wsAIDecisionSchema = z.object({
  timestamp: z.string().or(z.number()).or(z.date()).transform(val => new Date(val).toISOString()).optional().default(() => new Date().toISOString()),
  symbol: z.string().min(1),
  action: z.enum(['BUY', 'SELL', 'HOLD', 'SKIP']).or(z.string().transform(val => {
    const upper = val.toUpperCase();
    if (upper === 'BUY' || upper === 'SELL' || upper === 'HOLD' || upper === 'SKIP') return upper;
    return 'HOLD' as const;
  })).default('HOLD'),
  confidence: z.number().min(0).max(100),
  reasoning: z.string().optional().default(''),
  institutional_flow: z.number().optional().default(0),
  volume_cluster: z.boolean().optional().default(false),
  trend_strength: z.number().optional().default(0),
  risk_score: z.number().optional().default(0),
});
