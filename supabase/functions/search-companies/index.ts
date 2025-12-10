
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const body = await req.json().catch(() => ({}));
        const query = body.query || "";

        let dbQuery = supabase
            .from("companies")
            .select("id, name, logo_url, status")
            .eq("status", "active") // Restored active check
            .limit(50); // Increased limit to show more

        if (query && query.length > 0) {
            dbQuery = dbQuery.ilike("name", `%${query}%`);
        }

        const { data: companies, error } = await dbQuery;

        if (error) throw error;

        return new Response(JSON.stringify(companies), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
