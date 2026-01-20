import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TradeExperience {
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number;
  pnl: number;
  pnl_percentage: number;
  outcome: string;
  ai_confidence: number;
  strategy_used: string;
  rsi_entry?: number;
  volume_ratio?: number;
  ema_trend?: string;
}

interface NeuralState {
  accuracy: number;
  win_rate: number;
  loss_value: number;
  total_epochs: number;
  strategy_weights: Record<string, number>;
  factor_weights: Record<string, number>;
  symbol_performance: Record<string, { wins: number; losses: number; pnl: number }>;
}

// Sigmoid activation function
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

// Calculate gradient for weight update
const calculateGradient = (
  predicted: number,
  actual: number,
  input: number,
  learningRate: number
): number => {
  const error = actual - predicted;
  const gradient = error * predicted * (1 - predicted) * input;
  return learningRate * gradient;
};

// Process experiences and update weights
const trainOnExperiences = (
  experiences: TradeExperience[],
  currentState: NeuralState,
  learningRate: number = 0.01
): { newState: NeuralState; weightUpdates: Record<string, number> } => {
  const strategyWeights = { ...currentState.strategy_weights };
  const factorWeights = { ...currentState.factor_weights };
  const symbolPerf = { ...currentState.symbol_performance };
  const weightUpdates: Record<string, number> = {};

  let totalAccuracy = 0;
  let wins = 0;
  let totalLoss = 0;

  for (const exp of experiences) {
    // Determine actual outcome (1 for win, 0 for loss)
    const actualOutcome = exp.outcome === 'WIN' ? 1 : 0;
    
    // Simple neural prediction based on current weights
    let prediction = 0.5; // Base prediction
    
    // Add strategy weight influence
    const strategy = exp.strategy_used || 'DAYTRADE';
    const strategyWeight = strategyWeights[strategy] || 0.33;
    prediction += strategyWeight * 0.2;

    // Add confidence as input
    const confidenceInput = (exp.ai_confidence || 50) / 100;
    prediction += confidenceInput * 0.3 * (factorWeights['momentum'] || 0.2);

    // Clamp prediction
    prediction = Math.max(0.1, Math.min(0.9, prediction));

    // Calculate loss (binary cross-entropy approximation)
    const loss = -actualOutcome * Math.log(prediction + 0.0001) - (1 - actualOutcome) * Math.log(1 - prediction + 0.0001);
    totalLoss += loss;

    // Update strategy weights based on outcome
    if (exp.outcome === 'WIN') {
      wins++;
      // Increase weight for winning strategy
      const delta = learningRate * (1 - strategyWeight) * 0.1;
      strategyWeights[strategy] = Math.min(0.6, (strategyWeights[strategy] || 0.33) + delta);
      weightUpdates[`strategy_${strategy}`] = (weightUpdates[`strategy_${strategy}`] || 0) + delta;
    } else {
      // Decrease weight for losing strategy
      const delta = learningRate * strategyWeight * 0.1;
      strategyWeights[strategy] = Math.max(0.1, (strategyWeights[strategy] || 0.33) - delta);
      weightUpdates[`strategy_${strategy}`] = (weightUpdates[`strategy_${strategy}`] || 0) - delta;
    }

    // Update symbol performance
    if (!symbolPerf[exp.symbol]) {
      symbolPerf[exp.symbol] = { wins: 0, losses: 0, pnl: 0 };
    }
    if (exp.outcome === 'WIN') {
      symbolPerf[exp.symbol].wins++;
    } else {
      symbolPerf[exp.symbol].losses++;
    }
    symbolPerf[exp.symbol].pnl += exp.pnl || 0;

    // Update factor weights based on indicators
    if (exp.rsi_entry) {
      const rsiOptimal = exp.outcome === 'WIN' ? (exp.side === 'LONG' ? exp.rsi_entry < 40 : exp.rsi_entry > 60) : false;
      if (rsiOptimal) {
        factorWeights['rsi'] = Math.min(0.4, (factorWeights['rsi'] || 0.2) + learningRate * 0.05);
      }
    }

    if (exp.volume_ratio && exp.volume_ratio > 1.5 && exp.outcome === 'WIN') {
      factorWeights['volume'] = Math.min(0.4, (factorWeights['volume'] || 0.2) + learningRate * 0.05);
    }

    // Track accuracy
    const predicted = prediction > 0.5 ? 1 : 0;
    if (predicted === actualOutcome) totalAccuracy++;
  }

  // Normalize strategy weights
  const totalStrategyWeight = Object.values(strategyWeights).reduce((a, b) => a + b, 0);
  Object.keys(strategyWeights).forEach(key => {
    strategyWeights[key] = strategyWeights[key] / totalStrategyWeight;
  });

  // Calculate new metrics
  const newAccuracy = experiences.length > 0 ? (totalAccuracy / experiences.length) * 100 : currentState.accuracy;
  const newWinRate = experiences.length > 0 ? (wins / experiences.length) * 100 : currentState.win_rate;
  const avgLoss = experiences.length > 0 ? totalLoss / experiences.length : currentState.loss_value;

  return {
    newState: {
      accuracy: Math.min(95, Math.max(newAccuracy, (currentState.accuracy + newAccuracy) / 2)),
      win_rate: Math.min(90, Math.max(newWinRate, (currentState.win_rate + newWinRate) / 2)),
      loss_value: Math.max(0.01, avgLoss),
      total_epochs: currentState.total_epochs + 1,
      strategy_weights: strategyWeights,
      factor_weights: factorWeights,
      symbol_performance: symbolPerf,
    },
    weightUpdates,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, experiences: newExperiences, learningRate = 0.01 } = await req.json();

    if (action === "train") {
      // Get current neural state
      let { data: neuralState, error: stateError } = await supabase
        .from("neural_network_state")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Create initial state if not exists
      if (!neuralState) {
        const { data: newState, error: insertError } = await supabase
          .from("neural_network_state")
          .insert({
            user_id: user.id,
            accuracy: 50,
            win_rate: 50,
            loss_value: 1.0,
            total_epochs: 0,
            strategy_weights: { SCALP: 0.33, DAYTRADE: 0.34, SWING: 0.33 },
            factor_weights: { momentum: 0.2, volume: 0.2, trend: 0.2, volatility: 0.2, rsi: 0.2 },
            symbol_performance: {},
          })
          .select()
          .single();

        if (insertError) throw insertError;
        neuralState = newState;
      }

      // First, import any closed trades that haven't been converted to experiences
      const { data: existingExpTradeIds } = await supabase
        .from("trade_experiences")
        .select("trade_id")
        .eq("user_id", user.id);
      
      const processedTradeIds = new Set((existingExpTradeIds || []).map(e => e.trade_id).filter(Boolean));

      // Get closed trades not yet converted to experiences
      const { data: closedTrades } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "CLOSED")
        .not("exit_price", "is", null);
      
      const newTradesForExp = (closedTrades || []).filter((t: any) => !processedTradeIds.has(t.id));
      
      // Convert and insert new trades as experiences
      if (newTradesForExp.length > 0) {
        console.log(`Importing ${newTradesForExp.length} historical trades as experiences...`);
        
        const newExperiences = newTradesForExp.map((trade: any) => ({
          user_id: user.id,
          trade_id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          entry_price: trade.entry_price,
          exit_price: trade.exit_price,
          pnl: trade.pnl,
          pnl_percentage: trade.pnl_percentage,
          outcome: trade.pnl > 0 ? 'WIN' : trade.pnl < 0 ? 'LOSS' : 'BREAKEVEN',
          ai_confidence: trade.ai_confidence,
          strategy_used: trade.strategy || 'DAYTRADE',
          learned: false,
        }));

        await supabase.from("trade_experiences").insert(newExperiences);
      }

      // Get ALL unlearned experiences (including just-imported ones)
      const { data: unlearnedExperiences, error: expError } = await supabase
        .from("trade_experiences")
        .select("*")
        .eq("user_id", user.id)
        .eq("learned", false)
        .order("created_at", { ascending: true })
        .limit(100); // Increased limit for batch processing

      if (expError) throw expError;

      const experiencesToProcess = unlearnedExperiences || [];

      if (experiencesToProcess.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: "Nenhuma experiência nova para aprender",
          state: neuralState,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Train on experiences
      const currentState: NeuralState = {
        accuracy: Number(neuralState.accuracy),
        win_rate: Number(neuralState.win_rate),
        loss_value: Number(neuralState.loss_value),
        total_epochs: neuralState.total_epochs,
        strategy_weights: neuralState.strategy_weights as Record<string, number>,
        factor_weights: neuralState.factor_weights as Record<string, number>,
        symbol_performance: neuralState.symbol_performance as Record<string, any>,
      };

      const { newState, weightUpdates } = trainOnExperiences(
        experiencesToProcess,
        currentState,
        learningRate
      );

      // Update neural state
      const { error: updateError } = await supabase
        .from("neural_network_state")
        .update({
          accuracy: newState.accuracy,
          win_rate: newState.win_rate,
          loss_value: newState.loss_value,
          total_epochs: newState.total_epochs,
          strategy_weights: newState.strategy_weights,
          factor_weights: newState.factor_weights,
          symbol_performance: newState.symbol_performance,
          last_trained_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Mark experiences as learned
      if (unlearnedExperiences && unlearnedExperiences.length > 0) {
        const expIds = unlearnedExperiences.map((e: any) => e.id);
        await supabase
          .from("trade_experiences")
          .update({ learned: true })
          .in("id", expIds);
      }

      // Record training epoch
      const { error: epochError } = await supabase
        .from("neural_training_epochs")
        .insert({
          user_id: user.id,
          epoch_number: newState.total_epochs,
          accuracy_before: currentState.accuracy,
          loss_before: currentState.loss_value,
          accuracy_after: newState.accuracy,
          loss_after: newState.loss_value,
          trades_processed: experiencesToProcess.length,
          learning_rate: learningRate,
          weight_updates: weightUpdates,
          accuracy_improvement: newState.accuracy - currentState.accuracy,
        });

      if (epochError) console.error("Epoch save error:", epochError);

      return new Response(JSON.stringify({
        success: true,
        epochCompleted: newState.total_epochs,
        tradesProcessed: experiencesToProcess.length,
        accuracy: newState.accuracy,
        winRate: newState.win_rate,
        loss: newState.loss_value,
        weightUpdates,
        improvement: {
          accuracy: newState.accuracy - currentState.accuracy,
          winRate: newState.win_rate - currentState.win_rate,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "getState") {
      const { data: state, error } = await supabase
        .from("neural_network_state")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      return new Response(JSON.stringify({
        success: true,
        state: state || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "getHistory") {
      const { data: history, error } = await supabase
        .from("neural_training_epochs")
        .select("*")
        .eq("user_id", user.id)
        .order("epoch_number", { ascending: true })
        .limit(100);

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        history: history || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analyzeWithMemory") {
      // Get neural state for AI-enhanced analysis
      const { data: state } = await supabase
        .from("neural_network_state")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { marketData, symbol } = await req.json();

      // Build context from learned patterns
      const symbolPerf = state?.symbol_performance?.[symbol] || { wins: 0, losses: 0, pnl: 0 };
      const strategyWeights = state?.strategy_weights || {};
      const factorWeights = state?.factor_weights || {};

      const systemPrompt = `Você é uma rede neural de trading que aprendeu com ${state?.total_epochs || 0} épocas de treinamento.

SUA MEMÓRIA DE APRENDIZADO:
- Precisão atual: ${state?.accuracy?.toFixed(1) || 50}%
- Win Rate: ${state?.win_rate?.toFixed(1) || 50}%
- Loss Value: ${state?.loss_value?.toFixed(4) || 1.0}

PESOS DE ESTRATÉGIA (aprendidos):
${Object.entries(strategyWeights).map(([k, v]) => `- ${k}: ${((v as number) * 100).toFixed(1)}%`).join('\n')}

PESOS DE FATORES (aprendidos):
${Object.entries(factorWeights).map(([k, v]) => `- ${k}: ${((v as number) * 100).toFixed(1)}%`).join('\n')}

PERFORMANCE NO SÍMBOLO ${symbol}:
- Vitórias: ${symbolPerf.wins}
- Derrotas: ${symbolPerf.losses}
- P&L Total: $${symbolPerf.pnl?.toFixed(2) || 0}

Use seus pesos aprendidos para fazer análise. Dê mais peso aos fatores que têm peso maior na sua memória.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { 
              role: "user", 
              content: `Analise ${symbol} com base na sua memória neural e dados: ${JSON.stringify(marketData)}. Responda em JSON: { "recommendation": "BUY/SELL/HOLD", "confidence": 0-100, "reasoning": "...", "strategyToUse": "SCALP/DAYTRADE/SWING" }` 
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiResult = await response.json();
      const content = aiResult.choices?.[0]?.message?.content || "{}";

      // Parse AI response
      let analysis;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { recommendation: "HOLD", confidence: 50 };
      } catch {
        analysis = { recommendation: "HOLD", confidence: 50, reasoning: content };
      }

      // Adjust confidence based on learned performance
      if (symbolPerf.wins > 0 || symbolPerf.losses > 0) {
        const historicalWinRate = symbolPerf.wins / (symbolPerf.wins + symbolPerf.losses);
        analysis.confidence = Math.round(analysis.confidence * 0.7 + historicalWinRate * 100 * 0.3);
      }

      return new Response(JSON.stringify({
        success: true,
        analysis,
        neuralContext: {
          epochs: state?.total_epochs || 0,
          accuracy: state?.accuracy || 50,
          symbolHistory: symbolPerf,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Neural training error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Erro interno",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
