/**
 * Script para diagnosticar y corregir precios huérfanos en Materiales Rígidos
 *
 * Este script te permite:
 * 1. Ver todos los precios que no tienen configuración válida
 * 2. Recrear las combinaciones faltantes (recomendado)
 * 3. Eliminar los precios huérfanos (solo si es necesario)
 *
 * Uso:
 * 1. npm install -D tsx (si no lo tienes)
 * 2. npx tsx scripts/fix-materiales-rigidos-huerfanos.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Variables de entorno no configuradas');
  console.error('Asegúrate de tener VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function diagnosticar() {
  console.log('\n🔍 Diagnosticando precios huérfanos...\n');

  const { data, error } = await supabase.rpc('fn_diagnosticar_precios_huerfanos_mr');

  if (error) {
    console.error('❌ Error:', error.message);
    return [];
  }

  if (!data || data.length === 0) {
    console.log('✅ ¡Excelente! No se encontraron precios huérfanos.');
    return [];
  }

  console.log(`⚠️  Se encontraron ${data.length} precios huérfanos:\n`);

  data.forEach((precio: any, index: number) => {
    console.log(`${index + 1}. Producto: ${precio.producto_nombre}`);
    console.log(`   Material: ${precio.material_nombre}`);
    console.log(`   Variante: ${precio.variante_nombre}`);
    console.log(`   Espesor: ${precio.espesor ? `${precio.espesor}mm` : 'N/A'}`);
    console.log(`   Precio: $${precio.precio_placa}`);
    console.log(`   Creado: ${new Date(precio.created_at).toLocaleDateString()}`);
    console.log('');
  });

  return data;
}

async function recrearCombinaciones() {
  console.log('\n🔧 Recreando combinaciones faltantes...\n');

  const { data, error } = await supabase.rpc('fn_recrear_combinaciones_faltantes_mr');

  if (error) {
    console.error('❌ Error:', error.message);
    return false;
  }

  console.log(`✅ ${data.mensaje}`);
  return true;
}

async function eliminarHuerfanos() {
  console.log('\n🗑️  Eliminando precios huérfanos...\n');

  const { data, error } = await supabase.rpc('fn_eliminar_precios_huerfanos_mr');

  if (error) {
    console.error('❌ Error:', error.message);
    return false;
  }

  console.log(`✅ ${data.mensaje}`);
  return true;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  🛠️  Reparación de Precios Huérfanos');
  console.log('     Materiales Rígidos');
  console.log('═══════════════════════════════════════════════════');

  const huerfanos = await diagnosticar();

  if (huerfanos.length === 0) {
    rl.close();
    return;
  }

  console.log('\n¿Qué deseas hacer?');
  console.log('1. Recrear combinaciones faltantes (RECOMENDADO)');
  console.log('2. Eliminar precios huérfanos');
  console.log('3. Salir sin hacer cambios\n');

  const opcion = await question('Selecciona una opción (1-3): ');

  switch (opcion.trim()) {
    case '1':
      const confirmRecrear = await question('\n⚠️  ¿Estás seguro? Esto creará nuevas entradas en la tabla de materiales. (s/n): ');
      if (confirmRecrear.toLowerCase() === 's') {
        const success = await recrearCombinaciones();
        if (success) {
          console.log('\n✅ ¡Listo! Ahora puedes aplicar aumentos masivos sin problemas.');
        }
      } else {
        console.log('\nOperación cancelada.');
      }
      break;

    case '2':
      const confirmEliminar = await question('\n⚠️  ¿ESTÁS SEGURO? Esta acción NO SE PUEDE DESHACER. (s/n): ');
      if (confirmEliminar.toLowerCase() === 's') {
        const confirmEliminar2 = await question('Escribe "ELIMINAR" para confirmar: ');
        if (confirmEliminar2 === 'ELIMINAR') {
          const success = await eliminarHuerfanos();
          if (success) {
            console.log('\n✅ Precios eliminados.');
          }
        } else {
          console.log('\nOperación cancelada.');
        }
      } else {
        console.log('\nOperación cancelada.');
      }
      break;

    case '3':
      console.log('\nSaliendo sin hacer cambios.');
      break;

    default:
      console.log('\n❌ Opción no válida.');
  }

  rl.close();
}

main().catch(console.error);
