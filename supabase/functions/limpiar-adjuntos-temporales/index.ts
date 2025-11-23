import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar adjuntos temporales con más de 24 horas
    const fechaLimite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Obtener archivos de cliente temporales antiguos
    const { data: archivosCliente } = await supabase
      .from('ordenes_trabajo_archivos')
      .select('id, storage_path, company_id')
      .not('orden_temporal_id', 'is', null)
      .lt('temporal_creado_en', fechaLimite);

    let archivosClienteEliminados = 0;
    if (archivosCliente && archivosCliente.length > 0) {
      // Eliminar de storage
      const pathsCliente = archivosCliente.map(a => a.storage_path);
      await supabase.storage.from('orden-trabajo-archivos').remove(pathsCliente);

      // Eliminar de BD
      const idsCliente = archivosCliente.map(a => a.id);
      await supabase
        .from('ordenes_trabajo_archivos')
        .delete()
        .in('id', idsCliente);

      archivosClienteEliminados = archivosCliente.length;
    }

    // Obtener archivos de producción temporales antiguos
    const { data: archivosProduccion } = await supabase
      .from('ordenes_trabajo_archivos_produccion')
      .select('id, storage_path, company_id')
      .not('orden_temporal_id', 'is', null)
      .lt('temporal_creado_en', fechaLimite);

    let archivosProduccionEliminados = 0;
    if (archivosProduccion && archivosProduccion.length > 0) {
      // Eliminar de storage
      const pathsProduccion = archivosProduccion.map(a => a.storage_path);
      await supabase.storage.from('orden-produccion-archivos').remove(pathsProduccion);

      // Eliminar de BD
      const idsProduccion = archivosProduccion.map(a => a.id);
      await supabase
        .from('ordenes_trabajo_archivos_produccion')
        .delete()
        .in('id', idsProduccion);

      archivosProduccionEliminados = archivosProduccion.length;
    }

    // Eliminar links temporales antiguos
    const { data: links } = await supabase
      .from('ordenes_trabajo_links')
      .select('id')
      .not('orden_temporal_id', 'is', null)
      .lt('temporal_creado_en', fechaLimite);

    let linksEliminados = 0;
    if (links && links.length > 0) {
      const idsLinks = links.map(l => l.id);
      await supabase
        .from('ordenes_trabajo_links')
        .delete()
        .in('id', idsLinks);

      linksEliminados = links.length;
    }

    const result = {
      success: true,
      fechaLimite,
      eliminados: {
        archivosCliente: archivosClienteEliminados,
        archivosProduccion: archivosProduccionEliminados,
        links: linksEliminados,
        total: archivosClienteEliminados + archivosProduccionEliminados + linksEliminados
      },
      timestamp: new Date().toISOString()
    };

    console.log('Limpieza completada:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error: any) {
    console.error('Error en limpieza:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});
