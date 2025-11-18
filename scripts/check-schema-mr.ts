import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('=== VERIFICANDO SCHEMA DE TABLAS ===\n');
  
  const { data: materiales, error: matError } = await supabase
    .from('productos_materiales_rigidos_materiales')
    .select('*');
  
  console.log('1. Registros en productos_materiales_rigidos_materiales:', materiales?.length || 0);
  if (materiales && materiales.length > 0) {
    console.log('Estructura del primer registro:');
    console.log(JSON.stringify(materiales[0], null, 2));
    console.log('Columnas:', Object.keys(materiales[0]));
  }
  if (matError) console.log('Error:', matError.message);
  
  const { data: productos, error: prodError } = await supabase
    .from('productos_materiales_rigidos')
    .select('*');
    
  console.log('\n2. Productos base:', productos?.length || 0);
  if (productos && productos.length > 0) {
    productos.forEach(p => {
      console.log('  -', p.nombre);
    });
  }
  if (prodError) console.log('Error:', prodError.message);
  
  const { data: precios, error: preciosError } = await supabase
    .from('productos_materiales_rigidos_precios')
    .select('*');
    
  console.log('\n3. Precios:', precios?.length || 0);
  if (precios && precios.length > 0) {
    console.log('Estructura del primer precio:');
    console.log(JSON.stringify(precios[0], null, 2));
    console.log('Columnas:', Object.keys(precios[0]));
  }
  if (preciosError) console.log('Error:', preciosError.message);
}

checkSchema()
  .then(() => {
    console.log('\nCompletado');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
