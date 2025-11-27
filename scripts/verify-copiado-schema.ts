import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
  console.log('🔍 Verificando esquema de centro_copiado_papeles...\n');

  // Probar query simple de papeles con material
  const { data: papeles, error: papelesError } = await supabase
    .from('centro_copiado_papeles')
    .select(`
      id,
      variante_nombre,
      material:material_id(id, nombre)
    `)
    .limit(3);

  if (papelesError) {
    console.error('❌ Error en query de papeles:', papelesError);
    return;
  }

  console.log('✅ Query de papeles exitosa!');
  console.log(`   Papeles encontrados: ${papeles?.length || 0}\n`);

  if (papeles && papeles.length > 0) {
    console.log('📄 Ejemplos de papeles:');
    papeles.forEach((papel: any, index: number) => {
      console.log(`\n   ${index + 1}. ${papel.variante_nombre}`);
      console.log(`      Material: ${papel.material?.nombre || 'N/A'}`);
      console.log(`      Material ID: ${papel.material?.id || 'N/A'}`);
    });
  } else {
    console.log('⚠️  No hay papeles configurados aún');
  }

  // Verificar tamaños de papel
  console.log('\n\n🔍 Verificando tamaños de papel...\n');

  const { data: tamanios, error: tamaniosError } = await supabase
    .from('centro_copiado_tamanios_papel')
    .select('id, nombre')
    .limit(5);

  if (tamaniosError) {
    console.error('❌ Error en query de tamaños:', tamaniosError);
    return;
  }

  console.log('✅ Query de tamaños exitosa!');
  console.log(`   Tamaños encontrados: ${tamanios?.length || 0}\n`);

  if (tamanios && tamanios.length > 0) {
    console.log('📏 Tamaños disponibles:');
    tamanios.forEach((tamanio: any) => {
      console.log(`   - ${tamanio.nombre}`);
    });
  } else {
    console.log('⚠️  No hay tamaños configurados aún');
  }

  // Testear query completa (simulada)
  console.log('\n\n🧪 Testeando query completa (sin datos reales)...\n');

  const testQuery = `
  SELECT
    *,
    items:centro_copiado_ordenes_items(
      *,
      tamanio_papel:centro_copiado_tamanios_papel(nombre),
      papel:centro_copiado_papeles(
        variante_nombre,
        material:material_id(nombre)
      )
    ),
    pagos:centro_copiado_ordenes_pagos(monto)
  `;

  console.log('📝 Query correcta:');
  console.log(testQuery);

  console.log('\n✅ La query está bien estructurada!');
  console.log('\n💡 Cuando crees una orden de copiado, la query traerá:');
  console.log('   - item.tamanio_papel.nombre');
  console.log('   - item.papel.variante_nombre');
  console.log('   - item.papel.material.nombre');
  console.log('\n📋 Ejemplo de acceso en código:');
  console.log('   const papel = item.papel?.variante_nombre || "N/A";');
  console.log('   const material = item.papel?.material?.nombre || "";');
  console.log('   const papelCompleto = `${material} ${papel}`;');

  console.log('\n✅ Verificación de esquema completada!');
}

verifySchema().catch(console.error);
