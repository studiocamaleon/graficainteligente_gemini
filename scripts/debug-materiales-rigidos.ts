import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMaterialesRigidos() {
  console.log('DEBUG: PRODUCTOS MATERIALES RIGIDOS');

  const { data: productos, error: prodError } = await supabase
    .from('productos_materiales_rigidos')
    .select('*')
    .order('nombre');

  if (prodError) {
    console.error('Error:', prodError.message);
    return;
  }

  if (!productos || productos.length === 0) {
    console.log('No hay productos');
    return;
  }

  console.log(`\nEncontrados ${productos.length} productos\n`);

  for (const producto of productos) {
    console.log(`\nPRODUCTO: ${producto.nombre}`);
    console.log(`ID: ${producto.id}`);
    console.log(`Activo: ${producto.is_active}`);
    console.log(`Dimensiones: ${producto.medidas_ancho} x ${producto.medidas_alto} cm`);

    const { data: materiales } = await supabase
      .from('productos_materiales_rigidos_materiales')
      .select('*')
      .eq('producto_materiales_rigidos_id', producto.id);

    if (!materiales || materiales.length === 0) {
      console.log('SIN MATERIALES CONFIGURADOS');
    } else {
      console.log(`\nMATERIALES (${materiales.length} registros):`);
      materiales.forEach(mat => {
        console.log(`  - Variante: ${mat.variante_nombre}, Espesor: ${mat.espesor}mm`);
        console.log(`    Material ID: ${mat.material_id}`);
        console.log(`    Espesores array: ${JSON.stringify(mat.espesores)}`);
      });
    }
  }

  console.log('\n\nMATERIALES BASE:');
  const { data: materialesBase } = await supabase
    .from('materiales')
    .select('*')
    .order('nombre');

  if (materialesBase) {
    materialesBase.forEach(mat => {
      console.log(`\n${mat.nombre} (${mat.id})`);
      console.log(`Variantes: ${JSON.stringify(mat.variantes)}`);
    });
  }
}

debugMaterialesRigidos().catch(console.error);
