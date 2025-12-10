
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

        const url = new URL(req.url);
        const companyId = url.searchParams.get("id");

        if (!companyId) {
            return new Response(JSON.stringify({ error: "Missing company id" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Parallel fetch for catalog data
        const [papers, sizes, finishes, prices] = await Promise.all([
            supabase.from("centro_copiado_papeles")
                .select("id, material_id, variante_nombre, espesor").eq("company_id", companyId).eq("is_active", true),

            supabase.from("centro_copiado_tamanios_papel")
                .select("id, nombre, ancho_mm, alto_mm").eq("company_id", companyId).eq("is_active", true),

            supabase.from("centro_copiado_plastificados") // Example finish
                .select("id, tipo, precio").eq("company_id", companyId).eq("is_active", true),

            supabase.from("centro_copiado_precios_impresion")
                .select("id, tamanio_papel_id, papel_id, tipo_tinta, rango_precio_id, cara_impresa, precio")
                .eq("company_id", companyId)
        ]);

        return new Response(JSON.stringify({
            papers: papers.data,
            sizes: sizes.data,
            finishes: finishes.data,
            prices: prices.data // Optional, if the app needs to calculate price locally
        }), {
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
