import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ReciboInfo {
  recibo_id: string;
  pdf_storage_path: string;
  numero_recibo: number;
  orden_numero: string | null;
  monto: number;
  fecha_pago: string;
  is_valid: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Método no permitido. Use GET.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    const token = url.searchParams.get('token');

    if (!companyId || !token) {
      return new Response(JSON.stringify({ success: false, error: 'Parámetros requeridos: companyId y token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.rpc('fn_obtener_recibo_por_token', {
      p_company_id: companyId,
      p_token: token,
    });

    if (error) {
      console.error('[redirect-recibo] RPC error:', error);
      return new Response(JSON.stringify({ success: false, error: 'Error al buscar el recibo' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Link de recibo no encontrado o inválido' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recibo: ReciboInfo = data[0];

    if (!recibo.is_valid || !recibo.pdf_storage_path) {
      return new Response(JSON.stringify({ success: false, error: 'Recibo aún no disponible' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from('recibos')
      .createSignedUrl(recibo.pdf_storage_path, 3600);

    if (urlError) {
      console.error('[redirect-recibo] Signed URL error:', urlError);
      return new Response(JSON.stringify({ success: false, error: 'Error al generar el link de descarga' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl: urlData.signedUrl,
        numero_recibo: recibo.numero_recibo,
        orden_numero: recibo.orden_numero,
        monto: recibo.monto,
        fecha_pago: recibo.fecha_pago,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[redirect-recibo] Error:', err);
    return new Response(JSON.stringify({ success: false, error: err?.message ?? 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

