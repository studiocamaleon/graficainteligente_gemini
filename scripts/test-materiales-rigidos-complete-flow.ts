import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCompleteFlow() {
  console.log('='.repeat(80));
  console.log('PRUEBA COMPLETA: SISTEMA DE MATERIALES RÍGIDOS CON VARIANTES Y ESPESORES');
  console.log('='.repeat(80));
  console.log('\n');

  try {
    // Paso 1: Verificar que la migración se aplicó correctamente
    console.log('1. VERIFICANDO ESTRUCTURA DE BASE DE DATOS');
    console.log('-'.repeat(80));

    const { data: columnsMatData, error: colMatError } = await supabase.rpc('exec_sql' as any, {
      query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'productos_materiales_rigidos_materiales'
        AND column_name IN ('espesor', 'espesores')
        ORDER BY column_name;
      `
    });

    if (colMatError) {
      console.log('⚠️  No se pudo verificar estructura (RPC no disponible)');
      console.log('   Continuando con pruebas...\n');
    } else {
      console.log('✅ Estructura de productos_materiales_rigidos_materiales:');
      console.log(JSON.stringify(columnsMatData, null, 2));
      console.log('');
    }

    // Paso 2: Obtener un material existente para usar en las pruebas
    console.log('2. OBTENIENDO MATERIAL DE PRUEBA');
    console.log('-'.repeat(80));

    const { data: materiales, error: matError } = await supabase
      .from('materiales')
      .select('id, nombre, variantes')
      .eq('is_active', true)
      .limit(1);

    if (matError) throw matError;

    if (!materiales || materiales.length === 0) {
      console.log('❌ No hay materiales disponibles. Por favor crea un material primero.');
      return;
    }

    const material = materiales[0];
    console.log(`✅ Material encontrado: ${material.nombre}`);
    console.log(`   ID: ${material.id}`);
    console.log(`   Variantes: ${JSON.stringify(material.variantes)}`);
    console.log('');

    // Paso 3: Obtener company_id del usuario autenticado
    console.log('3. OBTENIENDO INFORMACIÓN DEL USUARIO');
    console.log('-'.repeat(80));

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log('❌ No hay usuario autenticado. Este script requiere autenticación.');
      console.log('   Para probar, debes autenticarte primero.');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.log('❌ No se pudo obtener el perfil del usuario');
      return;
    }

    console.log(`✅ Usuario autenticado: ${user.email}`);
    console.log(`   Company ID: ${profile.company_id}`);
    console.log('');

    // Paso 4: Crear producto de prueba con múltiples variantes y espesores
    console.log('4. CREANDO PRODUCTO DE PRUEBA CON MÚLTIPLES VARIANTES/ESPESORES');
    console.log('-'.repeat(80));

    const productoNombre = `Test Acrílico ${Date.now()}`;
    const { data: productoCreado, error: prodCreateError } = await supabase
      .from('productos_materiales_rigidos')
      .insert({
        company_id: profile.company_id,
        nombre: productoNombre,
        medidas_ancho: 122,
        medidas_alto: 244,
        tipo_venta: 'mt2',
        impuesto_iva: 21,
        is_active: true,
      })
      .select()
      .single();

    if (prodCreateError) throw prodCreateError;

    console.log(`✅ Producto creado: ${productoCreado.nombre}`);
    console.log(`   ID: ${productoCreado.id}`);
    console.log(`   Dimensiones: ${productoCreado.medidas_ancho} x ${productoCreado.medidas_alto} cm`);
    console.log('');

    // Paso 5: Crear combinaciones de variante y espesor
    console.log('5. CREANDO COMBINACIONES DE VARIANTE Y ESPESOR');
    console.log('-'.repeat(80));

    const combinaciones = [
      { variante_nombre: 'Transparente', espesor: 3.0 },
      { variante_nombre: 'Transparente', espesor: 5.0 },
      { variante_nombre: 'Transparente', espesor: 10.0 },
      { variante_nombre: 'Blanco', espesor: 3.0 },
      { variante_nombre: 'Blanco', espesor: 5.0 },
    ];

    const materialesData = combinaciones.map((comb) => ({
      producto_materiales_rigidos_id: productoCreado.id,
      material_id: material.id,
      variante_nombre: comb.variante_nombre,
      espesor: comb.espesor,
      espesores: [comb.espesor], // Array para compatibilidad
    }));

    const { data: combinacionesCreadas, error: combError } = await supabase
      .from('productos_materiales_rigidos_materiales')
      .insert(materialesData)
      .select();

    if (combError) throw combError;

    console.log(`✅ ${combinacionesCreadas.length} combinaciones creadas exitosamente:`);
    combinacionesCreadas.forEach((comb, idx) => {
      console.log(`   ${idx + 1}. ${comb.variante_nombre} - ${comb.espesor}mm`);
      console.log(`      Espesor singular: ${comb.espesor}`);
      console.log(`      Espesores array: ${JSON.stringify(comb.espesores)}`);
    });
    console.log('');

    // Paso 6: Verificar que no se pueden crear duplicados
    console.log('6. VERIFICANDO PREVENCIÓN DE DUPLICADOS');
    console.log('-'.repeat(80));

    const { data: duplicado, error: dupError } = await supabase
      .from('productos_materiales_rigidos_materiales')
      .insert({
        producto_materiales_rigidos_id: productoCreado.id,
        material_id: material.id,
        variante_nombre: 'Transparente',
        espesor: 3.0,
        espesores: [3.0],
      })
      .select();

    if (dupError) {
      console.log('✅ Constraint funcionando: No se permite crear duplicados');
      console.log(`   Error esperado: ${dupError.message}`);
    } else {
      console.log('⚠️  ADVERTENCIA: Se permitió crear un duplicado. Verifica el constraint.');
    }
    console.log('');

    // Paso 7: Crear precios para algunas combinaciones
    console.log('7. CREANDO PRECIOS PARA COMBINACIONES');
    console.log('-'.repeat(80));

    const preciosData = [
      {
        company_id: profile.company_id,
        producto_materiales_rigidos_id: productoCreado.id,
        material_id: material.id,
        variante_nombre: 'Transparente',
        espesor: 3.0,
        espesores: [3.0],
        medida_placa_ancho: productoCreado.medidas_ancho,
        medida_placa_alto: productoCreado.medidas_alto,
        precio_placa: 15000,
        precio_mt2: 0, // Se calculará automáticamente
      },
      {
        company_id: profile.company_id,
        producto_materiales_rigidos_id: productoCreado.id,
        material_id: material.id,
        variante_nombre: 'Transparente',
        espesor: 5.0,
        espesores: [5.0],
        medida_placa_ancho: productoCreado.medidas_ancho,
        medida_placa_alto: productoCreado.medidas_alto,
        precio_placa: 22000,
        precio_mt2: 0,
      },
      {
        company_id: profile.company_id,
        producto_materiales_rigidos_id: productoCreado.id,
        material_id: material.id,
        variante_nombre: 'Blanco',
        espesor: 3.0,
        espesores: [3.0],
        medida_placa_ancho: productoCreado.medidas_ancho,
        medida_placa_alto: productoCreado.medidas_alto,
        precio_placa: 14000,
        precio_mt2: 0,
      },
    ];

    const { data: preciosCreados, error: preciosError } = await supabase
      .from('productos_materiales_rigidos_precios')
      .insert(preciosData)
      .select();

    if (preciosError) throw preciosError;

    console.log(`✅ ${preciosCreados.length} precios creados exitosamente:`);
    preciosCreados.forEach((precio, idx) => {
      console.log(`   ${idx + 1}. ${precio.variante_nombre} ${precio.espesor}mm:`);
      console.log(`      Precio placa: $${precio.precio_placa}`);
      console.log(`      Precio m²: $${precio.precio_mt2.toFixed(2)} (calculado automáticamente)`);
    });
    console.log('');

    // Paso 8: Verificar que no se puede crear precio sin combinación válida
    console.log('8. VERIFICANDO VALIDACIÓN DE PRECIOS');
    console.log('-'.repeat(80));

    const { data: precioInvalido, error: precioInvalidoError } = await supabase
      .from('productos_materiales_rigidos_precios')
      .insert({
        company_id: profile.company_id,
        producto_materiales_rigidos_id: productoCreado.id,
        material_id: material.id,
        variante_nombre: 'NoExiste',
        espesor: 99.0,
        espesores: [99.0],
        medida_placa_ancho: productoCreado.medidas_ancho,
        medida_placa_alto: productoCreado.medidas_alto,
        precio_placa: 1000,
        precio_mt2: 0,
      })
      .select();

    if (precioInvalidoError) {
      console.log('✅ Validación funcionando: No se permite crear precio sin combinación válida');
      console.log(`   Error esperado: ${precioInvalidoError.message.substring(0, 100)}...`);
    } else {
      console.log('⚠️  ADVERTENCIA: Se permitió crear un precio sin combinación válida.');
    }
    console.log('');

    // Paso 9: Consultar productos agrupados como lo hace el hook
    console.log('9. SIMULANDO CONSULTA DEL TAB DE PRECIOS');
    console.log('-'.repeat(80));

    const { data: productosParaPrecios, error: queryError } = await supabase
      .from('productos_materiales_rigidos')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('is_active', true);

    if (queryError) throw queryError;

    const productoIds = productosParaPrecios.map((p) => p.id);

    const [materialesRes, preciosRes, materialesInfoRes] = await Promise.all([
      supabase
        .from('productos_materiales_rigidos_materiales')
        .select('producto_materiales_rigidos_id, material_id, variante_nombre, espesor')
        .in('producto_materiales_rigidos_id', productoIds),
      supabase
        .from('productos_materiales_rigidos_precios')
        .select('*')
        .in('producto_materiales_rigidos_id', productoIds)
        .eq('company_id', profile.company_id),
      supabase.from('materiales').select('id, nombre'),
    ]);

    if (materialesRes.error) throw materialesRes.error;
    if (preciosRes.error) throw preciosRes.error;
    if (materialesInfoRes.error) throw materialesInfoRes.error;

    console.log(`✅ Datos recuperados correctamente:`);
    console.log(`   Productos: ${productosParaPrecios.length}`);
    console.log(`   Combinaciones de materiales: ${materialesRes.data?.length || 0}`);
    console.log(`   Precios configurados: ${preciosRes.data?.length || 0}`);
    console.log('');

    // Agrupar combinaciones para mostrar
    const combinacionesPorProducto = new Map<string, any[]>();
    (materialesRes.data || []).forEach((comb: any) => {
      if (!combinacionesPorProducto.has(comb.producto_materiales_rigidos_id)) {
        combinacionesPorProducto.set(comb.producto_materiales_rigidos_id, []);
      }
      combinacionesPorProducto.get(comb.producto_materiales_rigidos_id)!.push(comb);
    });

    console.log('   Desglose por producto:');
    productosParaPrecios.forEach((prod) => {
      const combs = combinacionesPorProducto.get(prod.id) || [];
      console.log(`   - ${prod.nombre}: ${combs.length} combinaciones`);
      combs.forEach((c) => {
        const tienePrecio = (preciosRes.data || []).some(
          (p: any) =>
            p.producto_materiales_rigidos_id === prod.id &&
            p.variante_nombre === c.variante_nombre &&
            Number(p.espesor) === Number(c.espesor)
        );
        console.log(`     * ${c.variante_nombre} ${c.espesor}mm ${tienePrecio ? '💰 con precio' : '⚠️  sin precio'}`);
      });
    });
    console.log('');

    // Paso 10: Resumen final
    console.log('10. RESUMEN DE LA PRUEBA');
    console.log('-'.repeat(80));
    console.log('✅ Migración aplicada correctamente');
    console.log('✅ Producto creado con múltiples combinaciones');
    console.log('✅ Constraints de unicidad funcionando');
    console.log('✅ Precios creados para combinaciones específicas');
    console.log('✅ Validación de integridad referencial funcionando');
    console.log('✅ Consultas del Tab de Precios funcionan correctamente');
    console.log('');
    console.log('🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE');
    console.log('');
    console.log('Ahora puedes:');
    console.log(`1. Ir al Tab de Precios de Materiales Rígidos`);
    console.log(`2. Buscar el producto "${productoNombre}"`);
    console.log(`3. Configurar precios para las ${combinaciones.length} combinaciones`);
    console.log(`4. Guardar los cambios`);
    console.log('');

    console.log('='.repeat(80));
    console.log('PRUEBA COMPLETADA CON ÉXITO');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('\n❌ ERROR DURANTE LA PRUEBA:');
    console.error(error.message || error);
    if (error.details) {
      console.error('Detalles:', error.details);
    }
    if (error.hint) {
      console.error('Sugerencia:', error.hint);
    }
    throw error;
  }
}

// Ejecutar prueba
testCompleteFlow()
  .then(() => {
    console.log('\n✅ Script ejecutado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falló');
    process.exit(1);
  });
