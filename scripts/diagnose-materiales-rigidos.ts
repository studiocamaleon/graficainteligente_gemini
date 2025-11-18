import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseMaterialesRigidos() {
  console.log('='.repeat(80));
  console.log('DIAGNÓSTICO: PRODUCTOS MATERIALES RÍGIDOS');
  console.log('='.repeat(80));
  console.log('\n');

  try {
    // 1. Obtener todos los productos de materiales rígidos
    console.log('1. PRODUCTOS MATERIALES RÍGIDOS');
    console.log('-'.repeat(80));
    const { data: productos, error: prodError } = await supabase
      .from('productos_materiales_rigidos')
      .select('*')
      .order('nombre');

    if (prodError) throw prodError;

    if (!productos || productos.length === 0) {
      console.log('⚠️  No hay productos de materiales rígidos registrados\n');
      return;
    }

    console.log(`✅ Encontrados ${productos.length} productos:\n`);
    productos.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.nombre}`);
      console.log(`   ID: ${p.id}`);
      console.log(`   Estado: ${p.is_active ? '✅ Activo' : '❌ Inactivo'}`);
      console.log(`   Dimensiones: ${p.medidas_ancho} x ${p.medidas_alto} cm`);
      console.log(`   IVA: ${p.impuesto_iva}%`);
      console.log('');
    });

    // 2. Para cada producto, obtener sus combinaciones de materiales
    console.log('\n2. COMBINACIONES DE MATERIALES POR PRODUCTO');
    console.log('-'.repeat(80));

    for (const producto of productos) {
      console.log(`\n📦 PRODUCTO: ${producto.nombre}`);
      console.log(`   ID: ${producto.id}`);

      const { data: combinaciones, error: combError } = await supabase
        .from('productos_materiales_rigidos_materiales')
        .select('*')
        .eq('producto_materiales_rigidos_id', producto.id)
        .order('variante_nombre, espesor');

      if (combError) {
        console.log(`   ❌ Error: ${combError.message}`);
        continue;
      }

      if (!combinaciones || combinaciones.length === 0) {
        console.log('   ⚠️  Sin combinaciones configuradas');
        continue;
      }

      console.log(`   ✅ ${combinaciones.length} combinaciones encontradas:\n`);

      // Agrupar por variante
      const porVariante = new Map<string, any[]>();
      combinaciones.forEach((comb) => {
        if (!porVariante.has(comb.variante_nombre)) {
          porVariante.set(comb.variante_nombre, []);
        }
        porVariante.get(comb.variante_nombre)!.push(comb);
      });

      // Mostrar detalles de cada variante
      porVariante.forEach((combs, variante) => {
        console.log(`   🔹 Variante: ${variante}`);
        combs.forEach((comb, idx) => {
          console.log(`      ${idx + 1}. Espesor: ${comb.espesor}mm`);
          console.log(`         - Material ID: ${comb.material_id.substring(0, 16)}...`);
          console.log(`         - Registro ID: ${comb.id.substring(0, 16)}...`);
          console.log(`         - Espesores Array: ${JSON.stringify(comb.espesores)}`);
          console.log(`         - Created: ${new Date(comb.created_at).toLocaleString('es-AR')}`);
        });
        console.log('');
      });

      // Detectar posibles duplicados
      const duplicados = new Map<string, number>();
      combinaciones.forEach((comb) => {
        const key = `${comb.variante_nombre}-${comb.espesor}`;
        duplicados.set(key, (duplicados.get(key) || 0) + 1);
      });

      const tieneDuplicados = Array.from(duplicados.values()).some((count) => count > 1);
      if (tieneDuplicados) {
        console.log('   🚨 DUPLICADOS DETECTADOS:');
        duplicados.forEach((count, key) => {
          if (count > 1) {
            console.log(`      - ${key}: ${count} registros`);
          }
        });
        console.log('');
      }
    }

    // 3. Obtener información de materiales base
    console.log('\n3. MATERIALES BASE DISPONIBLES');
    console.log('-'.repeat(80));

    const { data: materialesBase, error: matError } = await supabase
      .from('materiales')
      .select('id, nombre, variantes, is_active')
      .order('nombre');

    if (matError) throw matError;

    if (!materialesBase || materialesBase.length === 0) {
      console.log('⚠️  No hay materiales base registrados\n');
    } else {
      console.log(`✅ Encontrados ${materialesBase.length} materiales base:\n`);
      materialesBase.forEach((mat, idx) => {
        console.log(`${idx + 1}. ${mat.nombre}`);
        console.log(`   ID: ${mat.id.substring(0, 16)}...`);
        console.log(`   Estado: ${mat.is_active ? '✅ Activo' : '❌ Inactivo'}`);

        if (mat.variantes && Array.isArray(mat.variantes)) {
          console.log(`   Variantes (${mat.variantes.length}):`);
          mat.variantes.forEach((v: any) => {
            console.log(`      - ${v.nombre}`);
            if (v.espesores && Array.isArray(v.espesores)) {
              console.log(`        Espesores: ${v.espesores.join(', ')}mm`);
            }
          });
        } else {
          console.log('   ⚠️  Sin variantes configuradas');
        }
        console.log('');
      });
    }

    // 4. Verificar integridad de referencias
    console.log('\n4. VERIFICACIÓN DE INTEGRIDAD DE REFERENCIAS');
    console.log('-'.repeat(80));

    const { data: todasCombinaciones, error: allCombError } = await supabase
      .from('productos_materiales_rigidos_materiales')
      .select('material_id, variante_nombre, espesor');

    if (allCombError) throw allCombError;

    if (todasCombinaciones && todasCombinaciones.length > 0) {
      const materialesIds = new Set(materialesBase?.map((m) => m.id) || []);
      const referenciaRotas: any[] = [];

      todasCombinaciones.forEach((comb) => {
        if (!materialesIds.has(comb.material_id)) {
          referenciaRotas.push(comb);
        }
      });

      if (referenciaRotas.length > 0) {
        console.log(`🚨 REFERENCIAS ROTAS DETECTADAS: ${referenciaRotas.length}`);
        referenciaRotas.forEach((ref) => {
          console.log(`   - Material ID: ${ref.material_id.substring(0, 16)}... (no existe)`);
          console.log(`     Variante: ${ref.variante_nombre}, Espesor: ${ref.espesor}mm`);
        });
      } else {
        console.log('✅ Todas las referencias a materiales son válidas');
      }
    }

    // 5. Verificar precios configurados
    console.log('\n\n5. PRECIOS CONFIGURADOS');
    console.log('-'.repeat(80));

    for (const producto of productos) {
      const { data: precios, error: preciosError } = await supabase
        .from('productos_materiales_rigidos_precios')
        .select('variante_nombre, espesor, precio_placa, precio_mt2')
        .eq('producto_materiales_rigidos_id', producto.id);

      if (preciosError) {
        console.log(`\n❌ Error obteniendo precios de ${producto.nombre}: ${preciosError.message}`);
        continue;
      }

      console.log(`\n💰 ${producto.nombre}:`);
      if (!precios || precios.length === 0) {
        console.log('   ⚠️  Sin precios configurados');
      } else {
        console.log(`   ✅ ${precios.length} precios configurados`);
        precios.forEach((precio) => {
          console.log(`      - ${precio.variante_nombre} ${precio.espesor}mm: $${precio.precio_placa} (placa) / $${precio.precio_mt2} (m²)`);
        });
      }
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('DIAGNÓSTICO COMPLETADO');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ ERROR DURANTE EL DIAGNÓSTICO:');
    console.error(error);
    throw error;
  }
}

// Ejecutar diagnóstico
diagnoseMaterialesRigidos()
  .then(() => {
    console.log('\n✅ Script ejecutado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falló:', error);
    process.exit(1);
  });
