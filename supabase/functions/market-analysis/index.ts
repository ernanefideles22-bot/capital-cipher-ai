import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  rsi?: number;
  macd?: { value: number; signal: number; histogram: number };
  sentiment?: string;
  news?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Market analysis requested by user: ${user.id}`);

    const { marketData, analysisType = "full" } = await req.json() as { 
      marketData: MarketData; 
      analysisType?: "full" | "quick" | "signals" 
    };

    if (!marketData || !marketData.symbol) {
      return new Response(
        JSON.stringify({ error: "Market data with symbol is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const userPrompt = buildUserPrompt(marketData, analysisType);

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
        symbol: marketData.symbol,
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
  prompt += `**24h High:** $${data.high24h.toLocaleString()}\n`;
  prompt += `**24h Low:** $${data.low24h.toLocaleString()}\n`;

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
