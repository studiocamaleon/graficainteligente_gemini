import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosePricingIssue() {
  console.log('=== DIAGNÓSTICO DE PROBLEMA DE PRECIOS ===\n');

  const productoId = 'a33878e0-72ca-4563-8177-3c3b5e03639d';
  const materialId = 'a598a9df-2773-4965-8a2b-4c774e96e85e';
  const varianteNombre = 'Blanco';

  console.log('Parámetros de búsqueda:');
  console.log('- productoId:', productoId);
  console.log('- materialId:', materialId);
  console.log('- varianteNombre:', varianteNombre);
  console.log('\n');

  // 1. Verificar datos del producto
  console.log('1. Verificando producto...');
  const { data: producto, error: prodError } = await supabase
    .from('productos')
    .select('*')
    .eq('id', productoId)
    .maybeSingle();

  if (prodError) {
    console.error('Error:', prodError.message);
  } else if (!producto) {
    console.log('❌ Producto no encontrado');
  } else {
    console.log('✅ Producto encontrado:', producto.nombre);
    console.log('   - tipo_medida:', producto.tipo_medida);
    console.log('   - unidad_pricing:', producto.pricing?.unidad_pricing);
    console.log('   - tiene_descuento:', producto.pricing?.tiene_descuento);
    console.log('   - rango_precio_id:', producto.pricing?.rango_precio_id);
  }
  console.log('\n');

  // 2. Verificar material
  console.log('2. Verificando material...');
  const { data: material, error: matError } = await supabase
    .from('materiales')
    .select('*')
    .eq('id', materialId)
    .maybeSingle();

  if (matError) {
    console.error('Error:', matError.message);
  } else if (!material) {
    console.log('❌ Material no encontrado');
  } else {
    console.log('✅ Material encontrado:', material.nombre);
    console.log('   - variantes:', JSON.stringify(material.variantes));
  }
  console.log('\n');

  // 3. Verificar rangos de precio
  if (producto?.pricing?.rango_precio_id) {
    console.log('3. Verificando rangos de precio...');
    const { data: rangosPrecio, error: rangoError } = await supabase
      .from('rangos_precio')
      .select('*')
      .eq('id', producto.pricing.rango_precio_id)
      .maybeSingle();

    if (rangoError) {
      console.error('Error:', rangoError.message);
    } else if (!rangosPrecio) {
      console.log('❌ Rangos de precio no encontrados');
    } else {
      console.log('✅ Rangos de precio encontrados:');
      console.log('   - nombre:', rangosPrecio.nombre);
      console.log('   - rangos:', JSON.stringify(rangosPrecio.rangos, null, 2));
    }
    console.log('\n');
  }

  // 4. Verificar precios existentes para este producto
  console.log('4. Verificando precios en productos_precios...');
  const { data: precios, error: preciosError } = await supabase
    .from('productos_precios')
    .select('*')
    .eq('producto_id', productoId);

  if (preciosError) {
    console.error('Error:', preciosError.message);
  } else if (!precios || precios.length === 0) {
    console.log('❌ No hay precios configurados para este producto');
  } else {
    console.log(`✅ Se encontraron ${precios.length} registros de precios:`);
    precios.forEach((precio, index) => {
      console.log(`\n   Precio ${index + 1}:`);
      console.log('   - material_id:', precio.material_id);
      console.log('   - variante_nombre:', precio.variante_nombre);
      console.log('   - tecnologia_id:', precio.tecnologia_id);
      console.log('   - tipo_tinta:', precio.tipo_tinta);
      console.log('   - cara_impresion:', precio.cara_impresion);
      console.log('   - cantidad:', precio.cantidad);
      console.log('   - rango_min:', precio.rango_min);
      console.log('   - rango_max:', precio.rango_max);
      console.log('   - precio_venta:', precio.precio_venta);
    });
  }
  console.log('\n');

  // 5. Buscar precios específicos con los parámetros de búsqueda
  console.log('5. Buscando precio específico con los parámetros exactos...');
  const { data: precioEspecifico, error: especificoError } = await supabase
    .from('productos_precios')
    .select('*')
    .eq('producto_id', productoId)
    .eq('material_id', materialId)
    .eq('variante_nombre', varianteNombre)
    .is('tecnologia_id', null)
    .is('tipo_tinta', null)
    .is('cara_impresion', null);

  if (especificoError) {
    console.error('Error:', especificoError.message);
  } else if (!precioEspecifico || precioEspecifico.length === 0) {
    console.log('❌ No se encontró precio con estos parámetros exactos');
  } else {
    console.log(`✅ Se encontraron ${precioEspecifico.length} precios con estos parámetros:`);
    precioEspecifico.forEach((precio, index) => {
      console.log(`\n   Precio ${index + 1}:`);
      console.log('   - rango_min:', precio.rango_min);
      console.log('   - rango_max:', precio.rango_max);
      console.log('   - cantidad:', precio.cantidad);
      console.log('   - precio_venta:', precio.precio_venta);
    });
  }
  console.log('\n');

  // 6. Simular búsqueda con cantidad de 1.44 m2
  console.log('6. Simulando búsqueda con cantidad de 1.44 m2...');
  const cantidadBuscada = 1.44;
  if (precioEspecifico && precioEspecifico.length > 0) {
    const preciosAplicables = precioEspecifico.filter(p => {
      if (p.rango_min !== null && p.rango_max !== null) {
        return cantidadBuscada >= p.rango_min && cantidadBuscada <= p.rango_max;
      }
      return false;
    });

    if (preciosAplicables.length > 0) {
      console.log(`✅ Se encontraron ${preciosAplicables.length} precios aplicables para ${cantidadBuscada} m2:`);
      preciosAplicables.forEach(precio => {
        console.log(`   - Rango [${precio.rango_min} - ${precio.rango_max}]: $${precio.precio_venta}`);
      });
    } else {
      console.log('❌ No se encontró ningún precio aplicable para esta cantidad');
    }
  }

  console.log('\n=== FIN DEL DIAGNÓSTICO ===');
}

diagnosePricingIssue().catch(console.error);
