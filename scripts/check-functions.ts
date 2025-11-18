import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseFunctions() {
  console.log('🔍 Verificando funciones y triggers en Supabase\n');

  // Test 1: Verificar que podemos conectarnos
  console.log('1️⃣ Test de conexión...');
  const { data: healthCheck, error: healthError } = await supabase
    .from('subscription_plans')
    .select('count')
    .limit(1);
  
  if (healthError) {
    console.log('❌ Error de conexión:', healthError.message);
    return;
  }
  console.log('✅ Conexión exitosa\n');

  // Test 2: Simular registro y verificar si el trigger funciona
  console.log('2️⃣ Simulando registro de usuario...');
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Test123456!';
  const testCompanyName = 'Test Company ' + Date.now();
  
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: 'Test User',
        company_name: testCompanyName,
        company_slug: 'test-company-' + Date.now(),
      },
    },
  });

  if (signUpError) {
    console.log('❌ Error al crear usuario:', signUpError.message);
    return;
  }

  console.log('✅ Usuario creado en auth.users:', signUpData.user?.id);
  console.log('   Email:', signUpData.user?.email);

  // Esperar un momento para que el trigger se ejecute
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Verificar si se creó el perfil
  console.log('\n3️⃣ Verificando si el trigger creó el perfil...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', signUpData.user?.id)
    .single();

  if (profileError || !profile) {
    console.log('❌ PROBLEMA ENCONTRADO: El perfil NO fue creado por el trigger');
    console.log('   Error:', profileError?.message || 'No se encontró el perfil');
    console.log('\n🔴 DIAGNÓSTICO: El trigger handle_new_user() NO SE ESTÁ EJECUTANDO');
  } else {
    console.log('✅ Perfil creado correctamente');
    console.log('   User ID:', profile.id);
    console.log('   Company ID:', profile.company_id);
    console.log('   Role:', profile.role);
  }

  // Test 4: Verificar si se creó la empresa
  if (profile?.company_id) {
    console.log('\n4️⃣ Verificando si se creó la empresa...');
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single();

    if (companyError || !company) {
      console.log('❌ La empresa NO fue creada');
    } else {
      console.log('✅ Empresa creada correctamente');
      console.log('   Name:', company.name);
      console.log('   Slug:', company.slug);
    }

    // Test 5: Verificar suscripción
    console.log('\n5️⃣ Verificando suscripción...');
    const { data: subscription, error: subError } = await supabase
      .from('company_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('company_id', profile.company_id)
      .single();

    if (subError || !subscription) {
      console.log('❌ La suscripción NO fue creada');
    } else {
      console.log('✅ Suscripción creada correctamente');
      console.log('   Plan:', subscription.subscription_plans?.name);
    }
  }

  // Limpieza
  console.log('\n6️⃣ Limpiando usuario de prueba...');
  if (signUpData.user) {
    await supabase.auth.admin.deleteUser(signUpData.user.id).catch(() => {
      console.log('⚠️  No se pudo eliminar el usuario (requiere service_role_key)');
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 RESUMEN DEL DIAGNÓSTICO');
  console.log('='.repeat(80));
  
  if (!profile) {
    console.log('\n🔴 PROBLEMA CRÍTICO IDENTIFICADO:');
    console.log('   El trigger handle_new_user() NO se está ejecutando cuando se crea un usuario.');
    console.log('\n💡 POSIBLES CAUSAS:');
    console.log('   1. El trigger no existe en la base de datos');
    console.log('   2. El trigger existe pero está deshabilitado');
    console.log('   3. La función handle_new_user() tiene un error y falla silenciosamente');
    console.log('   4. Las políticas RLS están bloqueando las inserciones del trigger');
    console.log('\n🔧 PRÓXIMOS PASOS:');
    console.log('   Necesitas verificar en Supabase Dashboard > Database > Triggers');
    console.log('   Y revisar los logs de Postgres para ver errores del trigger');
  } else {
    console.log('\n✅ El sistema está funcionando correctamente');
  }
  console.log('='.repeat(80));
}

checkDatabaseFunctions().catch(console.error);
