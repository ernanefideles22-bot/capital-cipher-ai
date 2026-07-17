import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const frozenResponse = {
  success: false,
  code: "LEGACY_TRADING_FROZEN",
  error: "The legacy trading-ai function is permanently disabled. Use capital-cipher-platform in PAPER mode.",
};

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.warn("Blocked request to frozen legacy trading-ai function");
  return new Response(JSON.stringify(frozenResponse), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
