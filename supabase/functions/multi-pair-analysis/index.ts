import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schemas
const MarketDataSchema = z.object({
  symbol: z.string().min(1).max(20),
  price: z.number().positive(),
  change24h: z.number(),
  volume24h: z.number().nonnegative(),
  high24h: z.number().positive().optional(),
  low24h: z.number().positive().optional(),
  changePercentage24h: z.number().optional(),
});

const RequestSchema = z.object({
  marketData: z.record(z.string(), MarketDataSchema),
  maxResults: z.number().min(1).max(10).optional().default(3),
});

type MarketData = z.infer<typeof MarketDataSchema>;

interface NeuralState {
  accuracy: number;
  win_rate: number;
  loss_value: number;
  total_epochs: number;
  strategy_weights: Record<string, number>;
  factor_weights: Record<string, number>;
  symbol_performance: Record<string, { wins: number; losses: number; pnl: number }>;
}

interface PairAnalysis {
  symbol: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
  confidence: number;
  reasoning: string;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskRewardRatio: number | null;
  score: number;
}

// Calculate neural-adjusted score based on learned weights
function calculateNeuralScore(
  symbol: string,
  baseScore: number,
  baseConfidence: number,
  recommendation: string,
  neuralState: NeuralState | null
): { adjustedScore: number; adjustedConfidence: number; neuralBonus: string[] } {
  if (!neuralState || neuralState.total_epochs === 0) {
    return { adjustedScore: baseScore, adjustedConfidence: baseConfidence, neuralBonus: [] };
  }

  const bonuses: string[] = [];
  let scoreMultiplier = 1.0;
  let confidenceBonus = 0;

  // Check symbol-specific performance
  const symbolPerf = neuralState.symbol_performance?.[symbol];
  if (symbolPerf) {
    const totalTrades = symbolPerf.wins + symbolPerf.losses;
    if (totalTrades >= 3) {
      const winRate = symbolPerf.wins / totalTrades;
      
      if (winRate >= 0.7) {
        scoreMultiplier += 0.15;
        confidenceBonus += 10;
        bonuses.push(`🎯 ${symbol}: ${(winRate * 100).toFixed(0)}% histórico de vitórias`);
      } else if (winRate >= 0.5) {
        scoreMultiplier += 0.05;
        confidenceBonus += 5;
        bonuses.push(`📊 ${symbol}: ${(winRate * 100).toFixed(0)}% win rate aprendido`);
      } else if (winRate < 0.4) {
        scoreMultiplier -= 0.1;
        confidenceBonus -= 10;
        bonuses.push(`⚠️ ${symbol}: histórico de ${(winRate * 100).toFixed(0)}% - cautela`);
      }

      // P&L history bonus
      if (symbolPerf.pnl > 0) {
        scoreMultiplier += 0.05;
        bonuses.push(`💰 ${symbol}: +$${symbolPerf.pnl.toFixed(2)} histórico`);
      }
    }
  }

  // Apply factor weights from neural learning
  const factorWeights = neuralState.factor_weights || {};
  
  // Momentum weight (if learned as important)
  if ((factorWeights['momentum'] || 0) > 0.25) {
    scoreMultiplier += 0.05;
    bonuses.push(`📈 Momentum: peso ${((factorWeights['momentum'] as number) * 100).toFixed(0)}%`);
  }

  // Volume weight (if learned as important)
  if ((factorWeights['volume'] || 0) > 0.25) {
    scoreMultiplier += 0.05;
    bonuses.push(`📊 Volume: peso ${((factorWeights['volume'] as number) * 100).toFixed(0)}%`);
  }

  // Apply neural accuracy as confidence modifier
  if (neuralState.accuracy > 70) {
    confidenceBonus += Math.min(15, (neuralState.accuracy - 70) * 0.5);
    bonuses.push(`🧠 Rede neural: ${neuralState.accuracy.toFixed(1)}% precisão`);
  }

  // Cap adjustments
  const adjustedScore = Math.min(100, Math.max(0, baseScore * scoreMultiplier));
  const adjustedConfidence = Math.min(95, Math.max(10, baseConfidence + confidenceBonus));

  return { adjustedScore, adjustedConfidence, neuralBonus: bonuses };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("No Authorization header found");
      return new Response(
        JSON.stringify({ error: "Unauthorized - No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Auth error:", userError?.message || "No user found");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Multi-pair analysis requested by user: ${user.id}`);

    // Fetch neural network state for this user
    let neuralState: NeuralState | null = null;
    const { data: neuralData, error: neuralError } = await supabase
      .from("neural_network_state")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!neuralError && neuralData) {
      neuralState = {
        accuracy: Number(neuralData.accuracy),
        win_rate: Number(neuralData.win_rate),
        loss_value: Number(neuralData.loss_value),
        total_epochs: neuralData.total_epochs,
        strategy_weights: neuralData.strategy_weights as Record<string, number>,
        factor_weights: neuralData.factor_weights as Record<string, number>,
        symbol_performance: neuralData.symbol_performance as Record<string, any>,
      };
      console.log(`Loaded neural state: ${neuralState.total_epochs} epochs, ${neuralState.accuracy.toFixed(1)}% accuracy`);
    } else {
      console.log("No neural state found for user, using base analysis");
    }

    // Validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = RequestSchema.safeParse(body);
    
    if (!validation.success) {
      console.error("Validation error:", validation.error.format());
      return new Response(
        JSON.stringify({ error: "Invalid input data", details: validation.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { marketData, maxResults } = validation.data;
    const symbols = Object.keys(marketData);
    
    if (symbols.length === 0) {
      return new Response(
        JSON.stringify({ error: "No market data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing ${symbols.length} pairs with neural integration: ${symbols.join(', ')}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build market summary for AI
    const marketSummary = symbols.map(symbol => {
      const data = marketData[symbol];
      const symbolPerf = neuralState?.symbol_performance?.[symbol];
      const perfNote = symbolPerf 
        ? ` [Neural: ${symbolPerf.wins}W/${symbolPerf.losses}L, P&L: $${symbolPerf.pnl?.toFixed(2) || 0}]`
        : '';
      return `${symbol}: $${data.price.toLocaleString()} (${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%, Vol: $${(data.volume24h / 1000000).toFixed(2)}M)${perfNote}`;
    }).join('\n');

    // Build neural context for the AI
    const neuralContext = neuralState ? `
NEURAL NETWORK CONTEXT (${neuralState.total_epochs} epochs of learning):
- Network Accuracy: ${neuralState.accuracy.toFixed(1)}%
- Win Rate: ${neuralState.win_rate.toFixed(1)}%
- Loss Value: ${neuralState.loss_value.toFixed(4)}

LEARNED STRATEGY WEIGHTS (use these to prioritize):
${Object.entries(neuralState.strategy_weights).map(([k, v]) => `- ${k}: ${((v as number) * 100).toFixed(1)}%`).join('\n')}

LEARNED FACTOR WEIGHTS (these factors predicted wins):
${Object.entries(neuralState.factor_weights).map(([k, v]) => `- ${k}: ${((v as number) * 100).toFixed(1)}%`).join('\n')}

SYMBOL-SPECIFIC PERFORMANCE (historical data):
${Object.entries(neuralState.symbol_performance || {}).map(([symbol, perf]: [string, any]) => 
  `- ${symbol}: ${perf.wins}W/${perf.losses}L (${perf.wins + perf.losses > 0 ? ((perf.wins / (perf.wins + perf.losses)) * 100).toFixed(0) : 0}% win rate), P&L: $${perf.pnl?.toFixed(2) || 0}`
).join('\n') || 'No historical data yet'}

USE THIS LEARNED DATA: Give higher scores to symbols with good historical performance and strategies with higher weights.
` : '';

    const systemPrompt = `You are an expert cryptocurrency trading AI with NEURAL NETWORK MEMORY that learns from past trades.

${neuralContext}

Your task is to:
1. Analyze all provided pairs
2. USE YOUR NEURAL MEMORY to boost confidence in symbols that performed well historically
3. Apply learned strategy weights to determine SCALP vs DAYTRADE vs SWING
4. Compare and rank by trading opportunity quality
5. Provide specific entry/exit levels for the top opportunities

Consider these factors (weighted by your neural learning):
- Price action and momentum (${neuralState?.factor_weights?.['momentum'] ? ((neuralState.factor_weights['momentum'] as number) * 100).toFixed(0) + '%' : '20%'} weight)
- Volume relative to price movement (${neuralState?.factor_weights?.['volume'] ? ((neuralState.factor_weights['volume'] as number) * 100).toFixed(0) + '%' : '20%'} weight)
- RSI and trend (${neuralState?.factor_weights?.['rsi'] ? ((neuralState.factor_weights['rsi'] as number) * 100).toFixed(0) + '%' : '20%'} weight)
- Volatility (${neuralState?.factor_weights?.['volatility'] ? ((neuralState.factor_weights['volatility'] as number) * 100).toFixed(0) + '%' : '20%'} weight)
- Historical symbol performance from neural memory

Respond ONLY with valid JSON in this exact format:
{
  "bestOpportunities": [
    {
      "symbol": "SYMBOL",
      "recommendation": "BUY" | "SELL" | "HOLD",
      "confidence": 0-100,
      "score": 0-100,
      "reasoning": "Brief explanation including neural insights",
      "entryPrice": number,
      "stopLoss": number,
      "takeProfit": number,
      "riskRewardRatio": number,
      "suggestedStrategy": "SCALP" | "DAYTRADE" | "SWING"
    }
  ],
  "marketOverview": "Brief market sentiment summary",
  "topPick": {
    "symbol": "BEST_SYMBOL",
    "action": "BUY" | "SELL",
    "urgency": "high" | "medium" | "low"
  },
  "neuralInsights": "What the neural network learned that influenced this analysis"
}

Return at most ${maxResults} opportunities, sorted by score (highest first).
Only include pairs with score >= 60 and clear BUY or SELL signals.
BOOST scores for symbols with positive historical P&L in neural memory.`;

    const userPrompt = `Analyze these cryptocurrency pairs using your NEURAL MEMORY and find the best trading opportunities RIGHT NOW:

${marketSummary}

Current timestamp: ${new Date().toISOString()}

Identify the best entries considering:
1. Your learned performance on each symbol
2. Which pairs have the strongest directional momentum?
3. Which have the best risk/reward setups?
4. Your learned strategy weights (${neuralState ? `SCALP: ${((neuralState.strategy_weights?.['SCALP'] || 0.33) * 100).toFixed(0)}%, DAYTRADE: ${((neuralState.strategy_weights?.['DAYTRADE'] || 0.34) * 100).toFixed(0)}%, SWING: ${((neuralState.strategy_weights?.['SWING'] || 0.33) * 100).toFixed(0)}%` : 'equal weights'})

Return your analysis with specific price levels for entries, stops, and targets.
Mention any neural insights that influenced your decisions.`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    console.log("AI Response received, parsing and applying neural adjustments...");

    // Parse the JSON response from the AI
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      analysis = {
        bestOpportunities: [],
        marketOverview: "Analysis parsing failed",
        topPick: null,
        neuralInsights: null,
        error: "Failed to parse structured response"
      };
    }

    // Apply neural score adjustments to opportunities
    const allNeuralBonuses: string[] = [];
    if (analysis.bestOpportunities && Array.isArray(analysis.bestOpportunities)) {
      analysis.bestOpportunities = analysis.bestOpportunities.map((opp: any) => {
        const { adjustedScore, adjustedConfidence, neuralBonus } = calculateNeuralScore(
          opp.symbol,
          opp.score || 50,
          opp.confidence || 50,
          opp.recommendation,
          neuralState
        );
        
        allNeuralBonuses.push(...neuralBonus);

        return {
          ...opp,
          score: Math.round(adjustedScore),
          confidence: Math.round(adjustedConfidence),
          neuralAdjusted: neuralState?.total_epochs ? true : false,
          originalScore: opp.score,
          originalConfidence: opp.confidence,
        };
      });

      // Re-sort by adjusted score
      analysis.bestOpportunities.sort((a: any, b: any) => b.score - a.score);
    }

    console.log(`Analysis complete with neural adjustments. Found ${analysis.bestOpportunities?.length || 0} opportunities`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        pairsAnalyzed: symbols.length,
        neuralEnabled: !!neuralState,
        neuralEpochs: neuralState?.total_epochs || 0,
        neuralAccuracy: neuralState?.accuracy || null,
        neuralBonuses: allNeuralBonuses,
        ...analysis,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Multi-pair analysis error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});