-- Create bot_logs table for persistent activity and trade logs
CREATE TABLE public.bot_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR', 'AI', 'SUCCESS', 'TRADE')),
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for bot_logs
CREATE POLICY "Users can view their own bot logs"
  ON public.bot_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bot logs"
  ON public.bot_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for performance on user_id and timestamp queries
CREATE INDEX idx_bot_logs_user_id ON public.bot_logs(user_id);
CREATE INDEX idx_bot_logs_timestamp ON public.bot_logs(timestamp DESC);
