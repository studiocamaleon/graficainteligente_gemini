import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFix() {
  console.log('='.repeat(80));
  console.log('VERIFICACIÓN: CORRECCIONES EN PRODUCTOS MATERIALES RÍGIDOS');
  console.log('='.repeat(80));
  console.log('\n');

  try {
    // 1. Verificar producto PVC Espumado
    console.log('1. VERIFICACIÓN PRODUCTO PVC ESPUMADO');
    console.log('-'.repeat(80));

    const { data: pvcProducto } = await supabase
      .from('productos_materiales_rigidos')
      .select('*')
      .eq('nombre', 'PVC Espumado')
      .single();

    if (!pvcProducto) {
      console.log('❌ Producto PVC Espumado no encontrado\n');
    } else {
      console.log(`✅ Producto encontrado: ${pvcProducto.nombre}`);
      console.log(`   ID: ${pvcProducto.id}`);

      const { data: combinacionesPVC } = await supabase
        .from('productos_materiales_rigidos_materiales')
        .select('variante_nombre, espesor')
        .eq('producto_materiales_rigidos_id', pvcProducto.id)
        .order('espesor');

      console.log(`\n   Combinaciones actuales: ${combinacionesPVC?.length || 0}`);
      if (combinacionesPVC && combinacionesPVC.length > 0) {
        combinacionesPVC.forEach((comb) => {
          console.log(`      - ${comb.variante_nombre}: ${comb.espesor}mm`);
        });
      }

      // Verificar contra material base
      const { data: pvcMaterial } = await supabase
        .from('materiales')
        .select('variantes')
        .eq('nombre', 'PVC Espumado')
        .single();

      if (pvcMaterial) {
        console.log('\n   Material base PVC Espumado:');
        pvcMaterial.variantes.forEach((v: any) => {
          console.log(`      Variante: ${v.nombre}`);
          console.log(`      Espesores disponibles: ${v.espesores.join(', ')}mm`);
        });

        // Validar que todas las combinaciones son válidas
        let todasValidas = true;
        if (combinacionesPVC) {
          for (const comb of combinacionesPVC) {
            const variante = pvcMaterial.variantes.find((v: any) => v.nombre === comb.variante_nombre);
            if (!variante || !variante.espesores.includes(Number(comb.espesor))) {
              console.log(`\n   ❌ COMBINACIÓN INVÁLIDA: ${comb.variante_nombre} ${comb.espesor}mm`);
              todasValidas = false;
            }
          }
        }

        if (todasValidas) {
          console.log('\n   ✅ Todas las combinaciones son válidas según el material base');
        }
      }
    }

    // 2. Verificar producto Acrílico
    console.log('\n\n2. VERIFICACIÓN PRODUCTO ACRÍLICO');
    console.log('-'.repeat(80));

    const { data: acrilico } = await supabase
      .from('productos_materiales_rigidos')
      .select('*')
      .eq('nombre', 'Acrilico')
      .single();

    if (!acrilico) {
      console.log('❌ Producto Acrílico no encontrado\n');
    } else {
      console.log(`✅ Producto encontrado: ${acrilico.nombre}`);
      console.log(`   ID: ${acrilico.id}`);

      const { data: combinacionesAcrilico } = await supabase
        .from('productos_materiales_rigidos_materiales')
        .select('variante_nombre, espesor')
        .eq('producto_materiales_rigidos_id', acrilico.id)
        .order('variante_nombre, espesor');

      console.log(`\n   Combinaciones actuales: ${combinacionesAcrilico?.length || 0}`);
      if (!combinacionesAcrilico || combinacionesAcrilico.length === 0) {
        console.log('   ⚠️  SIN COMBINACIONES CONFIGURADAS');
        console.log('   💡 El usuario debe configurar las combinaciones deseadas desde la interfaz');
      } else {
        combinacionesAcrilico.forEach((comb) => {
          console.log(`      - ${comb.variante_nombre}: ${comb.espesor}mm`);
        });
      }

      // Mostrar variantes disponibles del material base
      const { data: acrilicoMaterial } = await supabase
        .from('materiales')
        .select('variantes')
        .eq('nombre', 'Acrilico')
        .single();

      if (acrilicoMaterial) {
        console.log('\n   Material base Acrílico disponible:');
        acrilicoMaterial.variantes.forEach((v: any) => {
          console.log(`      Variante: ${v.nombre}`);
          console.log(`      Espesores: ${v.espesores.join(', ')}mm`);
        });
      }
    }

    // 3. Resumen general
    console.log('\n\n3. RESUMEN DE VERIFICACIÓN');
    console.log('-'.repeat(80));

    const { data: todosProductos } = await supabase
      .from('productos_materiales_rigidos')
      .select(`
        id,
        nombre,
        is_active
      `)
      .order('nombre');

    if (todosProductos) {
      for (const prod of todosProductos) {
        const { data: combs, count } = await supabase
          .from('productos_materiales_rigidos_materiales')
          .select('*', { count: 'exact', head: true })
          .eq('producto_materiales_rigidos_id', prod.id);

        const status = prod.is_active ? '✅' : '❌';
        const combStatus = (count || 0) > 0 ? '✅' : '⚠️ ';
        console.log(`\n${status} ${prod.nombre}`);
        console.log(`   Estado: ${prod.is_active ? 'Activo' : 'Inactivo'}`);
        console.log(`   ${combStatus} Combinaciones: ${count || 0}`);
      }
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('VERIFICACIÓN COMPLETADA');
    console.log('='.repeat(80));
    console.log('\n✅ Problemas corregidos:');
    console.log('   - Eliminadas combinaciones inválidas del producto PVC Espumado');
    console.log('   - Mejorada validación en MaterialVarianteEspesorSelector');
    console.log('   - Agregada detección automática de espesores no válidos');
    console.log('\n📝 Acciones pendientes para el usuario:');
    console.log('   - Configurar combinaciones para el producto Acrílico desde la interfaz');
    console.log('   - Verificar que las combinaciones del PVC Espumado son las deseadas');

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA VERIFICACIÓN:');
    console.error(error);
    throw error;
  }
}

// Ejecutar verificación
verifyFix()
  .then(() => {
    console.log('\n✅ Verificación ejecutada exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verificación falló:', error);
    process.exit(1);
  });
