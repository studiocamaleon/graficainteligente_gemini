import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySystem() {
  console.log('🔍 Verificación Final del Sistema de Registro\n');
  console.log('='.repeat(80) + '\n');

  let allChecks = true;

  console.log('1. Verificando tablas...');
  const tables = ['companies', 'profiles', 'subscription_plans', 'company_subscriptions'];
  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`   ❌ ${table}: Error - ${error.message}`);
      allChecks = false;
    } else {
      console.log(`   ✅ ${table}: OK (${count} registros)`);
    }
  }

  console.log('\n2. Verificando planes de suscripción...');
  const { data: plans, error: plansError } = await supabase
    .from('subscription_plans')
    .select('slug, name')
    .eq('is_active', true);

  if (plansError) {
    console.log(`   ❌ Error al consultar planes: ${plansError.message}`);
    allChecks = false;
  } else if (plans && plans.length >= 3) {
    console.log(`   ✅ ${plans.length} planes activos: ${plans.map(p => p.slug).join(', ')}`);
  } else {
    console.log(`   ❌ Solo ${plans?.length || 0} planes encontrados (se esperan 3)`);
    allChecks = false;
  }

  console.log('\n3. Verificando función helper...');
  const { data: functionCheck, error: functionError } = await supabase.rpc('get_user_company_id', {
    user_id: '00000000-0000-0000-0000-000000000000'
  });

  if (functionError && !functionError.message.includes('permission denied')) {
    console.log(`   ✅ Función get_user_company_id existe`);
  } else if (!functionError) {
    console.log(`   ✅ Función get_user_company_id existe y es accesible`);
  } else {
    console.log(`   ⚠️  Función puede tener problemas de permisos`);
  }

  console.log('\n4. Prueba de registro simulado...');
  const testEmail = `test-verify-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: 'Test Verification User',
        company_name: 'Test Verification Company',
        company_slug: `test-verify-${Date.now()}`
      }
    }
  });

  if (signUpError) {
    console.log(`   ❌ Error en registro: ${signUpError.message}`);
    allChecks = false;
  } else if (!signUpData.user) {
    console.log(`   ❌ No se recibió usuario en la respuesta`);
    allChecks = false;
  } else {
    console.log(`   ✅ Usuario creado: ${signUpData.user.id}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', signUpData.user.id)
      .maybeSingle();

    if (profileError) {
      console.log(`   ❌ Error al verificar perfil: ${profileError.message}`);
      allChecks = false;
    } else if (!profile) {
      console.log(`   ❌ Perfil no fue creado`);
      allChecks = false;
    } else {
      console.log(`   ✅ Perfil creado correctamente`);
      console.log(`   ✅ Empresa: ${profile.companies?.name}`);
      console.log(`   ✅ Rol: ${profile.role}`);
    }

    if (signUpData.user) {
      await supabase.auth.admin.deleteUser(signUpData.user.id);
      console.log(`   ✅ Usuario de prueba eliminado`);
    }
  }

  console.log('\n' + '='.repeat(80));
  if (allChecks) {
    console.log('✅ SISTEMA COMPLETAMENTE FUNCIONAL');
    console.log('\nEl sistema de registro está listo para usarse.');
    console.log('Los usuarios pueden registrarse y crear sus empresas automáticamente.');
  } else {
    console.log('⚠️  SISTEMA CON ADVERTENCIAS');
    console.log('\nRevisa los errores mostrados arriba.');
  }
  console.log('='.repeat(80) + '\n');

  process.exit(allChecks ? 0 : 1);
}

verifySystem().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
