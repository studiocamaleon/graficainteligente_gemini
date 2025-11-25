import { supabase } from '../lib/supabase';

export async function debugTrackingSteps(ordenItemId: string) {
  console.log('🔍 Debugging tracking steps para item:', ordenItemId);

  const { data, error } = await supabase
    .from('ordenes_trabajo_items_rutas')
    .select('id, paso_nombre, tipo_etapa, orden, estado_paso, fecha_inicio, fecha_fin, updated_at')
    .eq('orden_item_id', ordenItemId)
    .order('tipo_etapa')
    .order('orden');

  if (error) {
    console.error('❌ Error al obtener pasos:', error);
    return null;
  }

  console.log('📊 Pasos encontrados:', data?.length);
  console.table(data);

  return data;
}

export async function debugTrackingByToken(token: string) {
  console.log('🔍 Debugging tracking para token:', token);

  const { data: ordenData, error: ordenError } = await supabase
    .from('ordenes_trabajo')
    .select('id, numero_orden, estado, tracking_token')
    .eq('tracking_token', token)
    .single();

  if (ordenError) {
    console.error('❌ Error al obtener orden:', ordenError);
    return null;
  }

  console.log('📦 Orden encontrada:', ordenData);

  const { data: itemsData, error: itemsError } = await supabase
    .from('ordenes_trabajo_items')
    .select('id, producto_nombre, estado')
    .eq('orden_id', ordenData.id);

  if (itemsError) {
    console.error('❌ Error al obtener items:', itemsError);
    return null;
  }

  console.log('📋 Items encontrados:', itemsData?.length);
  console.table(itemsData);

  for (const item of itemsData || []) {
    console.log(`\n🔧 Pasos para item: ${item.producto_nombre}`);
    await debugTrackingSteps(item.id);
  }

  return { orden: ordenData, items: itemsData };
}

export async function testRPCFunction(token: string) {
  console.log('🧪 Testing RPC function con token:', token);

  const { data, error } = await supabase.rpc('fn_get_public_order_tracking', {
    p_tracking_token: token,
  });

  if (error) {
    console.error('❌ Error en RPC:', error);
    return null;
  }

  console.log('✅ RPC response:', data);

  if (data && 'items' in data) {
    (data as any).items?.forEach((item: any, idx: number) => {
      console.log(`\n📦 Item ${idx + 1}: ${item.producto_nombre}`);
      console.log('Estado del item:', item.estado);
      console.log('Pasos:', item.pasos?.length || 0);
      console.table(item.pasos);
    });
  }

  return data;
}
