import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProductivityFunctions() {
  console.log('Testing Productivity Functions...\n');

  // Test if we can connect
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('❌ Not authenticated. Please login first.');
    return;
  }

  console.log('✓ Authenticated as:', user.email);

  // Get company_id from profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('❌ Could not get profile:', profileError);
    return;
  }

  console.log('✓ Company ID:', profile.company_id);
  console.log('\nTesting RPC functions:\n');

  // Test fn_kpis_generales
  console.log('1. Testing fn_kpis_generales...');
  const { data: kpis, error: kpisError } = await supabase.rpc('fn_kpis_generales', {
    p_company_id: profile.company_id,
    p_fecha_desde: null,
    p_fecha_hasta: null,
  });

  if (kpisError) {
    console.error('   ❌ Error:', kpisError.message);
  } else {
    console.log('   ✓ Success:', kpis);
  }

  // Test fn_metricas_por_paso
  console.log('\n2. Testing fn_metricas_por_paso...');
  const { data: pasos, error: pasosError } = await supabase.rpc('fn_metricas_por_paso', {
    p_company_id: profile.company_id,
    p_fecha_desde: null,
    p_fecha_hasta: null,
  });

  if (pasosError) {
    console.error('   ❌ Error:', pasosError.message);
  } else {
    console.log(`   ✓ Success: Found ${pasos?.length || 0} pasos`);
  }

  // Test fn_metricas_por_categoria
  console.log('\n3. Testing fn_metricas_por_categoria...');
  const { data: categorias, error: categoriasError } = await supabase.rpc('fn_metricas_por_categoria', {
    p_company_id: profile.company_id,
    p_fecha_desde: null,
    p_fecha_hasta: null,
  });

  if (categoriasError) {
    console.error('   ❌ Error:', categoriasError.message);
  } else {
    console.log(`   ✓ Success: Found ${categorias?.length || 0} categorias`);
  }

  // Test fn_metricas_por_etapa
  console.log('\n4. Testing fn_metricas_por_etapa...');
  const { data: etapas, error: etapasError } = await supabase.rpc('fn_metricas_por_etapa', {
    p_company_id: profile.company_id,
    p_fecha_desde: null,
    p_fecha_hasta: null,
  });

  if (etapasError) {
    console.error('   ❌ Error:', etapasError.message);
  } else {
    console.log(`   ✓ Success: Found ${etapas?.length || 0} etapas`);
  }

  // Check if there's any data
  console.log('\n5. Checking for completed steps in database...');
  const { data: completedSteps, error: stepsError } = await supabase
    .from('ordenes_trabajo_items_rutas')
    .select('id')
    .eq('company_id', profile.company_id)
    .eq('estado_paso', 'completado')
    .not('fecha_inicio', 'is', null)
    .not('fecha_fin', 'is', null)
    .limit(10);

  if (stepsError) {
    console.error('   ❌ Error:', stepsError.message);
  } else {
    console.log(`   ✓ Found ${completedSteps?.length || 0} completed steps with timestamps`);
    if (completedSteps && completedSteps.length === 0) {
      console.log('   ℹ️  No completed steps found. The productivity metrics will show empty state.');
      console.log('   ℹ️  Execute some production steps to see data in the productivity dashboard.');
    }
  }

  console.log('\n✓ All tests completed!');
}

testProductivityFunctions().catch(console.error);
