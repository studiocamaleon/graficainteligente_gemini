import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function listAllProducts() {
  console.log('=== Listado de Productos por Categoría ===\n');

  // Impresión Láser
  const { data: laser, error: laserError } = await supabase
    .from('productos_impresion_laser')
    .select('id, nombre')
    .limit(5);

  console.log('📄 Impresión Láser:', laser?.length || 0);
  laser?.forEach(p => console.log(`   - ${p.nombre} (${p.id})`));

  // Gran Formato
  const { data: granFormato, error: gfError } = await supabase
    .from('productos_gran_formato')
    .select('id, nombre')
    .limit(5);

  console.log('\n🖨️  Gran Formato:', granFormato?.length || 0);
  granFormato?.forEach(p => console.log(`   - ${p.nombre} (${p.id})`));

  // Materiales Rígidos
  const { data: materialesRigidos, error: mrError } = await supabase
    .from('productos_materiales_rigidos')
    .select('id, nombre')
    .limit(5);

  console.log('\n📦 Materiales Rígidos:', materialesRigidos?.length || 0);
  materialesRigidos?.forEach(p => console.log(`   - ${p.nombre} (${p.id})`));

  // Plotter de Corte
  const { data: plotterCorte, error: pcError } = await supabase
    .from('productos_plotter_corte')
    .select('id, nombre')
    .limit(5);

  console.log('\n✂️  Plotter de Corte:', plotterCorte?.length || 0);
  plotterCorte?.forEach(p => console.log(`   - ${p.nombre} (${p.id})`));

  // Portabanners
  const { data: portabanners, error: pbError } = await supabase
    .from('productos_portabanners')
    .select('id, nombre')
    .limit(5);

  console.log('\n🏴 Portabanners:', portabanners?.length || 0);
  portabanners?.forEach(p => console.log(`   - ${p.nombre} (${p.id})`));

  // Sellos
  const { data: sellos, error: sError } = await supabase
    .from('productos_sellos')
    .select('id, nombre')
    .limit(5);

  console.log('\n🔖 Sellos:', sellos?.length || 0);
  sellos?.forEach(p => console.log(`   - ${p.nombre} (${p.id})`));

  // Si encontramos algún producto, testeamos la configuración
  if (granFormato && granFormato.length > 0) {
    console.log('\n\n=== Test de Configuración: Gran Formato ===');
    const producto = granFormato[0];

    const { data: tecnologias } = await supabase
      .from('productos_gran_formato_tecnologias')
      .select(`
        id,
        tecnologia_id,
        tintas,
        tecnologias!inner(id, nombre)
      `)
      .eq('producto_gran_formato_id', producto.id);

    console.log('\nProducto:', producto.nombre);
    console.log('Tecnologías:', tecnologias?.length || 0);

    tecnologias?.forEach((tec: any) => {
      console.log(`\n  Tecnología: ${tec.tecnologias.nombre}`);
      console.log(`  Tintas: ${JSON.stringify(tec.tintas)}`);
      console.log(`  Tipo: ${typeof tec.tintas}, Es array: ${Array.isArray(tec.tintas)}`);
    });
  }
}

listAllProducts().catch(console.error);
