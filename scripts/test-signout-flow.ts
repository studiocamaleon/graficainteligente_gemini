import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

console.log('🔍 DIAGNÓSTICO DE SIGNOUT - Supabase Auth\n');
console.log('='.repeat(60));

async function testSignOutFlow() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('\n📋 Test 1: Verificar estado inicial de sesión');
  console.log('-'.repeat(60));

  const { data: initialSession } = await supabase.auth.getSession();
  console.log('Sesión inicial:', initialSession.session ? 'EXISTE' : 'NO EXISTE');

  if (initialSession.session) {
    console.log('  - User ID:', initialSession.session.user.id);
    console.log('  - Email:', initialSession.session.user.email);
    console.log('  - Expira en:', new Date(initialSession.session.expires_at! * 1000).toLocaleString());
  }

  console.log('\n📋 Test 2: Intentar signOut con scope global (comportamiento actual)');
  console.log('-'.repeat(60));

  try {
    console.log('Ejecutando: supabase.auth.signOut()...');
    const result = await supabase.auth.signOut();
    console.log('✅ SignOut global exitoso:', result);
  } catch (error: any) {
    console.log('❌ Error en signOut global:', error.message);
    console.log('   Código:', error.code);
    console.log('   Status:', error.status);
  }

  console.log('\n📋 Test 3: Verificar sesión después de signOut global');
  console.log('-'.repeat(60));

  const { data: afterGlobalSession } = await supabase.auth.getSession();
  console.log('Sesión después de signOut global:', afterGlobalSession.session ? 'TODAVÍA EXISTE' : 'ELIMINADA');

  console.log('\n📋 Test 4: Intentar signOut con scope local');
  console.log('-'.repeat(60));

  try {
    console.log('Ejecutando: supabase.auth.signOut({ scope: "local" })...');
    const result = await supabase.auth.signOut({ scope: 'local' });
    console.log('✅ SignOut local exitoso:', result);
  } catch (error: any) {
    console.log('❌ Error en signOut local:', error.message);
    console.log('   Código:', error.code);
    console.log('   Status:', error.status);
  }

  console.log('\n📋 Test 5: Verificar sesión después de signOut local');
  console.log('-'.repeat(60));

  const { data: afterLocalSession } = await supabase.auth.getSession();
  console.log('Sesión después de signOut local:', afterLocalSession.session ? 'TODAVÍA EXISTE' : 'ELIMINADA');

  console.log('\n📋 Test 6: Probar limpieza manual de storage');
  console.log('-'.repeat(60));

  // Simular lo que hace el navegador
  console.log('Intentando limpiar manualmente el storage de auth...');

  // En Node.js no podemos acceder a localStorage, pero podemos verificar
  // si la biblioteca tiene métodos para limpiar sin hacer llamadas HTTP
  console.log('Nota: En el navegador se puede usar localStorage.clear() o removeItem()');

  console.log('\n📋 Test 7: Verificar comportamiento del cliente sin sesión válida');
  console.log('-'.repeat(60));

  const freshClient = createClient(supabaseUrl, supabaseKey);
  const { data: noSession } = await freshClient.auth.getSession();
  console.log('Cliente fresco sin sesión:', noSession.session ? 'TIENE SESIÓN' : 'SIN SESIÓN');

  try {
    console.log('Intentando signOut en cliente sin sesión...');
    await freshClient.auth.signOut({ scope: 'local' });
    console.log('✅ SignOut en cliente sin sesión: EXITOSO');
  } catch (error: any) {
    console.log('❌ Error en signOut sin sesión:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE DIAGNÓSTICO\n');
  console.log('El problema ocurre cuando:');
  console.log('1. La sesión existe en localStorage del navegador');
  console.log('2. Pero ya expiró o fue invalidada en el servidor');
  console.log('3. signOut() intenta invalidarla en el servidor → Error 403');
  console.log('\nSolución recomendada:');
  console.log('- NO usar signOut() de Supabase');
  console.log('- Limpiar manualmente localStorage');
  console.log('- Actualizar el estado de React directamente');
  console.log('='.repeat(60));
}

testSignOutFlow().catch(console.error);
