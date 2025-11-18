import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTecnologias() {
  console.log('=== Debug Tecnologías ===\n');

  const { data: productos, error: prodError } = await supabase
    .from('productos_impresion_laser')
    .select('id, nombre')
    .limit(5);

  if (prodError) {
    console.error('Error al obtener productos:', prodError);
    return;
  }

  console.log('Productos encontrados:', productos?.length);
  console.log('Productos:', JSON.stringify(productos, null, 2));

  if (productos && productos.length > 0) {
    const productoId = productos[0].id;
    console.log(`\n=== Analizando producto: ${productos[0].nombre} (${productoId}) ===\n`);

    const { data: tecnologias, error: tecError } = await supabase
      .from('productos_impresion_laser_tecnologias')
      .select('*')
      .eq('producto_laser_id', productoId);

    console.log('Tecnologías raw:', JSON.stringify(tecnologias, null, 2));
    if (tecError) console.error('Error tecnologías:', tecError);

    const { data: tecnologiasJoin, error: tecJoinError } = await supabase
      .from('productos_impresion_laser_tecnologias')
      .select('id, tecnologia_id, tintas, tecnologias(nombre)')
      .eq('producto_laser_id', productoId);

    console.log('\nTecnologías con JOIN:', JSON.stringify(tecnologiasJoin, null, 2));
    if (tecJoinError) console.error('Error JOIN:', tecJoinError);

    const { data: allTecnologias, error: allTecError } = await supabase
      .from('tecnologias')
      .select('id, nombre, is_active')
      .limit(10);

    console.log('\nTodas las tecnologías disponibles:', JSON.stringify(allTecnologias, null, 2));
    if (allTecError) console.error('Error all tecnologías:', allTecError);
  }
}

debugTecnologias().catch(console.error);
