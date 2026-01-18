-- Neural Network Memory System for Trading AI

-- Neural network weights and learning state
CREATE TABLE public.neural_network_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Network architecture info
  network_version INTEGER DEFAULT 1,
  total_epochs INTEGER DEFAULT 0,
  
  -- Performance metrics
  accuracy DECIMAL(5, 2) DEFAULT 50.0,
  win_rate DECIMAL(5, 2) DEFAULT 50.0,
  loss_value DECIMAL(10, 6) DEFAULT 1.0,
  sharpe_ratio DECIMAL(10, 4) DEFAULT 0.0,
  
  -- Strategy weights (JSON: { strategyName: weight })
  strategy_weights JSONB DEFAULT '{"SCALP": 0.33, "DAYTRADE": 0.34, "SWING": 0.33}',
  
  -- Market factor weights (JSON: { factorName: weight })
  factor_weights JSONB DEFAULT '{"momentum": 0.2, "volume": 0.2, "trend": 0.2, "volatility": 0.2, "rsi": 0.2}',
  
  -- Pattern recognition weights
  pattern_weights JSONB DEFAULT '{}',
  
  -- Symbol-specific performance
  symbol_performance JSONB DEFAULT '{}',
  
  -- Last training timestamp
  last_trained_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  UNIQUE(user_id)
);

-- Trade experiences for learning
CREATE TABLE public.trade_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE,
  
  -- Market context at entry
  symbol TEXT NOT NULL,
  entry_price DECIMAL(20, 8) NOT NULL,
  exit_price DECIMAL(20, 8),
  side TEXT NOT NULL,
  
  -- Technical indicators at entry
  rsi_entry DECIMAL(5, 2),
  macd_entry DECIMAL(20, 8),
  ema_trend TEXT, -- 'bullish', 'bearish', 'neutral'
  volume_ratio DECIMAL(10, 4),
  volatility_entry DECIMAL(10, 4),
  
  -- Market conditions
  market_sentiment TEXT, -- 'fear', 'greed', 'neutral'
  btc_correlation DECIMAL(5, 4),
  
  -- Outcome
  pnl DECIMAL(20, 8),
  pnl_percentage DECIMAL(10, 4),
  outcome TEXT CHECK (outcome IN ('WIN', 'LOSS', 'BREAKEVEN')),
  
  -- AI decision context
  ai_confidence DECIMAL(5, 2),
  strategy_used TEXT,
  
  -- Learning metadata
  learned BOOLEAN DEFAULT false,
  learning_contribution DECIMAL(10, 6) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Neural network training history
CREATE TABLE public.neural_training_epochs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  epoch_number INTEGER NOT NULL,
  
  -- Metrics before training
  accuracy_before DECIMAL(5, 2),
  loss_before DECIMAL(10, 6),
  
  -- Metrics after training
  accuracy_after DECIMAL(5, 2),
  loss_after DECIMAL(10, 6),
  
  -- Training details
  trades_processed INTEGER DEFAULT 0,
  learning_rate DECIMAL(10, 6) DEFAULT 0.01,
  weight_updates JSONB DEFAULT '{}',
  
  -- Improvements
  accuracy_improvement DECIMAL(5, 2),
  
  trained_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.neural_network_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neural_training_epochs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for neural_network_state
CREATE POLICY "Users can view own neural state"
  ON public.neural_network_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own neural state"
  ON public.neural_network_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own neural state"
  ON public.neural_network_state FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for trade_experiences
CREATE POLICY "Users can view own experiences"
  ON public.trade_experiences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own experiences"
  ON public.trade_experiences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own experiences"
  ON public.trade_experiences FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for neural_training_epochs
CREATE POLICY "Users can view own training history"
  ON public.neural_training_epochs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training history"
  ON public.neural_training_epochs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_trade_experiences_user ON public.trade_experiences(user_id);
CREATE INDEX idx_trade_experiences_outcome ON public.trade_experiences(outcome);
CREATE INDEX idx_trade_experiences_learned ON public.trade_experiences(learned);
CREATE INDEX idx_neural_epochs_user ON public.neural_training_epochs(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_neural_state_updated_at
  BEFORE UPDATE ON public.neural_network_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();