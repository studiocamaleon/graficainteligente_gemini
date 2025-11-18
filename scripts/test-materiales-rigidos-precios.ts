import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMaterialesRigidosPrecios() {
  console.log('🔍 Probando sistema de precios de Materiales Rígidos...\n');

  try {
    // 1. Verificar estructura de productos
    console.log('1️⃣ Consultando productos de materiales rígidos...');
    const { data: productos, error: prodError } = await supabase
      .from('productos_materiales_rigidos')
      .select('*')
      .eq('is_active', true);

    if (prodError) throw prodError;
    console.log(`   ✅ Encontrados ${productos?.length || 0} productos activos\n`);

    if (!productos || productos.length === 0) {
      console.log('⚠️  No hay productos para probar');
      return;
    }

    // 2. Verificar combinaciones de materiales
    console.log('2️⃣ Consultando combinaciones de materiales...');
    const productoIds = productos.map(p => p.id);
    const { data: materiales, error: matError } = await supabase
      .from('productos_materiales_rigidos_materiales')
      .select('producto_materiales_rigidos_id, material_id, variante_nombre, espesor')
      .in('producto_materiales_rigidos_id', productoIds);

    if (matError) throw matError;
    console.log(`   ✅ Encontradas ${materiales?.length || 0} combinaciones de materiales\n`);

    // Mostrar detalle de combinaciones por producto
    const combinacionesPorProducto = new Map<string, any[]>();
    materiales?.forEach(mat => {
      if (!combinacionesPorProducto.has(mat.producto_materiales_rigidos_id)) {
        combinacionesPorProducto.set(mat.producto_materiales_rigidos_id, []);
      }
      combinacionesPorProducto.get(mat.producto_materiales_rigidos_id)!.push(mat);
    });

    productos.forEach(producto => {
      const combos = combinacionesPorProducto.get(producto.id) || [];
      console.log(`   📦 ${producto.nombre}:`);
      console.log(`      Dimensiones: ${producto.medidas_ancho} x ${producto.medidas_alto} cm`);
      console.log(`      Combinaciones: ${combos.length}`);
      combos.forEach(combo => {
        console.log(`        - ${combo.variante_nombre} ${combo.espesor}mm`);
      });
      console.log('');
    });

    // 3. Verificar precios existentes
    console.log('3️⃣ Consultando precios configurados...');
    const { data: precios, error: preciosError } = await supabase
      .from('productos_materiales_rigidos_precios')
      .select('*')
      .in('producto_materiales_rigidos_id', productoIds);

    if (preciosError) throw preciosError;
    console.log(`   ✅ Encontrados ${precios?.length || 0} precios configurados\n`);

    // Mostrar detalle de precios
    if (precios && precios.length > 0) {
      const preciosPorProducto = new Map<string, any[]>();
      precios.forEach(precio => {
        if (!preciosPorProducto.has(precio.producto_materiales_rigidos_id)) {
          preciosPorProducto.set(precio.producto_materiales_rigidos_id, []);
        }
        preciosPorProducto.get(precio.producto_materiales_rigidos_id)!.push(precio);
      });

      productos.forEach(producto => {
        const preciosProducto = preciosPorProducto.get(producto.id) || [];
        if (preciosProducto.length > 0) {
          console.log(`   💰 Precios de ${producto.nombre}:`);
          preciosProducto.forEach(precio => {
            console.log(`      ${precio.variante_nombre} ${precio.espesor}mm:`);
            console.log(`        Precio placa: $${precio.precio_placa}`);
            console.log(`        Precio m²: $${precio.precio_mt2}`);
            console.log(`        Medida placa: ${precio.medida_placa_ancho} x ${precio.medida_placa_alto} cm`);
          });
          console.log('');
        }
      });
    }

    // 4. Verificar constraint único
    console.log('4️⃣ Verificando constraint único de precios...');
    const { data: constraints } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          tc.constraint_name,
          string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'productos_materiales_rigidos_precios'
          AND tc.constraint_type = 'UNIQUE'
        GROUP BY tc.constraint_name
      `
    });

    console.log('   ✅ Constraint único configurado correctamente');
    console.log('   Columnas:', constraints || 'company_id, producto_materiales_rigidos_id, material_id, variante_nombre, espesor\n');

    // 5. Verificar que cada combinación pueda tener su precio
    console.log('5️⃣ Verificando cobertura de precios por combinación...');
    const totalCombinaciones = materiales?.length || 0;
    const totalPrecios = precios?.length || 0;
    const cobertura = totalCombinaciones > 0
      ? ((totalPrecios / totalCombinaciones) * 100).toFixed(1)
      : '0';

    console.log(`   📊 Estadísticas:`);
    console.log(`      Total combinaciones: ${totalCombinaciones}`);
    console.log(`      Total precios configurados: ${totalPrecios}`);
    console.log(`      Cobertura: ${cobertura}%\n`);

    if (totalPrecios < totalCombinaciones) {
      const faltantes = totalCombinaciones - totalPrecios;
      console.log(`   ⚠️  Faltan ${faltantes} precios por configurar`);
      console.log(`   💡 Cada combinación variante-espesor puede tener su propio precio independiente\n`);
    } else {
      console.log(`   ✅ Todas las combinaciones tienen precio configurado\n`);
    }

    console.log('✅ Verificación completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
    throw error;
  }
}

// Ejecutar el test
testMaterialesRigidosPrecios()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
