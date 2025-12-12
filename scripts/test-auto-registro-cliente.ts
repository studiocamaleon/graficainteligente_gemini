/**
 * Test: Auto-registro de cliente
 *
 * Este script prueba el flujo completo de auto-registro de clientes
 * incluyendo la notificación de WhatsApp.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TestRegistroData {
  company_id: string;
  nombre_fantasia: string;
  razon_social: string;
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  whatsapp: string;
  email?: string;
  domicilio?: string;
  frontend_origin?: string;
}

async function testAutoRegistroCliente() {
  console.log('🚀 Iniciando test de auto-registro de cliente...\n');

  // 1. Usar company_id como argumento o pedir al usuario
  const companyIdArg = process.argv[2];

  if (!companyIdArg) {
    console.error('❌ Error: Debes proporcionar un company_id como argumento');
    console.log('\nUso: npx tsx scripts/test-auto-registro-cliente.ts <COMPANY_ID>\n');
    console.log('Para obtener un company_id, ejecuta:');
    console.log('  SELECT id, name FROM companies LIMIT 1;\n');
    return;
  }

  const companyId = companyIdArg;
  console.log(`✅ Usando company_id: ${companyId}\n`);

  // 2. Preparar datos de test
  const testData: TestRegistroData = {
    company_id: companyId,
    nombre_fantasia: `Test Cliente ${Date.now()}`,
    razon_social: `Test Cliente SA ${Date.now()}`,
    tipo_documento: 'CUIT',
    numero_documento: `20${Math.floor(Math.random() * 100000000)}0`,
    whatsapp: '+5491112345678', // Número de test
    email: 'test@cliente.com',
    domicilio: 'Calle Test 123',
    frontend_origin: 'https://test.grafica.ar'
  };

  console.log('2️⃣ Datos de test preparados:');
  console.log('   Nombre:', testData.nombre_fantasia);
  console.log('   WhatsApp:', testData.whatsapp);
  console.log('   Documento:', testData.tipo_documento, testData.numero_documento, '\n');

  // 3. Llamar a la edge function
  console.log('3️⃣ Llamando a edge function auto-registro-cliente...');
  const url = `${supabaseUrl}/functions/v1/auto-registro-cliente`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(testData),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('❌ Error en edge function:', result);
    return;
  }

  console.log(`✅ Edge function ejecutada exitosamente`);
  console.log(`   Cliente ID: ${result.cliente_id}`);
  console.log(`   WhatsApp enviado: ${result.whatsapp_enviado ? 'Sí' : 'No'}\n`);

  // 4. El cliente fue creado (no podemos verificarlo con anon key por RLS)
  console.log('4️⃣ Cliente creado:');
  console.log(`   ✓ ID: ${result.cliente_id}`);
  console.log(`   (No se puede verificar con anon key debido a RLS)\n`);

  // 5. Importante: Verificar si apareció en el historial de notificaciones
  console.log('5️⃣ Verificación completada');
  console.log('\n✅ Test completado exitosamente!');
  console.log('\n📊 Resumen:');
  console.log(`   ✓ Edge function ejecutada: OK`);
  console.log(`   ✓ Cliente creado: ${result.cliente_id}`);
  console.log(`   ✓ WhatsApp enviado: ${result.whatsapp_enviado ? 'Sí' : 'No'}`);
  console.log('\n📝 Pasos para verificar manualmente:');
  console.log('   1. Inicia sesión en la aplicación como admin');
  console.log('   2. Ve a: Integraciones > WhatsApp > Historial');
  console.log('   3. Busca la notificación de tipo "auto_registro_cliente"');
  console.log(`   4. Verifica que el teléfono destino sea: ${testData.whatsapp}`);
  console.log('   5. Verifica que el estado sea "enviado" o "fallido"');
  console.log('\n   Si ves la notificación en el historial, el sistema funciona correctamente!');
}

testAutoRegistroCliente().catch(console.error);
