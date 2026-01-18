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

interface PairAnalysis {
  symbol: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'WAIT';
  confidence: number;
  reasoning: string;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskRewardRatio: number | null;
  score: number; // Overall trading score
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Auth error:", userError?.message || "No user found");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Multi-pair analysis requested by user: ${user.id}`);

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

    console.log(`Analyzing ${symbols.length} pairs: ${symbols.join(', ')}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build market summary for AI
    const marketSummary = symbols.map(symbol => {
      const data = marketData[symbol];
      return `${symbol}: $${data.price.toLocaleString()} (${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%, Vol: $${(data.volume24h / 1000000).toFixed(2)}M)`;
    }).join('\n');

    const systemPrompt = `You are an expert cryptocurrency trading AI that analyzes multiple trading pairs simultaneously to find the BEST trading opportunities.

Your task is to:
1. Analyze all provided pairs
2. Compare them against each other
3. Rank them by trading opportunity quality
4. Provide specific entry/exit levels for the top opportunities

Consider these factors when scoring:
- Price action and momentum (24h change)
- Volume relative to price movement
- Risk/reward potential
- Current price position within daily range

Respond ONLY with valid JSON in this exact format:
{
  "bestOpportunities": [
    {
      "symbol": "SYMBOL",
      "recommendation": "BUY" | "SELL" | "HOLD",
      "confidence": 0-100,
      "score": 0-100,
      "reasoning": "Brief explanation",
      "entryPrice": number,
      "stopLoss": number,
      "takeProfit": number,
      "riskRewardRatio": number
    }
  ],
  "marketOverview": "Brief market sentiment summary",
  "topPick": {
    "symbol": "BEST_SYMBOL",
    "action": "BUY" | "SELL",
    "urgency": "high" | "medium" | "low"
  }
}

Return at most ${maxResults} opportunities, sorted by score (highest first).
Only include pairs with score >= 60 and clear BUY or SELL signals.`;

    const userPrompt = `Analyze these cryptocurrency pairs and find the best trading opportunities RIGHT NOW:

${marketSummary}

Current timestamp: ${new Date().toISOString()}

Identify the best entries considering:
1. Which pairs have the strongest directional momentum?
2. Which have the best risk/reward setups?
3. Which are at key support/resistance levels?

Return your analysis with specific price levels for entries, stops, and targets.`;

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

    console.log("AI Response received, parsing...");

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
        error: "Failed to parse structured response"
      };
    }

    console.log(`Analysis complete. Found ${analysis.bestOpportunities?.length || 0} opportunities`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        pairsAnalyzed: symbols.length,
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
