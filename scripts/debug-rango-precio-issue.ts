/**
 * Script de diagnóstico para problemas de rango_precio en productos láser
 *
 * Este script verifica:
 * 1. Si el producto tiene rango_precio_id configurado
 * 2. Si el rango de precio existe en la tabla
 * 3. Si las políticas RLS permiten acceder al rango
 * 4. Si el JOIN funciona correctamente
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticarRangoPrecio(productoId: string, userId: string) {
  console.log('=== DIAGNÓSTICO DE RANGO DE PRECIO ===\n');
  console.log(`Producto ID: ${productoId}`);
  console.log(`User ID: ${userId}\n`);

  try {
    // 1. Obtener el producto directamente
    console.log('1. Verificando producto...');
    const { data: producto, error: errorProducto } = await supabase
      .from('productos_impresion_laser')
      .select('id, nombre, tipo_venta, rango_precio_id, company_id')
      .eq('id', productoId)
      .maybeSingle();

    if (errorProducto) {
      console.error('❌ Error al obtener producto:', errorProducto);
      return;
    }

    if (!producto) {
      console.error('❌ Producto no encontrado');
      return;
    }

    console.log('✓ Producto encontrado:', {
      nombre: producto.nombre,
      tipo_venta: producto.tipo_venta,
      rango_precio_id: producto.rango_precio_id,
      company_id: producto.company_id,
    });

    // 2. Verificar si tiene rango_precio_id
    if (!producto.rango_precio_id) {
      console.log('\n⚠️  El producto NO tiene rango_precio_id asignado');
      console.log('   Solución: Edita el producto y asigna un rango de precio');
      return;
    }

    console.log('\n2. Verificando rango de precio...');

    // 3. Intentar obtener el rango directamente
    const { data: rango, error: errorRango } = await supabase
      .from('rangos_precio')
      .select('id, nombre, unidad_medida, rangos, company_id')
      .eq('id', producto.rango_precio_id)
      .maybeSingle();

    if (errorRango) {
      console.error('❌ Error al obtener rango de precio:', errorRango);
      console.log('   Posible causa: Políticas RLS bloqueando el acceso');
      return;
    }

    if (!rango) {
      console.error('❌ Rango de precio no encontrado');
      console.log(`   El rango con ID ${producto.rango_precio_id} no existe en la base de datos`);
      console.log('   Solución: Edita el producto y asigna un rango de precio válido');
      return;
    }

    console.log('✓ Rango de precio encontrado:', {
      nombre: rango.nombre,
      unidad_medida: rango.unidad_medida,
      company_id: rango.company_id,
      rangos: rango.rangos,
    });

    // 4. Verificar que ambos pertenecen a la misma company
    if (producto.company_id !== rango.company_id) {
      console.error('\n❌ ERROR: El producto y el rango pertenecen a diferentes compañías');
      console.log(`   Producto company_id: ${producto.company_id}`);
      console.log(`   Rango company_id: ${rango.company_id}`);
      return;
    }

    console.log('\n✓ Validación de company_id: OK');

    // 5. Probar el JOIN como lo hace el hook
    console.log('\n3. Probando JOIN como en el hook...');
    const { data: productoConJoin, error: errorJoin } = await supabase
      .from('productos_impresion_laser')
      .select(`
        *,
        rango_precio:rangos_precio(id, nombre, unidad_medida, rangos)
      `)
      .eq('id', productoId)
      .maybeSingle();

    if (errorJoin) {
      console.error('❌ Error en el JOIN:', errorJoin);
      return;
    }

    if (!productoConJoin) {
      console.error('❌ JOIN no devolvió datos');
      return;
    }

    console.log('✓ JOIN exitoso');
    console.log('  Resultado del JOIN:');
    console.log('  - Producto nombre:', productoConJoin.nombre);
    console.log('  - rango_precio_id:', productoConJoin.rango_precio_id);
    console.log('  - rango_precio:', productoConJoin.rango_precio);

    if (!productoConJoin.rango_precio) {
      console.error('\n⚠️  PROBLEMA ENCONTRADO:');
      console.error('   El JOIN no incluye los datos de rango_precio');
      console.error('   El producto tiene rango_precio_id pero la relación es null');
      console.error('\n   Posibles causas:');
      console.error('   1. Las políticas RLS de rangos_precio no permiten el acceso en el JOIN');
      console.error('   2. El nombre de la foreign key no es correcto');
      console.error('   3. Hay un problema con la configuración del JOIN en Supabase');
      return;
    }

    console.log('\n✅ TODO CORRECTO');
    console.log('   El producto y el rango están correctamente configurados');
    console.log('   El JOIN funciona correctamente');

  } catch (error) {
    console.error('\n❌ Error general:', error);
  }
}

// Uso del script
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Uso: npm run debug-rango-precio <producto_id> <user_id>');
  console.log('');
  console.log('Ejemplo:');
  console.log('  npm run debug-rango-precio abc123-def456 user789-xyz012');
  process.exit(1);
}

const [productoId, userId] = args;

diagnosticarRangoPrecio(productoId, userId).then(() => {
  console.log('\n=== FIN DEL DIAGNÓSTICO ===');
  process.exit(0);
}).catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
