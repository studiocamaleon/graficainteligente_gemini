import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugProductosLaser() {
  console.log('=== DEBUG: Productos Impresión Láser ===\n');

  console.log('1. Verificando categorías (incluyendo system data)...');
  const { data: categorias, error: catError } = await supabase
    .from('categorias')
    .select('id, nombre, company_id')
    .ilike('nombre', '%impresion%laser%');

  if (catError) {
    console.error('Error categorías:', catError);
  } else {
    console.log('Categorías encontradas:', categorias);
  }

  console.log('\n2. Verificando materiales activos (incluyendo system data)...');
  const { data: materiales, error: matError } = await supabase
    .from('materiales')
    .select('id, nombre, aplica_espesor, variantes, is_active, company_id')
    .eq('is_active', true)
    .limit(3);

  if (matError) {
    console.error('Error materiales:', matError);
  } else {
    console.log('Materiales encontrados:', materiales?.length || 0);
    if (materiales && materiales.length > 0) {
      console.log('Primer material:', JSON.stringify(materiales[0], null, 2));
    }
  }

  console.log('\n3. Verificando tecnologías (incluyendo system data)...');
  const { data: tecnologias, error: tecError } = await supabase
    .from('tecnologias')
    .select('id, nombre, company_id')
    .ilike('nombre', '%laser%')
    .eq('is_active', true);

  if (tecError) {
    console.error('Error tecnologías:', tecError);
  } else {
    console.log('Tecnologías encontradas:', tecnologias);

    if (tecnologias && tecnologias.length > 0) {
      console.log('\n4. Verificando tintas de la primera tecnología...');
      const { data: tintas, error: tintasError } = await supabase
        .from('tecnologias_tintas_pasos')
        .select('id, nombre, color_hex, tipo')
        .eq('tecnologia_id', tecnologias[0].id)
        .eq('tipo', 'tinta')
        .eq('is_active', true);

      if (tintasError) {
        console.error('Error tintas:', tintasError);
      } else {
        console.log('Tintas encontradas:', tintas);
      }
    }
  }

  if (categorias && categorias.length > 0) {
    const categoriaId = categorias[0].id;

    console.log('\n5. Verificando servicios relacionados...');
    const { data: serviciosRel, error: servRelError } = await supabase
      .from('servicios_categorias')
      .select('servicio_id')
      .eq('categoria_id', categoriaId);

    if (servRelError) {
      console.error('Error servicios_categorias:', servRelError);
    } else {
      console.log('Relaciones servicios encontradas:', serviciosRel);

      if (serviciosRel && serviciosRel.length > 0) {
        const servicioIds = serviciosRel.map(r => r.servicio_id);
        const { data: servicios, error: servError } = await supabase
          .from('servicios')
          .select('id, nombre')
          .in('id', servicioIds)
          .eq('is_active', true);

        if (servError) {
          console.error('Error servicios:', servError);
        } else {
          console.log('Servicios encontrados:', servicios);
        }
      }
    }

    console.log('\n6. Verificando acabados relacionados...');
    const { data: acabadosRel, error: acabRelError } = await supabase
      .from('acabados_categorias')
      .select('acabado_id')
      .eq('categoria_id', categoriaId);

    if (acabRelError) {
      console.error('Error acabados_categorias:', acabRelError);
    } else {
      console.log('Relaciones acabados encontradas:', acabadosRel);

      if (acabadosRel && acabadosRel.length > 0) {
        const acabadoIds = acabadosRel.map(r => r.acabado_id);
        const { data: acabados, error: acabError } = await supabase
          .from('acabados')
          .select('id, nombre')
          .in('id', acabadoIds)
          .eq('is_active', true);

        if (acabError) {
          console.error('Error acabados:', acabError);
        } else {
          console.log('Acabados encontrados:', acabados);
        }
      }
    }
  }

  console.log('\n7. Verificando productos láser existentes...');
  const { data: productos, error: prodError } = await supabase
    .from('productos_impresion_laser')
    .select('*')
    .limit(3);

  if (prodError) {
    console.error('Error productos:', prodError);
  } else {
    console.log('Productos encontrados:', productos?.length || 0);
    if (productos && productos.length > 0) {
      console.log('Primer producto:', JSON.stringify(productos[0], null, 2));
    }
  }

  console.log('\n=== FIN DEBUG ===');
}

debugProductosLaser().catch(console.error);
