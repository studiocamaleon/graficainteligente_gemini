import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listExistingProducts() {
  console.log('=== PRODUCTOS EXISTENTES EN LA BASE DE DATOS ===\n');

  // Listar todos los productos
  const { data: productos, error: prodError } = await supabase
    .from('productos')
    .select('*')
    .order('nombre');

  if (prodError) {
    console.error('Error:', prodError.message);
    return;
  }

  if (!productos || productos.length === 0) {
    console.log('❌ No hay productos en la base de datos');
    return;
  }

  console.log(`✅ Se encontraron ${productos.length} productos:\n`);

  for (const producto of productos) {
    console.log(`📦 ${producto.nombre}`);
    console.log(`   ID: ${producto.id}`);
    console.log(`   Tipo: ${producto.tipo_producto || 'N/A'}`);
    console.log(`   Tipo Medida: ${producto.tipo_medida || 'N/A'}`);
    console.log(`   Pricing:`, JSON.stringify(producto.pricing, null, 2));

    // Verificar si tiene precios configurados
    const { data: precios, error: preciosError } = await supabase
      .from('productos_precios')
      .select('count')
      .eq('producto_id', producto.id);

    if (!preciosError && precios) {
      const count = precios.length;
      console.log(`   Precios configurados: ${count > 0 ? '✅ ' + count : '❌ 0'}`);
    }

    console.log('');
  }

  // Listar materiales disponibles
  console.log('\n=== MATERIALES DISPONIBLES ===\n');

  const { data: materiales, error: matError } = await supabase
    .from('materiales')
    .select('*')
    .order('nombre');

  if (matError) {
    console.error('Error:', matError.message);
  } else if (!materiales || materiales.length === 0) {
    console.log('❌ No hay materiales en la base de datos');
  } else {
    console.log(`✅ Se encontraron ${materiales.length} materiales:\n`);
    materiales.forEach(material => {
      console.log(`🎨 ${material.nombre}`);
      console.log(`   ID: ${material.id}`);
      console.log(`   Variantes:`, JSON.stringify(material.variantes));
      console.log('');
    });
  }

  // Listar rangos de precio
  console.log('\n=== RANGOS DE PRECIO DISPONIBLES ===\n');

  const { data: rangos, error: rangosError } = await supabase
    .from('rangos_precio')
    .select('*')
    .order('nombre');

  if (rangosError) {
    console.error('Error:', rangosError.message);
  } else if (!rangos || rangos.length === 0) {
    console.log('❌ No hay rangos de precio en la base de datos');
  } else {
    console.log(`✅ Se encontraron ${rangos.length} rangos de precio:\n`);
    rangos.forEach(rango => {
      console.log(`📊 ${rango.nombre}`);
      console.log(`   ID: ${rango.id}`);
      console.log(`   Rangos:`, JSON.stringify(rango.rangos, null, 2));
      console.log('');
    });
  }
}

listExistingProducts().catch(console.error);
