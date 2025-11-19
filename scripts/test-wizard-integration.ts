import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testWizardIntegration() {
  console.log('🧪 Probando integración del Wizard Universal\n');

  try {
    // 1. Verificar que existan productos en cada categoría
    console.log('📦 Verificando productos por categoría...\n');

    const categorias = [
      { nombre: 'Impresion Laser', tabla: 'productos_impresion_laser' },
      { nombre: 'Impresion Gran Formato', tabla: 'productos_gran_formato' },
      { nombre: 'Materiales Rigidos', tabla: 'productos_materiales_rigidos' },
      { nombre: 'Plotter de Corte', tabla: 'productos_plotter_corte' },
      { nombre: 'Portabanners', tabla: 'productos_portabanners' },
      { nombre: 'Sellos', tabla: 'productos_sellos' }
    ];

    for (const cat of categorias) {
      const { count, error } = await supabase
        .from(cat.tabla)
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      if (error) {
        console.log(`❌ ${cat.nombre}: Error - ${error.message}`);
      } else {
        console.log(`✅ ${cat.nombre}: ${count || 0} productos activos`);
      }
    }

    // 2. Probar búsqueda universal
    console.log('\n🔍 Probando búsqueda universal...\n');

    const searchTerms = ['a', 'tarjeta', 'banner'];

    for (const term of searchTerms) {
      let totalFound = 0;

      for (const cat of categorias) {
        const { data, error } = await supabase
          .from(cat.tabla)
          .select('id, nombre')
          .eq('is_active', true)
          .ilike('nombre', `%${term}%`)
          .limit(5);

        if (!error && data) {
          totalFound += data.length;
          if (data.length > 0) {
            console.log(`  ${cat.nombre}: ${data.length} resultado(s)`);
            data.forEach(p => console.log(`    - ${p.nombre}`));
          }
        }
      }

      if (totalFound === 0) {
        console.log(`  No se encontraron productos para "${term}"`);
      }
      console.log('');
    }

    // 3. Verificar estructura de precios por categoría
    console.log('💰 Verificando tablas de precios...\n');

    const preciosTablas = [
      { categoria: 'Impresion Laser', tabla: 'productos_impresion_laser_precios' },
      { categoria: 'Impresion Gran Formato', tabla: 'productos_gran_formato_precios' },
      { categoria: 'Materiales Rigidos', tabla: 'productos_materiales_rigidos_precios' },
      { categoria: 'Plotter de Corte', tabla: 'productos_plotter_corte_precios' },
      { categoria: 'Portabanners', tabla: 'productos_portabanners_precios' },
      { categoria: 'Sellos', tabla: 'productos_sellos_precios' }
    ];

    for (const precio of preciosTablas) {
      const { count, error } = await supabase
        .from(precio.tabla)
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${precio.categoria}: Tabla no existe o error`);
      } else {
        console.log(`✅ ${precio.categoria}: ${count || 0} precios configurados`);
      }
    }

    // 4. Verificar relaciones de servicios y acabados
    console.log('\n🔧 Verificando servicios y acabados disponibles...\n');

    const { data: servicios } = await supabase
      .from('servicios')
      .select('id, nombre')
      .eq('is_active', true)
      .limit(5);

    const { data: acabados } = await supabase
      .from('acabados')
      .select('id, nombre')
      .eq('is_active', true)
      .limit(5);

    console.log(`✅ Servicios activos: ${servicios?.length || 0}`);
    if (servicios && servicios.length > 0) {
      servicios.forEach(s => console.log(`  - ${s.nombre}`));
    }

    console.log(`\n✅ Acabados activos: ${acabados?.length || 0}`);
    if (acabados && acabados.length > 0) {
      acabados.forEach(a => console.log(`  - ${a.nombre}`));
    }

    console.log('\n✅ Test completado exitosamente\n');

  } catch (error) {
    console.error('\n❌ Error en el test:', error);
    process.exit(1);
  }
}

testWizardIntegration();
