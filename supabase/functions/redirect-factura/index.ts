import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface FacturaInfo {
  factura_storage_path: string;
  numero_factura: string;
  orden_numero: string;
  expires_at: string;
  is_valid: boolean;
}

Deno.serve(async (req: Request) => {
  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Solo aceptar GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido. Use GET.' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Obtener parámetros de la URL
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId');
    const token = url.searchParams.get('token');

    console.log('[RedirectFactura] Solicitud recibida:', {
      companyId,
      token
    });

    // Validar parámetros
    if (!companyId || !token) {
      console.log('[RedirectFactura] ❌ Parámetros faltantes');
      return new Response(
        JSON.stringify({
          error: 'Parámetros requeridos: companyId y token',
          success: false
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Inicializar cliente Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar factura por token
    console.log('[RedirectFactura] Buscando factura en BD...');
    
    const { data: facturaData, error: dbError } = await supabase.rpc(
      'fn_obtener_factura_por_token',
      {
        p_company_id: companyId,
        p_token: token
      }
    );

    if (dbError) {
      console.error('[RedirectFactura] ❌ Error de base de datos:', dbError);
      return new Response(
        JSON.stringify({
          error: 'Error al buscar la factura',
          success: false
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validar que exista el registro
    if (!facturaData || facturaData.length === 0) {
      console.log('[RedirectFactura] ❌ Token no encontrado');
      return new Response(
        JSON.stringify({
          error: 'Link de factura no encontrado o inválido',
          success: false
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const factura: FacturaInfo = facturaData[0];

    console.log('[RedirectFactura] Factura encontrada:', {
      numero_factura: factura.numero_factura,
      orden_numero: factura.orden_numero,
      is_valid: factura.is_valid
    });

    // Validar que no esté expirado
    if (!factura.is_valid) {
      console.log('[RedirectFactura] ❌ Link expirado');
      return new Response(
        JSON.stringify({
          error: 'Este link ha expirado',
          success: false,
          expires_at: factura.expires_at
        }),
        {
          status: 410,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generar signed URL temporal (1 hora)
    console.log('[RedirectFactura] Generando signed URL temporal...');
    
    const { data: urlData, error: urlError } = await supabase.storage
      .from('facturas')
      .createSignedUrl(factura.factura_storage_path, 3600); // 1 hora

    if (urlError) {
      console.error('[RedirectFactura] ❌ Error generando URL:', urlError);
      return new Response(
        JSON.stringify({
          error: 'Error al generar el link de descarga',
          success: false
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[RedirectFactura] ✅ URL generada exitosamente');

    // Retornar la URL firmada
    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl: urlData.signedUrl,
        numero_factura: factura.numero_factura,
        orden_numero: factura.orden_numero
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[RedirectFactura] ❌ Error general:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Error interno del servidor',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});