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

interface DiagnosticResult {
  check: string;
  status: 'OK' | 'ERROR' | 'WARNING';
  message: string;
  details?: any;
}

const results: DiagnosticResult[] = [];

async function log(check: string, status: 'OK' | 'ERROR' | 'WARNING', message: string, details?: any) {
  results.push({ check, status, message, details });
  const emoji = status === 'OK' ? '✅' : status === 'ERROR' ? '❌' : '⚠️';
  console.log(`${emoji} ${check}: ${message}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
}

async function checkTable(tableName: string) {
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      await log(`Table: ${tableName}`, 'ERROR', `Error accessing table: ${error.message}`, error);
      return false;
    }

    await log(`Table: ${tableName}`, 'OK', `Table exists with ${count ?? 0} rows`);
    return true;
  } catch (err) {
    await log(`Table: ${tableName}`, 'ERROR', `Exception checking table: ${err}`, err);
    return false;
  }
}

async function checkSubscriptionPlans() {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('slug, name, is_active');

    if (error) {
      await log('Subscription Plans', 'ERROR', `Cannot query plans: ${error.message}`, error);
      return;
    }

    const expectedPlans = ['free', 'pro', 'enterprise'];
    const existingPlans = data?.map(p => p.slug) || [];
    const missingPlans = expectedPlans.filter(p => !existingPlans.includes(p));

    if (missingPlans.length > 0) {
      await log('Subscription Plans', 'ERROR', `Missing plans: ${missingPlans.join(', ')}`, data);
    } else {
      await log('Subscription Plans', 'OK', `All 3 plans exist: ${existingPlans.join(', ')}`, data);
    }
  } catch (err) {
    await log('Subscription Plans', 'ERROR', `Exception checking plans: ${err}`, err);
  }
}

async function checkRLSPolicies() {
  try {
    const { data, error } = await supabase.rpc('get_policies_info' as any);

    if (error) {
      await log('RLS Policies', 'WARNING', 'Cannot query RLS policies directly (expected)', { note: 'RLS policies require direct SQL access' });
    } else {
      await log('RLS Policies', 'OK', 'RLS policies checked', data);
    }
  } catch (err) {
    await log('RLS Policies', 'WARNING', 'Cannot verify RLS policies from client', { note: 'This is normal - requires admin access' });
  }
}

async function testAnonymousAccess() {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .limit(1);

    if (error) {
      await log('Anonymous Access', 'ERROR', `Cannot read subscription_plans as anon: ${error.message}`, error);
    } else {
      await log('Anonymous Access', 'OK', 'Can read subscription_plans without auth', data);
    }
  } catch (err) {
    await log('Anonymous Access', 'ERROR', `Exception testing anonymous access: ${err}`, err);
  }
}

async function checkAuthConfiguration() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      await log('Auth Configuration', 'WARNING', `Auth session error: ${error.message}`, error);
    } else if (session) {
      await log('Auth Configuration', 'OK', `User is authenticated: ${session.user.email}`);
    } else {
      await log('Auth Configuration', 'OK', 'Not authenticated (expected for diagnosis)');
    }
  } catch (err) {
    await log('Auth Configuration', 'ERROR', `Exception checking auth: ${err}`, err);
  }
}

async function simulateUserRegistration() {
  console.log('\n🔍 Simulating user registration flow...\n');

  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'Test123456!';
  const testData = {
    full_name: 'Test User',
    company_name: 'Test Company',
    company_slug: `test-company-${Date.now()}`
  };

  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: testData
      }
    });

    if (error) {
      await log('Registration Simulation', 'ERROR', `Registration failed: ${error.message}`, { error, testData });
      return;
    }

    if (!data.user) {
      await log('Registration Simulation', 'ERROR', 'Registration returned no user', data);
      return;
    }

    await log('Registration Simulation', 'OK', `User created: ${data.user.id}`, { userId: data.user.id });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      await log('Profile Verification', 'ERROR', `Cannot verify profile: ${profileError.message}`, profileError);
    } else if (!profile) {
      await log('Profile Verification', 'ERROR', 'Profile was not created by trigger', { userId: data.user.id });
    } else {
      await log('Profile Verification', 'OK', 'Profile created successfully', profile);
    }

    if (data.user) {
      await supabase.auth.admin.deleteUser(data.user.id);
      await log('Cleanup', 'OK', 'Test user cleaned up');
    }

  } catch (err) {
    await log('Registration Simulation', 'ERROR', `Exception during simulation: ${err}`, err);
  }
}

async function runDiagnostics() {
  console.log('🔍 Starting Supabase Database Diagnostics\n');
  console.log(`URL: ${supabaseUrl}`);
  console.log(`Using: ${supabaseKey ? 'ANON KEY' : 'NO KEY'}\n`);

  await checkAuthConfiguration();

  console.log('\n📊 Checking Tables...\n');
  await checkTable('companies');
  await checkTable('profiles');
  await checkTable('subscription_plans');
  await checkTable('company_subscriptions');

  console.log('\n🔐 Checking Data...\n');
  await checkSubscriptionPlans();
  await testAnonymousAccess();

  console.log('\n🔒 Checking Security...\n');
  await checkRLSPolicies();

  await simulateUserRegistration();

  console.log('\n' + '='.repeat(80));
  console.log('📋 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(80) + '\n');

  const errors = results.filter(r => r.status === 'ERROR');
  const warnings = results.filter(r => r.status === 'WARNING');
  const ok = results.filter(r => r.status === 'OK');

  console.log(`✅ Passed: ${ok.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);
  console.log(`❌ Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES:\n');
    errors.forEach(err => {
      console.log(`   • ${err.check}: ${err.message}`);
    });
  }

  console.log('\n' + '='.repeat(80) + '\n');

  process.exit(errors.length > 0 ? 1 : 0);
}

runDiagnostics().catch(err => {
  console.error('Fatal error running diagnostics:', err);
  process.exit(1);
});
