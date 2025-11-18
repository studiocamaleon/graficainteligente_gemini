import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testImpresionLaserForm() {
  console.log('=== TESTING PROFUNDO: Formulario Impresión Láser ===\n');

  // 1. Verificar si hay empresas registradas
  console.log('1. Verificando empresas...');
  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('id, name')
    .limit(3);

  if (compError) {
    console.error('Error empresas:', compError);
    return;
  }

  if (!companies || companies.length === 0) {
    console.log('❌ NO HAY EMPRESAS REGISTRADAS');
    return;
  }

  console.log(`✅ Empresas encontradas: ${companies.length}`);
  const testCompanyId = companies[0].id;
  console.log(`   Usando empresa: ${companies[0].name} (${testCompanyId})\n`);

  // 2. Verificar categorías del sistema
  console.log('2. Verificando categoría Impresión Láser...');
  const { data: categoria, error: catError } = await supabase
    .from('categorias')
    .select('id, nombre, company_id, is_system_category')
    .ilike('nombre', '%impresion%laser%')
    .maybeSingle();

  if (catError) {
    console.error('Error categoría:', catError);
  } else if (!categoria) {
    console.log('❌ CATEGORÍA IMPRESIÓN LÁSER NO EXISTE');
  } else {
    console.log(`✅ Categoría encontrada: ${categoria.nombre}`);
    console.log(`   company_id: ${categoria.company_id}`);
    console.log(`   is_system_category: ${categoria.is_system_category}\n`);
  }

  // 3. Verificar materiales de la empresa
  console.log('3. Verificando materiales de la empresa...');
  const { data: materiales, error: matError } = await supabase
    .from('materiales')
    .select('id, nombre, company_id, aplica_espesor, variantes, is_active')
    .eq('company_id', testCompanyId)
    .eq('is_active', true);

  if (matError) {
    console.error('Error materiales:', matError);
  } else if (!materiales || materiales.length === 0) {
    console.log('❌ NO HAY MATERIALES para esta empresa');
    console.log('   Verificando si hay materiales en otras empresas...');

    const { data: otrosMat } = await supabase
      .from('materiales')
      .select('company_id, count')
      .not('company_id', 'is', null)
      .limit(5);

    console.log('   Materiales en BD:', otrosMat);
  } else {
    console.log(`✅ Materiales encontrados: ${materiales.length}`);
    console.log(`   Ejemplo: ${materiales[0].nombre}`);
    console.log(`   Variantes:`, materiales[0].variantes);
  }

  // 4. Verificar tecnologías de la empresa
  console.log('\n4. Verificando tecnologías de la empresa...');
  const { data: tecnologias, error: tecError } = await supabase
    .from('tecnologias')
    .select('id, nombre, company_id, tintas, is_active')
    .eq('company_id', testCompanyId)
    .eq('is_active', true);

  if (tecError) {
    console.error('Error tecnologías:', tecError);
  } else if (!tecnologias || tecnologias.length === 0) {
    console.log('❌ NO HAY TECNOLOGÍAS para esta empresa');
    console.log('   Verificando tecnologías con "laser" en cualquier empresa...');

    const { data: tecLaser } = await supabase
      .from('tecnologias')
      .select('id, nombre, company_id, tintas')
      .ilike('nombre', '%laser%');

    console.log('   Tecnologías Láser en BD:', tecLaser);
  } else {
    console.log(`✅ Tecnologías encontradas: ${tecnologias.length}`);
    const tecLaser = tecnologias.find(t => t.nombre.toLowerCase().includes('laser'));
    if (tecLaser) {
      console.log(`   Tecnología Láser: ${tecLaser.nombre}`);
      console.log(`   Tintas:`, tecLaser.tintas);
    }
  }

  // 5. Verificar servicios relacionados con la categoría
  if (categoria) {
    console.log('\n5. Verificando servicios para Impresión Láser...');
    const { data: serviciosRel } = await supabase
      .from('servicios_categorias')
      .select('servicio_id')
      .eq('categoria_id', categoria.id);

    if (serviciosRel && serviciosRel.length > 0) {
      const servicioIds = serviciosRel.map(r => r.servicio_id);
      const { data: servicios } = await supabase
        .from('servicios')
        .select('id, nombre, company_id, is_active')
        .in('id', servicioIds)
        .eq('company_id', testCompanyId)
        .eq('is_active', true);

      if (!servicios || servicios.length === 0) {
        console.log('❌ NO HAY SERVICIOS para esta empresa en esta categoría');
      } else {
        console.log(`✅ Servicios encontrados: ${servicios.length}`);
        console.log(`   Ejemplos: ${servicios.slice(0, 3).map(s => s.nombre).join(', ')}`);
      }
    } else {
      console.log('❌ NO HAY RELACIONES servicios-categoría');
    }

    // 6. Verificar acabados relacionados con la categoría
    console.log('\n6. Verificando acabados para Impresión Láser...');
    const { data: acabadosRel } = await supabase
      .from('acabados_categorias')
      .select('acabado_id')
      .eq('categoria_id', categoria.id);

    if (acabadosRel && acabadosRel.length > 0) {
      const acabadoIds = acabadosRel.map(r => r.acabado_id);
      const { data: acabados } = await supabase
        .from('acabados')
        .select('id, nombre, company_id, is_active')
        .in('id', acabadoIds)
        .eq('company_id', testCompanyId)
        .eq('is_active', true);

      if (!acabados || acabados.length === 0) {
        console.log('❌ NO HAY ACABADOS para esta empresa en esta categoría');
      } else {
        console.log(`✅ Acabados encontrados: ${acabados.length}`);
        console.log(`   Ejemplos: ${acabados.slice(0, 3).map(a => a.nombre).join(', ')}`);
      }
    } else {
      console.log('❌ NO HAY RELACIONES acabados-categoría');
    }
  }

  // 7. Verificar productos láser existentes
  console.log('\n7. Verificando productos láser de la empresa...');
  const { data: productos, error: prodError } = await supabase
    .from('productos_impresion_laser')
    .select('id, nombre, company_id, is_active')
    .eq('company_id', testCompanyId);

  if (prodError) {
    console.error('Error productos:', prodError);
  } else if (!productos || productos.length === 0) {
    console.log('❌ NO HAY PRODUCTOS LÁSER para esta empresa');
  } else {
    console.log(`✅ Productos encontrados: ${productos.length}`);
    console.log(`   Nombres: ${productos.map(p => p.nombre).join(', ')}`);
  }

  // RESUMEN
  console.log('\n=== RESUMEN DE PROBLEMAS ===');
  const problemas = [];

  if (!categoria) problemas.push('- Categoría Impresión Láser no existe');
  if (!materiales || materiales.length === 0) problemas.push('- No hay materiales para la empresa');
  if (!tecnologias || tecnologias.length === 0) problemas.push('- No hay tecnologías para la empresa');

  if (problemas.length === 0) {
    console.log('✅ Todos los datos necesarios están presentes');
  } else {
    console.log('❌ PROBLEMAS DETECTADOS:');
    problemas.forEach(p => console.log(p));
    console.log('\n💡 SOLUCIÓN: Crear los datos faltantes en el sistema para esta empresa');
  }

  console.log('\n=== FIN TESTING ===');
}

testImpresionLaserForm().catch(console.error);
