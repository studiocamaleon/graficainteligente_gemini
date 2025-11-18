import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProductoOperations() {
  console.log('🧪 Iniciando pruebas de operaciones de productos...\n');

  try {
    // 1. Listar productos de Impresión Laser
    console.log('1️⃣ Listando productos de Impresión Laser...');
    const { data: productos, error: listError } = await supabase
      .from('productos_impresion_laser')
      .select('*')
      .limit(5);

    if (listError) {
      console.error('❌ Error al listar productos:', listError);
      return;
    }

    console.log(`✅ Encontrados ${productos?.length || 0} productos`);

    if (!productos || productos.length === 0) {
      console.log('⚠️  No hay productos para probar');
      return;
    }

    const productoId = productos[0].id;
    console.log(`📦 Usando producto: ${productos[0].nombre} (${productoId})\n`);

    // 2. Obtener producto completo con relaciones
    console.log('2️⃣ Obteniendo producto completo con relaciones...');

    const [tecnologiasRes, serviciosRes, acabadosRes, pricingRes, rutasRes] =
      await Promise.all([
        supabase
          .from('productos_tecnologias')
          .select(`
            id,
            producto_tipo,
            producto_id,
            tecnologia_id,
            tintas,
            tecnologia:tecnologias(id, nombre, tintas)
          `)
          .eq('producto_tipo', 'laser')
          .eq('producto_id', productoId),
        supabase
          .from('productos_servicios')
          .select(`
            id,
            producto_tipo,
            producto_id,
            servicio_id,
            is_active,
            servicio:servicios(id, nombre)
          `)
          .eq('producto_tipo', 'laser')
          .eq('producto_id', productoId),
        supabase
          .from('productos_acabados')
          .select(`
            id,
            producto_tipo,
            producto_id,
            acabado_id,
            is_active,
            acabado:acabados(id, nombre)
          `)
          .eq('producto_tipo', 'laser')
          .eq('producto_id', productoId),
        supabase
          .from('productos_precios')
          .select('*')
          .eq('producto_tipo', 'laser')
          .eq('producto_id', productoId),
        supabase
          .from('productos_rutas_plantillas')
          .select(`
            id,
            producto_id,
            tipo_etapa,
            orden,
            paso_id,
            grupo_paso_id,
            paso:pasos(id, nombre),
            grupo_paso:grupos_pasos(id, nombre)
          `)
          .eq('producto_id', productoId)
          .order('orden', { ascending: true }),
      ]);

    if (tecnologiasRes.error) {
      console.error('❌ Error al obtener tecnologías:', tecnologiasRes.error);
      return;
    }
    if (serviciosRes.error) {
      console.error('❌ Error al obtener servicios:', serviciosRes.error);
      return;
    }
    if (acabadosRes.error) {
      console.error('❌ Error al obtener acabados:', acabadosRes.error);
      return;
    }
    if (pricingRes.error) {
      console.error('❌ Error al obtener precios:', pricingRes.error);
      return;
    }
    if (rutasRes.error) {
      console.error('❌ Error al obtener rutas de plantillas:', rutasRes.error);
      return;
    }

    console.log('✅ Producto completo obtenido exitosamente:');
    console.log(`   - Tecnologías: ${tecnologiasRes.data?.length || 0}`);
    console.log(`   - Servicios: ${serviciosRes.data?.length || 0}`);
    console.log(`   - Acabados: ${acabadosRes.data?.length || 0}`);
    console.log(`   - Precios: ${pricingRes.data?.length || 0}`);
    console.log(`   - Rutas de plantillas: ${rutasRes.data?.length || 0}\n`);

    // 3. Verificar estructura de medidas
    console.log('3️⃣ Verificando estructura de medidas...');
    const medidas = productos[0].medidas_disponibles;
    console.log(`✅ Medidas disponibles:`, medidas);
    console.log(`   Tipo: ${Array.isArray(medidas) ? 'Array (correcto)' : typeof medidas}\n`);

    console.log('✅ ¡Todas las pruebas pasaron exitosamente!');
    console.log('\n📝 Resumen:');
    console.log('   - Lectura de productos: OK');
    console.log('   - Lectura de relaciones polimórficas: OK');
    console.log('   - Lectura de rutas de plantillas (sin producto_tipo): OK');
    console.log('   - Estructura de datos: OK');

  } catch (error) {
    console.error('❌ Error inesperado:', error);
  }
}

testProductoOperations();
