
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

        // 1. Get Auth User (Optional, but recommended to track uploaded_by if logged in)
        // If guest, uploaded_by might be null or a generic guest ID if supported
        // For this implementation, we assume the user IS authenticated via App (Anonymous or Real)
        // But we use SERVICE_ROLE to bypass RLS for the INSERT into the restricted bucket/table if needed
        // However, best practice is to require Auth.

        // Parse FormData
        const formData = await req.formData();
        const file = formData.get('file');
        const companyId = formData.get('company_id');
        const userId = formData.get('user_id'); // Or extract from Auth Token

        if (!file || !companyId) {
            return new Response(JSON.stringify({ error: "Missing file or company_id" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const fileName = `${companyId}/${crypto.randomUUID()}_${file.name}`;

        // 2. Upload to Storage
        const { data: storageData, error: storageError } = await supabase
            .storage
            .from('centro-copiado-archivos')
            .upload(fileName, file, {
                contentType: file.type,
                upsert: false
            });

        if (storageError) throw storageError;

        // 3. Insert into Database Table (Orphaned File)
        const { data: dbData, error: dbError } = await supabase
            .from('centro_copiado_ordenes_archivos')
            .insert({
                company_id: companyId,
                nombre_archivo: file.name,
                nombre_storage: fileName,
                tipo_mime: file.type,
                tamano_bytes: file.size,
                storage_path: storageData.path,
                uploaded_by: userId || null, // Nullable if guest
                // orden_copiado_id is NULL initially
            })
            .select('id')
            .single();

        if (dbError) {
            // Cleanup storage if DB fails
            await supabase.storage.from('centro-copiado-archivos').remove([fileName]);
            throw dbError;
        }

        return new Response(JSON.stringify({
            success: true,
            file_id: dbData.id
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
