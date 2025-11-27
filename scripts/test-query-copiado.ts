import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testQueryCentroCopiadoOrdenes() {
  console.log('🧪 Testing query para órdenes de copiado...\n');

  // Primero, buscar una orden de copiado existente
  const { data: ordenes, error: ordenesError } = await supabase
    .from('centro_copiado_ordenes')
    .select('id, numero_orden')
    .limit(1);

  if (ordenesError) {
    console.error('❌ Error buscando órdenes:', ordenesError);
    return;
  }

  if (!ordenes || ordenes.length === 0) {
    console.log('⚠️  No hay órdenes de copiado en la base de datos');
    return;
  }

  const ordenId = ordenes[0].id;
  console.log(`📋 Testeando con orden: ${ordenes[0].numero_orden} (${ordenId})\n`);

  // Probar la query corregida
  const { data: ordenData, error: ordenError } = await supabase
    .from('centro_copiado_ordenes')
    .select(`
      *,
      items:centro_copiado_ordenes_items(
        *,
        tamanio_papel:centro_copiado_tamanios_papel(nombre),
        papel:centro_copiado_papeles(
          variante_nombre,
          material:material_id(nombre)
        )
      ),
      pagos:centro_copiado_ordenes_pagos(monto)
    `)
    .eq('id', ordenId)
    .single();

  if (ordenError) {
    console.error('❌ Error en query:', ordenError);
    console.error('Detalles:', JSON.stringify(ordenError, null, 2));
    return;
  }

  console.log('✅ Query ejecutada exitosamente!\n');
  console.log('📦 Datos de la orden:');
  console.log(`   - Número: ${ordenData.numero_orden}`);
  console.log(`   - Estado: ${ordenData.estado}`);
  console.log(`   - Total: $${ordenData.total}`);
  console.log(`   - Fecha entrega: ${ordenData.fecha_entrega_estimada || 'No definida'}`);
  console.log(`   - Items: ${ordenData.items?.length || 0}`);

  if (ordenData.items && ordenData.items.length > 0) {
    console.log('\n📄 Detalles de items:');
    ordenData.items.forEach((item: any, index: number) => {
      console.log(`\n   Item ${index + 1}:`);
      console.log(`   - Cantidad unidades: ${item.cantidad_unidades}`);
      console.log(`   - Cantidad hojas: ${item.cantidad_hojas}`);
      console.log(`   - Tipo tinta: ${item.tipo_tinta}`);
      console.log(`   - Cara impresa: ${item.cara_impresa}`);
      console.log(`   - Tamaño papel: ${item.tamanio_papel?.nombre || 'N/A'}`);
      console.log(`   - Material papel: ${item.papel?.material?.nombre || 'N/A'}`);
      console.log(`   - Variante papel: ${item.papel?.variante_nombre || 'N/A'}`);

      if (item.tipo_anillado) {
        console.log(`   - Anillado: ${item.tipo_anillado}`);
      }
      if (item.tipo_plastificado) {
        console.log(`   - Plastificado: ${item.tipo_plastificado}`);
      }

      console.log(`   - Precio unitario: $${item.precio_unitario}`);
      console.log(`   - Subtotal: $${item.subtotal}`);
    });
  }

  // Probar función de formateo
  console.log('\n\n🖨️  Probando función de formateo de mensaje:\n');
  console.log('─'.repeat(60));

  if (ordenData.items && ordenData.items.length > 0) {
    ordenData.items.forEach((item: any, index: number) => {
      const mensaje = formatItemCopiadoParaNuevaOrden(item, index);
      console.log(mensaje);
      if (index < ordenData.items.length - 1) {
        console.log('\n');
      }
    });
  }

  console.log('─'.repeat(60));
  console.log('\n✅ Test completado exitosamente!');
}

function formatItemCopiadoParaNuevaOrden(item: any, index: number): string {
  const cantidad = item.cantidad_unidades || 0;
  const precio = parseFloat(item.precio_unitario || 0).toFixed(2);
  const subtotal = parseFloat(item.subtotal || 0).toFixed(2);

  let detalle = `${index + 1}. `;

  if (item.nombre_archivo) {
    detalle += `📄 *${item.nombre_archivo}*\n   `;
  }

  if (item.descripcion) {
    detalle += `${item.descripcion}\n   `;
  }

  const hojas = item.cantidad_hojas || 0;
  const tamanio = item.tamanio_papel?.nombre || 'N/A';

  const materialNombre = item.papel?.material?.nombre || '';
  const varianteNombre = item.papel?.variante_nombre || '';
  const papelCompleto = materialNombre && varianteNombre
    ? `${materialNombre} ${varianteNombre}`
    : (varianteNombre || materialNombre || 'N/A');

  const tinta = item.tipo_tinta === 'CMYK' ? 'Color' : 'Blanco y Negro';
  const caras = item.cara_impresa === 'frente_y_dorso' ? 'Doble faz' : 'Simple faz';

  detalle += `🖨️ *Impresión ${tinta}*\n`;
  detalle += `   ${cantidad}x ${hojas} hojas ${caras}\n`;
  detalle += `   ${tamanio} - ${papelCompleto}\n`;
  detalle += `   $${precio} c/u = $${subtotal}`;

  if (item.tipo_anillado) {
    const tipo = item.tipo_anillado === 'ring_wire' ? 'Ring Wire' : 'Plástico';
    detalle += `\n   + Anillado ${tipo}`;
  }

  if (item.tipo_plastificado) {
    detalle += `\n   + Plastificado ${item.tipo_plastificado}`;
  }

  return detalle;
}

testQueryCentroCopiadoOrdenes().catch(console.error);
