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
  console.log(`[Evolution API] ${method} ${url}`);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'apikey': apiKey,
      },
    });

    // Log status y headers
    console.log(`[Evolution API] Response status: ${response.status}`);
    console.log(`[Evolution API] Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Evolution API] Error ${response.status}: ${errorText}`);
      throw new Error(`Evolution API error (${response.status}): ${errorText}`);
    }

    // Leer el body UNA SOLA VEZ
    const text = await response.text();
    console.log(`[Evolution API] Response body:`, text);

    // Verificar que no esté vacío
    if (!text || text.trim() === '') {
      console.error(`[Evolution API] ⚠️ Empty response received`);
      throw new Error('Evolution API returned empty response');
    }

    // Intentar parsear JSON
    try {
      const data = JSON.parse(text);
      console.log(`[Evolution API] ✅ Parsed data:`, JSON.stringify(data));
      return data;
    } catch (parseError: any) {
      console.error(`[Evolution API] ❌ JSON parse error:`, parseError.message);
      console.error(`[Evolution API] Response text:`, text.substring(0, 500));
      throw new Error(`Invalid JSON from Evolution API: ${parseError.message}`);
    }
  } catch (error: any) {
    // Capturar errores de red
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error(`[Evolution API] Network error: ${error.message}`);
      throw new Error(`Network error: No se pudo conectar con Evolution API en ${url}`);
    }
    throw error;
  }
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

      // Validar configuración antes de llamar a Evolution API
      if (!config.base_url.startsWith('http')) {
        return new Response(
          JSON.stringify({ error: 'URL base inválida. Debe comenzar con http:// o https://' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (!config.instance_id || config.instance_id.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'Instance ID vacío' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      try {
        // Llamar a Evolution API para obtener QR
        const evolutionUrl = `${config.base_url}/instance/connect/${config.instance_id}`;
        console.log(`[Connect] Requesting QR for instance: ${config.instance_id}`);
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
        console.error('Config used:', {
          base_url: config.base_url,
          instance_id: config.instance_id,
          has_api_key: !!config.api_key
        });

        // Actualizar estado a "error"
        await supabase
          .from('evolution_integrations')
          .update({
            connection_state: 'error',
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId);

        let errorMessage = 'Error conectando con Evolution API';
        let statusCode = 500;

        if (error.message.includes('Network error')) {
          errorMessage = 'No se pudo conectar con Evolution API. Verifica la URL base.';
          statusCode = 503;
        } else if (error.message.includes('401')) {
          errorMessage = 'API Key inválida. Verifica tu configuración.';
          statusCode = 401;
        } else if (error.message.includes('404')) {
          errorMessage = 'Instancia no encontrada. Verifica tu Instance ID.';
          statusCode = 404;
        } else if (error.message.includes('500')) {
          errorMessage = 'Error interno de Evolution API. Intenta de nuevo más tarde.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Timeout conectando con Evolution API. Intenta de nuevo.';
          statusCode = 504;
        }

        return new Response(
          JSON.stringify({
            error: errorMessage,
            details: error.message
          }),
          {
            status: statusCode,
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
          JSON.stringify({ state: 'error', errorType: 'config', errorMessage: 'No hay configuración' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Validar configuración antes de llamar
      if (!config.api_key || config.api_key.trim() === '') {
        return new Response(
          JSON.stringify({ state: 'error', errorType: 'critical', errorMessage: 'API Key no configurada' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      if (!config.instance_id || config.instance_id.trim() === '') {
        return new Response(
          JSON.stringify({ state: 'error', errorType: 'critical', errorMessage: 'Instance ID no configurado' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      try {
        // Llamar a Evolution API para verificar estado
        const evolutionUrl = `${config.base_url}/instance/connectionState/${config.instance_id}`;
        console.log(`[ConnectionState] 🔍 Calling: ${evolutionUrl}`);
        const stateData = await makeEvolutionRequest(evolutionUrl, config.api_key, 'GET');

        console.log(`[ConnectionState] 📦 Full response from Evolution API:`, JSON.stringify(stateData));

        const state = stateData.instance?.state || 'disconnected';
        console.log(`[ConnectionState] 🎯 Extracted state: "${state}"`);

        // Si está conectado, actualizar BD
        if (state === 'open') {
          console.log(`[ConnectionState] ✅ State is OPEN! Updating database...`);
          const { error: updateError } = await supabase
            .from('evolution_integrations')
            .update({
              connection_state: 'open',
              last_connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('company_id', companyId);

          if (updateError) {
            console.error('[ConnectionState] ❌ Error updating database:', updateError);
          } else {
            console.log('[ConnectionState] ✅ Database updated successfully');
          }
        }

        console.log(`[ConnectionState] 📤 Returning state to frontend: "${state}"`);
        return new Response(
          JSON.stringify({ state }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (error: any) {
        console.error('[ConnectionState] ❌ Error checking connection state:', error);
        console.error('[ConnectionState] Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });

        // Clasificar tipo de error
        let errorType = 'temporary';
        if (error.message.includes('401') || error.message.includes('API Key')) {
          errorType = 'critical';
        } else if (error.message.includes('404') || error.message.includes('not found')) {
          errorType = 'critical';
        } else if (error.message.includes('Network error')) {
          errorType = 'critical';
        }

        return new Response(
          JSON.stringify({
            state: 'error',
            errorType,
            errorMessage: error.message
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // ============================================
    // POST /reset-state - Resetear estado a disconnected
    // ============================================
    if (method === 'POST' && path === '/reset-state') {
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
        console.log(`[ResetState] 🔄 Resetting connection state to disconnected for company: ${companyId}`);

        // Actualizar estado a "disconnected"
        const { error: updateError } = await supabase
          .from('evolution_integrations')
          .update({
            connection_state: 'disconnected',
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId);

        if (updateError) {
          console.error('[ResetState] ❌ Error updating database:', updateError);
          throw updateError;
        }

        console.log('[ResetState] ✅ State reset successfully to disconnected');

        return new Response(
          JSON.stringify({
            state: 'disconnected',
            message: 'Estado restablecido correctamente'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } catch (error: any) {
        console.error('[ResetState] ❌ Error resetting state:', error);
        return new Response(
          JSON.stringify({
            error: 'Error al restablecer estado',
            details: error.message
          }),
          {
            status: 500,
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
