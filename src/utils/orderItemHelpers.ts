import { supabase } from '../lib/supabase';
import type { WizardItemData, ItemConfiguracion } from '../types/database';

interface OrdenItemForReconstruction {
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
  configuracion: ItemConfiguracion;
}

/**
 * Reconstruye un objeto WizardItemData completo desde un item de orden guardado.
 * Esto permite editar un item en el wizard con toda su configuración pre-cargada.
 */
export async function reconstructWizardDataFromItem(
  item: OrdenItemForReconstruction
): Promise<WizardItemData | null> {
  try {
    // Obtener información básica del producto
    const { data: producto, error: productoError } = await supabase
      .from('productos')
      .select('id, nombre, tipo_medida, producto_impreso, caras_impresas, medidas_disponibles, ancho_maximo')
      .eq('id', item.producto_id)
      .single();

    if (productoError || !producto) {
      console.error('Error cargando producto:', productoError);
      return null;
    }

    // Obtener todas las relaciones en paralelo (igual que en getProductoById)
    const [tecnologiasRes, materialRes, serviciosRes, acabadosRes, pricingRes] = await Promise.all([
      supabase
        .from('productos_tecnologias')
        .select(`
          id,
          producto_id,
          tecnologia_id,
          tintas,
          tecnologia:tecnologias(id, nombre)
        `)
        .eq('producto_id', item.producto_id),
      supabase
        .from('productos_materiales')
        .select(`
          id,
          producto_id,
          material_id,
          variante_nombre,
          espesores,
          material:materiales(id, nombre, unidad_espesor, aplica_espesor)
        `)
        .eq('producto_id', item.producto_id)
        .maybeSingle(),
      supabase
        .from('productos_servicios')
        .select(`
          servicio_id,
          servicio:servicios(
            id,
            nombre,
            tiene_niveles_precio,
            tipo_impacto,
            valor_impacto,
            valor_impacto_secundario,
            niveles_precio:servicios_niveles_precio(
              id,
              nombre,
              tipo_impacto,
              valor_impacto,
              valor_impacto_secundario
            )
          )
        `)
        .eq('producto_id', item.producto_id)
        .eq('is_active', true),
      supabase
        .from('productos_acabados')
        .select(`
          acabado_id,
          acabado:acabados(
            id,
            nombre,
            tiene_niveles_precio,
            tipo_impacto,
            valor_impacto,
            valor_impacto_secundario,
            niveles_precio:acabados_niveles_precio(
              id,
              nombre,
              tipo_impacto,
              valor_impacto,
              valor_impacto_secundario
            )
          )
        `)
        .eq('producto_id', item.producto_id)
        .eq('is_active', true),
      supabase
        .from('productos_pricing')
        .select(`
          id,
          producto_id,
          unidad_pricing,
          tiene_descuento,
          cantidades_fijas,
          rango_precio_id
        `)
        .eq('producto_id', item.producto_id)
        .maybeSingle(),
    ]);

    if (tecnologiasRes.error) throw tecnologiasRes.error;
    if (serviciosRes.error) throw serviciosRes.error;
    if (acabadosRes.error) throw acabadosRes.error;
    if (pricingRes.error) throw pricingRes.error;

    // Construir el objeto WizardItemData
    const wizardData: WizardItemData = {
      producto_id: producto.id,
      producto_nombre: producto.nombre,
      tipo_medida: producto.tipo_medida,
      unidad_pricing: pricingRes.data?.unidad_pricing || 'por_unidad',
      tiene_descuento: pricingRes.data?.tiene_descuento || false,
      cantidades_fijas: pricingRes.data?.cantidades_fijas || [],
      rango_precio_id: pricingRes.data?.rango_precio_id,
      producto_impreso: producto.producto_impreso,
      caras_impresas_disponibles: producto.caras_impresas || [],
      tecnologias_disponibles:
        tecnologiasRes.data?.map((t: any) => ({
          id: t.tecnologia_id,
          nombre: t.tecnologia?.nombre || '',
          tintas: t.tintas || [],
        })) || [],
      material_info: materialRes.data
        ? {
            id: materialRes.data.material_id,
            nombre: materialRes.data.material?.nombre || '',
            variante_nombre: materialRes.data.variante_nombre,
            espesores: materialRes.data.espesores || [],
            aplica_espesor: materialRes.data.material?.aplica_espesor || false,
            unidad_espesor: materialRes.data.material?.unidad_espesor,
          }
        : undefined,
      servicios_disponibles:
        serviciosRes.data?.map((s: any) => ({
          id: s.servicio.id,
          nombre: s.servicio.nombre,
          tiene_niveles: s.servicio.tiene_niveles_precio,
          tipo_impacto: s.servicio.tipo_impacto,
          valor_impacto: s.servicio.valor_impacto,
          valor_impacto_secundario: s.servicio.valor_impacto_secundario,
          niveles:
            s.servicio.niveles_precio?.map((n: any) => ({
              id: n.id,
              nombre: n.nombre,
              tipo_impacto: n.tipo_impacto,
              valor_impacto: n.valor_impacto,
              valor_impacto_secundario: n.valor_impacto_secundario,
            })) || [],
        })) || [],
      acabados_disponibles:
        acabadosRes.data?.map((a: any) => ({
          id: a.acabado.id,
          nombre: a.acabado.nombre,
          tiene_niveles: a.acabado.tiene_niveles_precio,
          tipo_impacto: a.acabado.tipo_impacto,
          valor_impacto: a.acabado.valor_impacto,
          valor_impacto_secundario: a.acabado.valor_impacto_secundario,
          niveles:
            a.acabado.niveles_precio?.map((n: any) => ({
              id: n.id,
              nombre: n.nombre,
              tipo_impacto: n.tipo_impacto,
              valor_impacto: n.valor_impacto,
              valor_impacto_secundario: n.valor_impacto_secundario,
            })) || [],
        })) || [],
      medidas_disponibles: producto.medidas_disponibles || undefined,
      ancho_maximo: producto.ancho_maximo || undefined,
    };

    return wizardData;
  } catch (error) {
    console.error('Error reconstruyendo datos del wizard:', error);
    return null;
  }
}
