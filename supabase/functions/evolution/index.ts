import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EvolutionConfig {
  id: string;
  company_id: string;
  base_url: string;
  instance_id: string;
  api_key: string;
  connection_state: string;
  last_connected_at: string | null;
}

// Obtener company_id del usuario autenticado
async function getCompanyId(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('Error getting company_id:', error);
    return null;
  }

  return data.company_id;
}

// Obtener configuración de Evolution para la empresa
async function getEvolutionConfig(supabase: any, companyId: string): Promise<EvolutionConfig | null> {
  const { data, error } = await supabase
    .from('evolution_integrations')
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

// Hacer request a Evolution API
async function makeEvolutionRequest(url: string, apiKey: string, method: string = 'GET'): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Evolution API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

Deno.serve(async (req: Request) => {
  // Manejar OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener usuario autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Obtener company_id del usuario
    const companyId = await getCompanyId(supabase, user.id);
    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'No se pudo obtener la empresa del usuario' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parsear URL y método
    const url = new URL(req.url);
    const path = url.pathname.replace('/evolution', '');
    const method = req.method;

    console.log(`[Evolution API] ${method} ${path} - Company: ${companyId}`);

    // ============================================
    // GET /config - Obtener configuración
    // ============================================
    if (method === 'GET' && path === '/config') {
      const config = await getEvolutionConfig(supabase, companyId);

      if (!config) {
        return new Response(
          JSON.stringify({ hasConfig: false }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Retornar config sin api_key
      return new Response(
        JSON.stringify({
          hasConfig: true,
          instanceId: config.instance_id,
          baseUrl: config.base_url,
          hasApiKey: !!config.api_key,
          connectionState: config.connection_state,
          lastConnectedAt: config.last_connected_at,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ============================================
    // POST /config - Guardar/actualizar configuración
    // ============================================
    if (method === 'POST' && path === '/config') {
      const body = await req.json();
      const { instanceId, apiKey, baseUrl } = body;

      if (!instanceId) {
        return new Response(
          JSON.stringify({ error: 'Instance ID es requerido' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Verificar si ya existe configuración
      const existingConfig = await getEvolutionConfig(supabase, companyId);

      let result;

      if (existingConfig) {
        // UPDATE
        const updateData: any = {
          instance_id: instanceId,
          updated_at: new Date().toISOString(),
        };

        if (baseUrl) updateData.base_url = baseUrl;
        if (apiKey) updateData.api_key = apiKey;

        const { data, error } = await supabase
          .from('evolution_integrations')
          .update(updateData)
          .eq('company_id', companyId)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // INSERT
        const { data, error } = await supabase
          .from('evolution_integrations')
          .insert({
            company_id: companyId,
            instance_id: instanceId,
            api_key: apiKey || '',
            base_url: baseUrl || 'https://api.evoapicloud.com',
            connection_state: 'disconnected',
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      return new Response(
        JSON.stringify({
          instanceId: result.instance_id,
          baseUrl: result.base_url,
          hasApiKey: !!result.api_key,
          connectionState: result.connection_state,
          lastConnectedAt: result.last_connected_at,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // ============================================
    // POST /connect - Generar QR
    // ============================================
    if (method === 'POST' && path === '/connect') {
      const config = await getEvolutionConfig(supabase, companyId);

      if (!config) {
        return new Response(
          JSON.stringify({ error: 'No hay configuración. Primero configura tu integración.' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      if (!config.api_key) {
        return new Response(
          JSON.stringify({ error: 'API Key no configurada' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      try {
        // Llamar a Evolution API para obtener QR
        const evolutionUrl = `${config.base_url}/instance/connect/${config.instance_id}`;
        const qrData = await makeEvolutionRequest(evolutionUrl, config.api_key, 'GET');

        // Actualizar estado a "connecting"
        await supabase
          .from('evolution_integrations')
          .update({
            connection_state: 'connecting',
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId);

        return new Response(
          JSON.stringify({
            base64: qrData.base64,
            pairingCode: qrData.pairingCode || null,
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      } catch (error: any) {
        console.error('Error calling Evolution API:', error);
        
        // Actualizar estado a "error"
        await supabase
          .from('evolution_integrations')
          .update({
            connection_state: 'error',
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId);

        let errorMessage = 'Error conectando con Evolution API';
        if (error.message.includes('401')) {
          errorMessage = 'API Key inválida';
        } else if (error.message.includes('404')) {
          errorMessage = 'Instancia no encontrada';
        }

        return new Response(
          JSON.stringify({ error: errorMessage }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // ============================================
    // GET /connection-state - Verificar estado de conexión
    // ============================================
    if (method === 'GET' && path === '/connection-state') {
      const config = await getEvolutionConfig(supabase, companyId);

      if (!config) {
        return new Response(
          JSON.stringify({ error: 'No hay configuración' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      try {
        // Llamar a Evolution API para verificar estado
        const evolutionUrl = `${config.base_url}/instance/connectionState/${config.instance_id}`;
        const stateData = await makeEvolutionRequest(evolutionUrl, config.api_key, 'GET');

        const state = stateData.instance?.state || 'disconnected';

        // Si está conectado, actualizar BD
        if (state === 'open') {
          await supabase
            .from('evolution_integrations')
            .update({
              connection_state: 'open',
              last_connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('company_id', companyId);
        }

        return new Response(
          JSON.stringify({ state }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      } catch (error: any) {
        console.error('Error checking connection state:', error);
        return new Response(
          JSON.stringify({ state: 'error' }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Endpoint no encontrado
    return new Response(
      JSON.stringify({ error: 'Endpoint no encontrado' }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error general:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
