import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schemas
const MarketDataSchema = z.object({
  symbol: z.string().min(1).max(20).regex(/^[A-Za-z0-9]+$/, "Symbol must be alphanumeric"),
  price: z.number().positive(),
  change24h: z.number(),
  volume24h: z.number().nonnegative(),
  // Some market feeds may not provide high/low immediately; we fall back to current price
  high24h: z.number().positive().optional(),
  low24h: z.number().positive().optional(),
  rsi: z.number().min(0).max(100).optional(),
  macd: z
    .object({
      value: z.number(),
      signal: z.number(),
      histogram: z.number(),
    })
    .optional(),
  sentiment: z.string().max(200).optional(),
  news: z.array(z.string().max(500)).max(10).optional(),
});

const RequestSchema = z.object({
  marketData: MarketDataSchema,
  analysisType: z.enum(["full", "quick", "signals"]).optional().default("full")
});

type MarketData = z.infer<typeof MarketDataSchema>;

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
    
    if (userError) {
      console.error("Auth error:", userError.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!user) {
      console.error("No user found for token");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Market analysis requested by user: ${user.id}`);

    // Validate request body with zod
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

    const { marketData, analysisType } = validation.data;

    // Sanitize text fields to prevent prompt injection
    const sanitizedMarketData: MarketData = {
      ...marketData,
      symbol: marketData.symbol.toUpperCase().replace(/[^A-Z0-9]/g, ''),
      high24h: typeof marketData.high24h === 'number' && marketData.high24h > 0 ? marketData.high24h : marketData.price,
      low24h: typeof marketData.low24h === 'number' && marketData.low24h > 0 ? marketData.low24h : marketData.price,
      sentiment: marketData.sentiment?.replace(/[<>{}[\]\\]/g, '').slice(0, 200),
      news: marketData.news?.map((headline) => headline.replace(/[<>{}[\]\\]/g, '').slice(0, 500)),
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert cryptocurrency and trading analyst AI. Analyze market data and provide actionable trading insights.

Your analysis should be:
- Data-driven and objective
- Include specific price levels for entries, stop-losses, and take-profits
- Consider technical indicators when provided
- Factor in market sentiment and news when available
- Provide a confidence score (0-100) for your recommendations

Always respond in JSON format with the following structure:
{
  "recommendation": "BUY" | "SELL" | "HOLD" | "WAIT",
  "confidence": number (0-100),
  "reasoning": "string explaining the analysis",
  "entryPrice": number or null,
  "stopLoss": number or null,
  "takeProfit": number or null,
  "riskRewardRatio": number or null,
  "keyLevels": {
    "support": [numbers],
    "resistance": [numbers]
  },
  "signals": {
    "bullish": ["list of bullish signals"],
    "bearish": ["list of bearish signals"]
  },
  "timeframe": "short" | "medium" | "long",
  "marketCondition": "bullish" | "bearish" | "neutral" | "volatile"
}`;

    const userPrompt = buildUserPrompt(sanitizedMarketData, analysisType);

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
        temperature: 0.3,
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

    // Parse the JSON response from the AI
    let analysis;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Return a structured error with the raw content
      analysis = {
        recommendation: "HOLD",
        confidence: 0,
        reasoning: content,
        error: "Failed to parse structured response"
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        symbol: sanitizedMarketData.symbol,
        timestamp: new Date().toISOString(),
        analysis,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Market analysis error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildUserPrompt(data: MarketData, analysisType: string): string {
  let prompt = `Analyze the following market data for ${data.symbol}:\n\n`;
  
  prompt += `**Current Price:** $${data.price.toLocaleString()}\n`;
  prompt += `**24h Change:** ${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%\n`;
  prompt += `**24h Volume:** $${data.volume24h.toLocaleString()}\n`;
  const high24h = (typeof data.high24h === 'number' ? data.high24h : data.price);
  const low24h = (typeof data.low24h === 'number' ? data.low24h : data.price);
  prompt += `**24h High:** $${high24h.toLocaleString()}\n`;
  prompt += `**24h Low:** $${low24h.toLocaleString()}\n`;

  if (data.rsi !== undefined) {
    prompt += `**RSI (14):** ${data.rsi.toFixed(2)}\n`;
  }

  if (data.macd) {
    prompt += `**MACD:** Value: ${data.macd.value.toFixed(4)}, Signal: ${data.macd.signal.toFixed(4)}, Histogram: ${data.macd.histogram.toFixed(4)}\n`;
  }

  if (data.sentiment) {
    prompt += `**Market Sentiment:** ${data.sentiment}\n`;
  }

  if (data.news && data.news.length > 0) {
    prompt += `\n**Recent News Headlines:**\n`;
    data.news.forEach((headline, i) => {
      prompt += `${i + 1}. ${headline}\n`;
    });
  }

  prompt += `\n**Analysis Type:** ${analysisType}\n`;
  
  if (analysisType === "quick") {
    prompt += "\nProvide a quick analysis with just the recommendation, confidence, and brief reasoning.";
  } else if (analysisType === "signals") {
    prompt += "\nFocus on identifying specific trading signals and key price levels.";
  } else {
    prompt += "\nProvide a comprehensive analysis including all fields.";
  }

  return prompt;
}
