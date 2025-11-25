/**
 * Script de Testing para Tracking en Tiempo Real
 *
 * Este script verifica:
 * 1. Que la función RPC retorna datos correctos
 * 2. Que los estados de pasos están actualizados
 * 3. Que el orden de pasos es correcto
 * 4. Que Realtime emite eventos correctamente
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

async function testRPCFunction(trackingToken: string) {
  console.log('\n🧪 TEST 1: Función RPC fn_get_public_order_tracking\n');
  console.log('Token:', trackingToken);

  try {
    const { data, error } = await supabase.rpc('fn_get_public_order_tracking', {
      p_tracking_token: trackingToken,
    });

    if (error) {
      results.push({
        test: 'RPC Function Call',
        passed: false,
        message: `Error: ${error.message}`,
      });
      console.error('❌ Error al llamar función RPC:', error);
      return null;
    }

    if (!data) {
      results.push({
        test: 'RPC Function Call',
        passed: false,
        message: 'No se recibieron datos',
      });
      console.error('❌ No se recibieron datos');
      return null;
    }

    if ('error' in data) {
      results.push({
        test: 'RPC Function Call',
        passed: false,
        message: (data as any).message,
      });
      console.error('❌ Error en respuesta:', (data as any).message);
      return null;
    }

    results.push({
      test: 'RPC Function Call',
      passed: true,
      message: 'Función RPC ejecutada correctamente',
      data: {
        numero_orden: data.numero_orden,
        estado: data.estado,
        items_count: data.items?.length || 0,
      },
    });

    console.log('✅ Función RPC ejecutada correctamente');
    console.log('\n📊 Datos de la orden:');
    console.log('  Número de orden:', data.numero_orden);
    console.log('  Estado:', data.estado);
    console.log('  Cliente:', data.cliente_nombre);
    console.log('  Fecha creación:', data.fecha_creacion);
    console.log('  Items:', data.items?.length || 0);

    return data;
  } catch (err) {
    results.push({
      test: 'RPC Function Call',
      passed: false,
      message: `Excepción: ${err}`,
    });
    console.error('❌ Excepción al llamar función RPC:', err);
    return null;
  }
}

function testStepsOrder(data: any) {
  console.log('\n🧪 TEST 2: Orden de pasos\n');

  if (!data?.items || data.items.length === 0) {
    results.push({
      test: 'Steps Order',
      passed: false,
      message: 'No hay items para verificar',
    });
    console.warn('⚠️ No hay items para verificar');
    return;
  }

  let allCorrect = true;
  const etapaOrder = { pre_prensa: 1, principal: 2, post_prensa: 3 };

  for (const item of data.items) {
    console.log(`\n  Item: ${item.producto_nombre}`);
    console.log('  Pasos:');

    if (!item.pasos || item.pasos.length === 0) {
      console.log('    (sin pasos)');
      continue;
    }

    let lastEtapaOrder = 0;
    let lastOrden = 0;

    for (let i = 0; i < item.pasos.length; i++) {
      const paso = item.pasos[i];
      const currentEtapaOrder = etapaOrder[paso.tipo_etapa as keyof typeof etapaOrder] || 99;

      console.log(`    ${i + 1}. ${paso.paso_nombre} (${paso.tipo_etapa}, orden: ${paso.orden}) - ${paso.estado_paso}`);

      // Verificar orden
      if (currentEtapaOrder < lastEtapaOrder) {
        console.error(`    ❌ Error de orden: etapa ${paso.tipo_etapa} después de etapa con orden ${lastEtapaOrder}`);
        allCorrect = false;
      } else if (currentEtapaOrder === lastEtapaOrder && paso.orden < lastOrden) {
        console.error(`    ❌ Error de orden: dentro de ${paso.tipo_etapa}, orden ${paso.orden} después de ${lastOrden}`);
        allCorrect = false;
      }

      lastEtapaOrder = currentEtapaOrder;
      lastOrden = currentEtapaOrder === lastEtapaOrder ? paso.orden : 0;
    }
  }

  results.push({
    test: 'Steps Order',
    passed: allCorrect,
    message: allCorrect ? 'Todos los pasos están en orden correcto' : 'Hay errores de orden',
  });

  if (allCorrect) {
    console.log('\n✅ Todos los pasos están en orden correcto (pre_prensa → principal → post_prensa)');
  } else {
    console.log('\n❌ Hay errores en el orden de los pasos');
  }
}

function testStepsStates(data: any) {
  console.log('\n🧪 TEST 3: Estados de pasos\n');

  if (!data?.items || data.items.length === 0) {
    results.push({
      test: 'Steps States',
      passed: false,
      message: 'No hay items para verificar',
    });
    console.warn('⚠️ No hay items para verificar');
    return;
  }

  const estadosValidos = ['pendiente', 'en_proceso', 'completado', 'omitido'];
  let allValid = true;
  const estadosCount = {
    pendiente: 0,
    en_proceso: 0,
    completado: 0,
    omitido: 0,
  };

  for (const item of data.items) {
    console.log(`\n  Item: ${item.producto_nombre} (estado: ${item.estado})`);

    if (!item.pasos || item.pasos.length === 0) {
      console.log('    (sin pasos)');
      continue;
    }

    for (const paso of item.pasos) {
      if (!estadosValidos.includes(paso.estado_paso)) {
        console.error(`    ❌ Estado inválido: ${paso.paso_nombre} tiene estado "${paso.estado_paso}"`);
        allValid = false;
      } else {
        estadosCount[paso.estado_paso as keyof typeof estadosCount]++;
      }

      // Verificar fechas
      const fechasInfo: string[] = [];
      if (paso.fecha_inicio) fechasInfo.push('inicio: ✓');
      if (paso.fecha_fin) fechasInfo.push('fin: ✓');

      console.log(`    - ${paso.paso_nombre}: ${paso.estado_paso} ${fechasInfo.length > 0 ? `[${fechasInfo.join(', ')}]` : ''}`);
    }
  }

  console.log('\n  Resumen de estados:');
  console.log(`    Pendientes:   ${estadosCount.pendiente}`);
  console.log(`    En proceso:   ${estadosCount.en_proceso}`);
  console.log(`    Completados:  ${estadosCount.completado}`);
  console.log(`    Omitidos:     ${estadosCount.omitido}`);

  results.push({
    test: 'Steps States',
    passed: allValid,
    message: allValid ? 'Todos los estados son válidos' : 'Hay estados inválidos',
    data: estadosCount,
  });

  if (allValid) {
    console.log('\n✅ Todos los estados de pasos son válidos');
  } else {
    console.log('\n❌ Hay estados inválidos en los pasos');
  }
}

async function testRealtimeConnection(trackingToken: string) {
  console.log('\n🧪 TEST 4: Conexión Realtime\n');

  return new Promise<void>((resolve) => {
    const channel = supabase
      .channel(`test-tracking-${trackingToken}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordenes_trabajo_items_rutas',
        },
        (payload) => {
          console.log('✅ Evento Realtime recibido:', payload.eventType);
        }
      )
      .subscribe((status) => {
        console.log('  Estado de suscripción:', status);

        if (status === 'SUBSCRIBED') {
          results.push({
            test: 'Realtime Connection',
            passed: true,
            message: 'Conexión Realtime establecida correctamente',
          });
          console.log('\n✅ Conexión Realtime establecida correctamente');
          console.log('  (Para verificar eventos, completa un paso en producción)');

          // Cerrar después de 5 segundos
          setTimeout(() => {
            supabase.removeChannel(channel);
            resolve();
          }, 5000);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          results.push({
            test: 'Realtime Connection',
            passed: false,
            message: `Error en conexión: ${status}`,
          });
          console.error('❌ Error en conexión Realtime:', status);
          resolve();
        }
      });
  });
}

function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 RESUMEN DE TESTS');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.message}`);
    if (result.data) {
      console.log(`   Datos:`, result.data);
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${results.length} tests`);
  console.log(`Pasados: ${passed}`);
  console.log(`Fallados: ${failed}`);
  console.log('-'.repeat(60) + '\n');

  if (failed === 0) {
    console.log('🎉 ¡Todos los tests pasaron correctamente!\n');
  } else {
    console.log('⚠️ Algunos tests fallaron. Revisa los detalles arriba.\n');
  }
}

async function runTests(trackingToken: string) {
  console.log('🚀 Iniciando tests de Tracking en Tiempo Real...');
  console.log('='.repeat(60));

  // Test 1: Función RPC
  const data = await testRPCFunction(trackingToken);

  if (data) {
    // Test 2: Orden de pasos
    testStepsOrder(data);

    // Test 3: Estados de pasos
    testStepsStates(data);
  }

  // Test 4: Realtime
  await testRealtimeConnection(trackingToken);

  // Resumen final
  printResults();
}

// Obtener token de argumentos o prompt
const trackingToken = process.argv[2];

if (!trackingToken) {
  console.error('\n❌ Error: Debes proporcionar un tracking token');
  console.log('\nUso:');
  console.log('  npm run test-tracking TOKEN\n');
  console.log('Ejemplo:');
  console.log('  npm run test-tracking K3H7W9P2R5T8Y4N6M9Q3X7Z2B5D8\n');
  process.exit(1);
}

if (trackingToken.length !== 32) {
  console.error('\n❌ Error: El token debe tener exactamente 32 caracteres\n');
  process.exit(1);
}

// Ejecutar tests
runTests(trackingToken).then(() => {
  process.exit(results.every(r => r.passed) ? 0 : 1);
});
