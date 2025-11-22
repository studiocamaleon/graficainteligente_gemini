import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const COMPANY_ID = 'b0ad23b1-cf97-4055-823b-ef3c6bed485a';
const fecha_desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const fecha_hasta = new Date().toISOString();

async function testFunction(name: string, rpcCall: string, params: any) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`${'='.repeat(60)}`);

  try {
    const { data, error } = await supabase.rpc(rpcCall, params);

    if (error) {
      console.error(`❌ ERROR in ${name}:`, error);
      return false;
    }

    console.log(`✅ SUCCESS - ${name}`);
    console.log(`Records returned: ${Array.isArray(data) ? data.length : 1}`);
    if (data && (Array.isArray(data) ? data.length > 0 : true)) {
      console.log('Sample data:', JSON.stringify(Array.isArray(data) ? data[0] : data, null, 2));
    }
    return true;
  } catch (err) {
    console.error(`❌ EXCEPTION in ${name}:`, err);
    return false;
  }
}

async function runAllTests() {
  console.log('\n🧪 Starting Productivity Functions Test Suite\n');

  const results = {
    passed: 0,
    failed: 0,
    tests: [] as Array<{name: string, passed: boolean}>
  };

  // Test 1: fn_kpis_generales
  const test1 = await testFunction(
    'fn_kpis_generales',
    'fn_kpis_generales',
    {
      p_company_id: COMPANY_ID,
      p_fecha_desde: fecha_desde,
      p_fecha_hasta: fecha_hasta
    }
  );
  results.tests.push({name: 'fn_kpis_generales', passed: test1});
  if (test1) results.passed++; else results.failed++;

  // Test 2: fn_metricas_por_paso
  const test2 = await testFunction(
    'fn_metricas_por_paso',
    'fn_metricas_por_paso',
    {
      p_company_id: COMPANY_ID,
      p_fecha_desde: fecha_desde,
      p_fecha_hasta: fecha_hasta
    }
  );
  results.tests.push({name: 'fn_metricas_por_paso', passed: test2});
  if (test2) results.passed++; else results.failed++;

  // Test 3: fn_metricas_por_categoria
  const test3 = await testFunction(
    'fn_metricas_por_categoria',
    'fn_metricas_por_categoria',
    {
      p_company_id: COMPANY_ID,
      p_fecha_desde: fecha_desde,
      p_fecha_hasta: fecha_hasta
    }
  );
  results.tests.push({name: 'fn_metricas_por_categoria', passed: test3});
  if (test3) results.passed++; else results.failed++;

  // Test 4: fn_metricas_por_etapa
  const test4 = await testFunction(
    'fn_metricas_por_etapa',
    'fn_metricas_por_etapa',
    {
      p_company_id: COMPANY_ID,
      p_fecha_desde: fecha_desde,
      p_fecha_hasta: fecha_hasta
    }
  );
  results.tests.push({name: 'fn_metricas_por_etapa', passed: test4});
  if (test4) results.passed++; else results.failed++;

  // Test 5: fn_metricas_por_operario
  const test5 = await testFunction(
    'fn_metricas_por_operario',
    'fn_metricas_por_operario',
    {
      p_company_id: COMPANY_ID,
      p_fecha_desde: fecha_desde,
      p_fecha_hasta: fecha_hasta
    }
  );
  results.tests.push({name: 'fn_metricas_por_operario', passed: test5});
  if (test5) results.passed++; else results.failed++;

  // Test 6: fn_ordenes_completadas_detalle
  const test6 = await testFunction(
    'fn_ordenes_completadas_detalle',
    'fn_ordenes_completadas_detalle',
    {
      p_company_id: COMPANY_ID,
      p_fecha_desde: fecha_desde,
      p_fecha_hasta: fecha_hasta,
      p_limit: 10
    }
  );
  results.tests.push({name: 'fn_ordenes_completadas_detalle', passed: test6});
  if (test6) results.passed++; else results.failed++;

  // Test 7: fn_cuellos_botella
  const test7 = await testFunction(
    'fn_cuellos_botella',
    'fn_cuellos_botella',
    {
      p_company_id: COMPANY_ID,
      p_fecha_desde: fecha_desde,
      p_fecha_hasta: fecha_hasta
    }
  );
  results.tests.push({name: 'fn_cuellos_botella', passed: test7});
  if (test7) results.passed++; else results.failed++;

  // Test 8: fn_tendencias_temporales
  const test8 = await testFunction(
    'fn_tendencias_temporales',
    'fn_tendencias_temporales',
    {
      p_company_id: COMPANY_ID,
      p_fecha_desde: fecha_desde,
      p_fecha_hasta: fecha_hasta,
      p_intervalo: 'day'
    }
  );
  results.tests.push({name: 'fn_tendencias_temporales', passed: test8});
  if (test8) results.passed++; else results.failed++;

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('\nDetailed Results:');
  results.tests.forEach(test => {
    console.log(`  ${test.passed ? '✅' : '❌'} ${test.name}`);
  });
  console.log('='.repeat(60) + '\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

runAllTests();
