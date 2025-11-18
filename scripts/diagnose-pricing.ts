import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY deben estar definidos en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosePricing() {
  console.log('=== DIAGNÓSTICO DE PRECIOS ===\n');

  // 1. Buscar productos con precios configurados
  console.log('1. Buscando productos con precios...');
  const { data: productosConPrecios, error: preciosError } = await supabase
    .from('productos_precios')
    .select('producto_id')
    .limit(100);

  if (preciosError) {
    console.error('Error buscando precios:', preciosError);
    return;
  }

  const productosIds = [...new Set(productosConPrecios?.map(p => p.producto_id) || [])];
  console.log(`   Encontrados ${productosIds.length} productos con precios configurados\n`);

  if (productosIds.length === 0) {
    console.log('⚠️  No hay productos con precios configurados.');
    console.log('   Debes configurar precios en la sección de Precios del sistema.\n');
    return;
  }

  // Buscar información de estos productos
  const { data: productos, error: prodError } = await supabase
    .from('productos')
    .select('id, nombre, categoria_id')
    .in('id', productosIds)
    .limit(5);

  if (prodError) {
    console.error('Error buscando productos:', prodError);
    return;
  }

  console.log(`   Productos encontrados: ${productos?.length || 0}\n`);

  if (!productos || productos.length === 0) {
    console.log('No hay productos para analizar.');
    return;
  }

  // Analizar el primer producto
  const producto = productos[0];
  console.log(`2. Analizando producto: ${producto.nombre} (${producto.id})\n`);

  // 2. Buscar precios para este producto
  console.log('3. Buscando registros de precios...');
  const { data: precios, error: preciosProductoError } = await supabase
    .from('productos_precios')
    .select('*')
    .eq('producto_id', producto.id);

  if (preciosProductoError) {
    console.error('Error buscando precios:', preciosProductoError);
    return;
  }

  console.log(`   Encontrados ${precios?.length || 0} registros de precios\n`);

  if (!precios || precios.length === 0) {
    console.log('⚠️  PROBLEMA: No hay precios configurados para este producto.');
    console.log('   Para que el wizard funcione, debes configurar precios en la sección de Precios.\n');
    return;
  }

  // 3. Mostrar estructura de precios
  console.log('4. Estructura de precios encontrados:');
  console.log('   Campos únicos en los registros:');

  const camposUnicos = {
    material_ids: new Set<string>(),
    variante_nombres: new Set<string>(),
    tecnologia_ids: new Set<string>(),
    tipo_tintas: new Set<string>(),
    rangos: new Set<string>(),
  };

  precios.forEach(p => {
    if (p.material_id) camposUnicos.material_ids.add(p.material_id);
    if (p.variante_nombre) camposUnicos.variante_nombres.add(p.variante_nombre);
    if (p.tecnologia_id) camposUnicos.tecnologia_ids.add(p.tecnologia_id);
    if (p.tipo_tinta) camposUnicos.tipo_tintas.add(p.tipo_tinta);
    if (p.rango_min !== null && p.rango_max !== null) {
      camposUnicos.rangos.add(`${p.rango_min}-${p.rango_max}`);
    }
  });

  console.log(`   - Material IDs: ${camposUnicos.material_ids.size} únicos`);
  Array.from(camposUnicos.material_ids).forEach(id => console.log(`     * ${id}`));

  console.log(`   - Variantes: ${camposUnicos.variante_nombres.size} únicas`);
  Array.from(camposUnicos.variante_nombres).forEach(v => console.log(`     * ${v}`));

  console.log(`   - Rangos: ${camposUnicos.rangos.size} únicos`);
  Array.from(camposUnicos.rangos).forEach(r => console.log(`     * ${r} m²`));

  console.log('\n5. Ejemplo de registros de precios:');
  precios.slice(0, 3).forEach((p, idx) => {
    console.log(`   Registro ${idx + 1}:`);
    console.log(`     - Material ID: ${p.material_id || 'null'}`);
    console.log(`     - Variante: ${p.variante_nombre || 'null'}`);
    console.log(`     - Tecnología ID: ${p.tecnologia_id || 'null'}`);
    console.log(`     - Tipo Tinta: ${p.tipo_tinta || 'null'}`);
    console.log(`     - Rango: ${p.rango_min}-${p.rango_max} m²`);
    console.log(`     - Precio: $${p.precio_venta}`);
    console.log('');
  });

  // 4. Verificar rangos de precio
  console.log('6. Verificando configuración de rangos de precio...');
  const { data: rangos, error: rangosError } = await supabase
    .from('rangos_precio')
    .select('*')
    .limit(5);

  if (rangosError) {
    console.error('Error buscando rangos:', rangosError);
    return;
  }

  console.log(`   Encontrados ${rangos?.length || 0} rangos de precio configurados\n`);

  if (rangos && rangos.length > 0) {
    rangos.forEach((r, idx) => {
      console.log(`   Rango ${idx + 1}: ${r.nombre}`);
      console.log(`     - ID: ${r.id}`);
      console.log(`     - Rangos definidos: ${JSON.stringify(r.rangos)}`);
      console.log('');
    });
  }

  // 5. Simular una búsqueda como la que hace el wizard
  console.log('7. Simulando búsqueda del wizard...');
  console.log('   Parámetros de ejemplo:');
  const ejemploMaterialId = Array.from(camposUnicos.material_ids)[0];
  const ejemploVariante = Array.from(camposUnicos.variante_nombres)[0];
  const ejemploRango = Array.from(camposUnicos.rangos)[0];
  const [rangoMin, rangoMax] = ejemploRango ? ejemploRango.split('-').map(Number) : [1, 5];

  console.log(`     - Material ID: ${ejemploMaterialId}`);
  console.log(`     - Variante: ${ejemploVariante}`);
  console.log(`     - Rango: ${rangoMin}-${rangoMax}`);
  console.log('');

  const { data: precioSimulado, error: simError } = await supabase
    .from('productos_precios')
    .select('*')
    .eq('producto_id', producto.id)
    .eq('material_id', ejemploMaterialId)
    .eq('variante_nombre', ejemploVariante)
    .eq('rango_min', rangoMin)
    .eq('rango_max', rangoMax)
    .is('tecnologia_id', null)
    .is('tipo_tinta', null)
    .is('cara_impresion', null)
    .maybeSingle();

  if (simError) {
    console.error('   ❌ Error en búsqueda simulada:', simError);
  } else if (precioSimulado) {
    console.log('   ✅ Búsqueda exitosa:');
    console.log(`      Precio encontrado: $${precioSimulado.precio_venta}`);
  } else {
    console.log('   ⚠️  No se encontró precio con estos parámetros exactos.');
    console.log('      Esto indica que la combinación de filtros no coincide.');
  }

  console.log('\n=== FIN DEL DIAGNÓSTICO ===');
}

diagnosePricing().catch(console.error);
