import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const frozenResponse = {
  retCode: -9001,
  code: "LEGACY_EXCHANGE_ACCESS_FROZEN",
  error: "Private exchange access is disabled in the legacy application. Use capital-cipher-platform in PAPER mode.",
};

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.warn("Blocked request to frozen legacy bybit-api function");
  return new Response(JSON.stringify(frozenResponse), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
