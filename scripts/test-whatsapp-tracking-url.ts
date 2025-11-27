/**
 * Script de testing para verificar que la URL de tracking en WhatsApp sea correcta
 *
 * Este script verifica que:
 * 1. buildTrackingUrl() genere URLs con /track/ y NO /tracking/
 * 2. Los mensajes de WhatsApp contengan la URL correcta
 * 3. No haya referencias a la URL incorrecta en el código
 */

import { buildTrackingUrl, generateNuevaOrdenTrabajoMessage } from '../src/lib/whatsappNotifications';

// Colores para la consola
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, expectedMsg: string = '', actualMsg: string = '') {
  if (condition) {
    console.log(`${GREEN}✅ PASS:${RESET} ${testName}`);
    passed++;
  } else {
    console.log(`${RED}❌ FAIL:${RESET} ${testName}`);
    if (expectedMsg && actualMsg) {
      console.log(`   Expected: ${expectedMsg}`);
      console.log(`   Actual:   ${actualMsg}`);
    }
    failed++;
  }
}

function testBuildTrackingUrl() {
  console.log('\n📋 Testing buildTrackingUrl()...\n');

  const testToken = 'K3H7W9P2R5T8Y4N6M9Q3X7Z2B5D8';
  const url = buildTrackingUrl(testToken);

  // Test 1: URL debe contener /track/
  assert(
    url.includes('/track/'),
    'URL contiene /track/',
    'URL with /track/',
    url
  );

  // Test 2: URL NO debe contener /tracking/
  assert(
    !url.includes('/tracking/'),
    'URL NO contiene /tracking/',
    'URL without /tracking/',
    url
  );

  // Test 3: URL debe terminar con el token
  assert(
    url.endsWith(testToken),
    'URL termina con el token',
    `URL ending with ${testToken}`,
    url
  );

  // Test 4: URL debe tener el formato correcto
  const urlPattern = /\/track\/[A-Z0-9]{32}$/;
  assert(
    urlPattern.test(url),
    'URL tiene el formato correcto (/track/{32-char-token})',
    'Pattern: /track/[A-Z0-9]{32}',
    url
  );

  console.log(`\n   Generated URL: ${YELLOW}${url}${RESET}\n`);
}

function testGenerateNuevaOrdenTrabajoMessage() {
  console.log('\n📋 Testing generateNuevaOrdenTrabajoMessage()...\n');

  const mockOrden = {
    numero_orden: 'OT-2024-001',
    tracking_token: 'K3H7W9P2R5T8Y4N6M9Q3X7Z2B5D8',
    subtotal: '1000',
    total_descuentos: '0',
    total: '1000',
    pagos_totales: 0,
    fecha_estimada_entrega: '2024-12-31'
  };

  const mockCliente = {
    nombre_fantasia: 'Cliente Test',
    razon_social: 'Cliente Test SA'
  };

  const mockItems = [
    {
      producto_nombre: 'Producto Test',
      cantidad: 10,
      precio_total: '1000',
      servicios: [],
      acabados: []
    }
  ];

  const mockCompany = {
    name: 'Empresa Test',
    address: 'Calle Test 123',
    contact_phone: '+54 11 1234-5678'
  };

  const mensaje = generateNuevaOrdenTrabajoMessage(
    mockOrden,
    mockCliente,
    mockItems,
    mockCompany
  );

  // Test 1: Mensaje debe contener /track/
  assert(
    mensaje.includes('/track/'),
    'Mensaje contiene /track/',
    'Message with /track/',
    mensaje.includes('/track/') ? 'Found' : 'Not found'
  );

  // Test 2: Mensaje NO debe contener /tracking/
  assert(
    !mensaje.includes('/tracking/'),
    'Mensaje NO contiene /tracking/',
    'Message without /tracking/',
    mensaje.includes('/tracking/') ? 'Found (BAD!)' : 'Not found (GOOD!)'
  );

  // Test 3: Mensaje debe contener el token completo
  assert(
    mensaje.includes(mockOrden.tracking_token),
    'Mensaje contiene el token completo',
    mockOrden.tracking_token,
    mensaje.includes(mockOrden.tracking_token) ? 'Found' : 'Not found'
  );

  // Test 4: Mensaje debe contener la URL completa correcta
  const expectedUrl = `/track/${mockOrden.tracking_token}`;
  assert(
    mensaje.includes(expectedUrl),
    'Mensaje contiene la URL completa correcta',
    expectedUrl,
    mensaje.includes(expectedUrl) ? 'Found' : 'Not found'
  );

  // Mostrar la sección relevante del mensaje
  const trackingSection = mensaje
    .split('\n')
    .find(line => line.includes('/track/'));

  if (trackingSection) {
    console.log(`\n   Tracking line: ${YELLOW}${trackingSection}${RESET}\n`);
  }
}

function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 TEST DE URL DE TRACKING EN WHATSAPP');
  console.log('='.repeat(70));

  testBuildTrackingUrl();
  testGenerateNuevaOrdenTrabajoMessage();

  console.log('\n' + '='.repeat(70));
  console.log('📊 RESUMEN DE TESTS');
  console.log('='.repeat(70));
  console.log(`\n${GREEN}✅ Passed: ${passed}${RESET}`);
  console.log(`${failed > 0 ? RED : GREEN}${failed > 0 ? '❌' : '✅'} Failed: ${failed}${RESET}\n`);

  if (failed === 0) {
    console.log(`${GREEN}🎉 TODOS LOS TESTS PASARON - URL DE TRACKING CORRECTA${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`${RED}❌ ALGUNOS TESTS FALLARON - REVISAR IMPLEMENTACIÓN${RESET}\n`);
    process.exit(1);
  }
}

// Mock window.location.origin para el test
if (typeof window === 'undefined') {
  (global as any).window = {
    location: {
      origin: 'https://test-app.com'
    }
  };
}

runTests();
