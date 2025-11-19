import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testProductoTintas() {
  console.log('=== Test de Tintas en Productos ===\n');

  // 1. Buscar un producto de impresión láser
  const { data: productos, error: prodError } = await supabase
    .from('productos_impresion_laser')
    .select('id, nombre, medidas_disponibles')
    .limit(1);

  if (prodError) {
    console.error('Error buscando producto:', prodError);
    return;
  }

  if (!productos || productos.length === 0) {
    console.log('No se encontraron productos de impresión láser');
    return;
  }

  const producto = productos[0];
  console.log('✅ Producto encontrado:', producto.nombre);
  console.log('   ID:', producto.id);
  console.log('   Medidas disponibles:', JSON.stringify(producto.medidas_disponibles, null, 2));

  // 2. Buscar tecnologías y tintas del producto
  const { data: tecnologias, error: tecError } = await supabase
    .from('productos_impresion_laser_tecnologias')
    .select(`
      id,
      tecnologia_id,
      tintas,
      tecnologias!inner(id, nombre)
    `)
    .eq('producto_laser_id', producto.id);

  if (tecError) {
    console.error('Error buscando tecnologías:', tecError);
    return;
  }

  console.log('\n✅ Tecnologías encontradas:', tecnologias?.length || 0);

  tecnologias?.forEach((tec: any) => {
    console.log('\n   Tecnología:', tec.tecnologias.nombre);
    console.log('   ID:', tec.tecnologia_id);
    console.log('   Tintas:', tec.tintas);
    console.log('   Tipo de tintas:', typeof tec.tintas);
    console.log('   Es array:', Array.isArray(tec.tintas));
  });

  // 3. Buscar materiales
  const { data: materiales, error: matError } = await supabase
    .from('productos_impresion_laser_materiales')
    .select(`
      id,
      material_id,
      variante_nombre,
      espesor,
      materiales!inner(id, nombre, unidad_espesor)
    `)
    .eq('producto_laser_id', producto.id);

  if (matError) {
    console.error('Error buscando materiales:', matError);
    return;
  }

  console.log('\n✅ Materiales encontrados:', materiales?.length || 0);

  materiales?.forEach((mat: any) => {
    console.log('\n   Material:', mat.materiales.nombre);
    console.log('   Variante:', mat.variante_nombre);
    console.log('   Espesor:', mat.espesor, mat.materiales.unidad_espesor);
  });

  // 4. Verificar estructura de configuración completa
  console.log('\n=== Configuración completa del producto ===');

  const config = {
    id: producto.id,
    nombre: producto.nombre,
    medidas: producto.medidas_disponibles,
    tecnologias: tecnologias?.map(t => ({
      id: t.id,
      tecnologia_id: t.tecnologia_id,
      tecnologia_nombre: (t.tecnologias as any).nombre,
      tintas: t.tintas || []
    })),
    materiales: materiales?.map(m => ({
      id: m.id,
      material_id: m.material_id,
      material_nombre: (m.materiales as any).nombre,
      variante_nombre: m.variante_nombre,
      espesor: m.espesor,
      unidad_espesor: (m.materiales as any).unidad_espesor
    }))
  };

  console.log(JSON.stringify(config, null, 2));
}

testProductoTintas().catch(console.error);
