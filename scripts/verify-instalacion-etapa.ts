import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyInstalacionEtapa() {
  console.log('='.repeat(80));
  console.log('VERIFICACIÓN DE ETAPA "INSTALACIÓN" EN RUTAS_PRODUCCION_PASOS');
  console.log('='.repeat(80));
  console.log('');

  try {
    // 1. Verificar todos los pasos en etapa "Instalación"
    console.log('1. Consultando pasos en etapa "Instalación"...');
    const { data: pasosInstalacion, error: errorPasos } = await supabase
      .from('rutas_produccion_pasos')
      .select(`
        id,
        ruta_id,
        etapa,
        paso_id,
        orden,
        es_obligatorio,
        tipo_condicion,
        configuracion_condicion,
        created_at,
        ruta:rutas_produccion(nombre)
      `)
      .eq('etapa', 'Instalacion')
      .order('ruta_id')
      .order('orden');

    if (errorPasos) {
      console.error('❌ Error al consultar pasos:', errorPasos);
      return;
    }

    console.log(`✅ Encontrados ${pasosInstalacion?.length || 0} pasos en etapa Instalación\n`);

    if (!pasosInstalacion || pasosInstalacion.length === 0) {
      console.log('ℹ️  No hay pasos en la etapa Instalación. No hay problemas que verificar.');
      return;
    }

    // 2. Mostrar resumen de pasos
    console.log('2. Resumen de pasos encontrados:');
    console.log('-'.repeat(80));

    const pasosGroupedByRuta: Record<string, any[]> = {};
    pasosInstalacion.forEach(paso => {
      const rutaId = paso.ruta_id;
      if (!pasosGroupedByRuta[rutaId]) {
        pasosGroupedByRuta[rutaId] = [];
      }
      pasosGroupedByRuta[rutaId].push(paso);
    });

    for (const [rutaId, pasos] of Object.entries(pasosGroupedByRuta)) {
      const rutaNombre = (pasos[0] as any).ruta?.nombre || 'Sin nombre';
      console.log(`\n📋 Ruta: ${rutaNombre} (ID: ${rutaId.slice(0, 8)}...)`);
      console.log(`   Total de pasos: ${pasos.length}`);

      pasos.forEach((paso: any, index: number) => {
        console.log(`\n   Paso #${index + 1}:`);
        console.log(`   - ID: ${paso.id.slice(0, 8)}...`);
        console.log(`   - Orden: ${paso.orden}`);
        console.log(`   - Obligatorio: ${paso.es_obligatorio ? 'Sí' : 'No'}`);
        console.log(`   - Tipo condición: ${paso.tipo_condicion || 'null'}`);
        console.log(`   - paso_id: ${paso.paso_id ? paso.paso_id.slice(0, 8) + '...' : 'NULL'}`);

        if (paso.configuracion_condicion) {
          console.log(`   - Configuración:`, JSON.stringify(paso.configuracion_condicion, null, 6));
        }
      });
    }

    console.log('\n' + '-'.repeat(80));

    // 3. Verificar inconsistencias
    console.log('\n3. Verificando inconsistencias...\n');

    let hasProblems = false;

    for (const paso of pasosInstalacion) {
      const problemas: string[] = [];

      // Problema 1: es_obligatorio=true pero paso_id=null
      if (paso.es_obligatorio && !paso.paso_id) {
        problemas.push('❌ Es obligatorio pero paso_id es NULL');
      }

      // Problema 2: es_obligatorio=true pero tipo_condicion no es 'sin_condicion'
      if (paso.es_obligatorio && paso.tipo_condicion && paso.tipo_condicion !== 'sin_condicion') {
        problemas.push(`❌ Es obligatorio pero tipo_condicion es '${paso.tipo_condicion}'`);
      }

      // Problema 3: tipo_condicion requiere paso_id pero es NULL
      if (['sin_condicion', 'servicio_sin_nivel', 'acabado_sin_nivel'].includes(paso.tipo_condicion || '') && !paso.paso_id) {
        problemas.push(`❌ tipo_condicion '${paso.tipo_condicion}' requiere paso_id pero es NULL`);
      }

      // Problema 4: tipo_condicion de mapeo múltiple pero paso_id no es NULL
      if (['servicio_con_nivel', 'acabado_con_nivel', 'tecnologia_tinta'].includes(paso.tipo_condicion || '') && paso.paso_id) {
        problemas.push(`⚠️  tipo_condicion '${paso.tipo_condicion}' usa mapeo múltiple pero paso_id NO es NULL`);
      }

      // Problema 5: configuracion_condicion vacía para pasos condicionales
      if (!paso.es_obligatorio && (!paso.configuracion_condicion || Object.keys(paso.configuracion_condicion).length === 0)) {
        problemas.push('⚠️  Es condicional pero configuracion_condicion está vacía');
      }

      if (problemas.length > 0) {
        hasProblems = true;
        console.log(`\n🔴 Paso problemático: ${paso.id.slice(0, 8)}...`);
        console.log(`   Ruta: ${(paso as any).ruta?.nombre || 'Sin nombre'}`);
        console.log(`   Orden: ${paso.orden}`);
        problemas.forEach(problema => console.log(`   ${problema}`));
      }
    }

    if (!hasProblems) {
      console.log('✅ No se encontraron inconsistencias en los datos');
    }

    // 4. Verificar duplicados potenciales
    console.log('\n4. Verificando posibles duplicados (mismo ruta_id, etapa, orden)...\n');

    const duplicates: Record<string, any[]> = {};
    pasosInstalacion.forEach(paso => {
      const key = `${paso.ruta_id}-${paso.etapa}-${paso.orden}`;
      if (!duplicates[key]) {
        duplicates[key] = [];
      }
      duplicates[key].push(paso);
    });

    let hasDuplicates = false;
    for (const [key, pasos] of Object.entries(duplicates)) {
      if (pasos.length > 1) {
        hasDuplicates = true;
        console.log(`\n⚠️  Duplicados encontrados (${key}):`);
        pasos.forEach((paso: any, index: number) => {
          console.log(`   Paso #${index + 1}: ID=${paso.id.slice(0, 8)}..., paso_id=${paso.paso_id ? paso.paso_id.slice(0, 8) + '...' : 'NULL'}`);
        });
      }
    }

    if (!hasDuplicates) {
      console.log('✅ No se encontraron duplicados');
    }

    // 5. Verificar constraints de base de datos
    console.log('\n5. Resumen de tipos de condición en Instalación:');
    console.log('-'.repeat(80));

    const tiposCondicion: Record<string, number> = {};
    pasosInstalacion.forEach(paso => {
      const tipo = paso.tipo_condicion || 'null';
      tiposCondicion[tipo] = (tiposCondicion[tipo] || 0) + 1;
    });

    for (const [tipo, count] of Object.entries(tiposCondicion)) {
      console.log(`   ${tipo}: ${count} paso(s)`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('VERIFICACIÓN COMPLETADA');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
    if (error && typeof error === 'object') {
      console.error('Detalles del error:', JSON.stringify(error, null, 2));
    }
  }
}

// Ejecutar verificación
verifyInstalacionEtapa()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
