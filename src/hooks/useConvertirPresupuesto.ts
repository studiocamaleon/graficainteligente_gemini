import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  ConvertirPresupuestoData,
  ConvertirPresupuestoResult,
} from '../types/presupuestos';

export function useConvertirPresupuesto() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convertirPresupuesto = async (
    data: ConvertirPresupuestoData
  ): Promise<ConvertirPresupuestoResult> => {
    try {
      setLoading(true);
      setError(null);

      // 1. Validar que el presupuesto existe y está aprobado
      const { data: presupuesto, error: presupuestoError } = await supabase
        .from('presupuestos')
        .select('*, cliente:clients!cliente_id(*)')
        .eq('id', data.presupuesto_id)
        .single();

      if (presupuestoError) throw presupuestoError;

      if (!presupuesto) {
        throw new Error('Presupuesto no encontrado');
      }

      if (presupuesto.estado !== 'aprobado') {
        throw new Error('El presupuesto debe estar aprobado para convertirse');
      }

      if (presupuesto.orden_trabajo_id) {
        throw new Error('Este presupuesto ya fue convertido a orden de trabajo');
      }

      // 2. Obtener items del presupuesto
      const { data: items, error: itemsError } = await supabase
        .from('presupuestos_items')
        .select('*')
        .eq('presupuesto_id', data.presupuesto_id);

      if (itemsError) throw itemsError;

      if (!items || items.length === 0) {
        throw new Error('El presupuesto no tiene items para convertir');
      }

      // Contar items personalizados
      const itemsPersonalizados = items.filter(
        (item: any) => item.tipo_item === 'item_personalizado'
      );
      const itemsSistema = items.filter(
        (item: any) => item.tipo_item === 'producto_sistema'
      );

      // 3. Crear orden de trabajo
      const { data: ordenTrabajo, error: ordenError } = await supabase
        .from('ordenes_trabajo')
        .insert({
          company_id: presupuesto.company_id,
          cliente_id: presupuesto.cliente_id,
          vendedor_id: presupuesto.vendedor_id,
          canal_venta: presupuesto.canal_venta,
          estado: 'pendiente',
          fecha_estimada_entrega:
            data.fecha_entrega_estimada || presupuesto.fecha_validez,
          notas_internas: data.notas_adicionales
            ? `Convertido desde presupuesto ${presupuesto.numero_presupuesto}\n\n${data.notas_adicionales}`
            : `Convertido desde presupuesto ${presupuesto.numero_presupuesto}`,
          subtotal: presupuesto.subtotal,
          total_descuentos: presupuesto.total_descuentos,
          total: presupuesto.total,
          created_by: user?.id,
          presupuesto_id: data.presupuesto_id,
        })
        .select()
        .single();

      if (ordenError) throw ordenError;

      // 4. Copiar items del sistema
      const itemsParaCopiar = itemsSistema.map((item: any) => ({
        orden_id: ordenTrabajo.id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        configuracion: item.configuracion,
        precio_base: item.precio_base,
        precio_servicios: item.precio_servicios,
        precio_acabados: item.precio_acabados,
        precio_unitario_final: item.precio_unitario_final,
        precio_total: item.precio_total,
        producto_nombre: item.producto_nombre,
        producto_categoria: item.producto_categoria,
        estado: 'pendiente',
      }));

      if (itemsParaCopiar.length > 0) {
        const { error: itemsOrdenError } = await supabase
          .from('ordenes_trabajo_items')
          .insert(itemsParaCopiar);

        if (itemsOrdenError) throw itemsOrdenError;
      }

      // 5. Copiar archivos si se solicita
      if (data.copiar_archivos) {
        const { data: archivos, error: archivosError } = await supabase
          .from('presupuestos_archivos')
          .select('*')
          .eq('presupuesto_id', data.presupuesto_id);

        if (!archivosError && archivos && archivos.length > 0) {
          // Copiar archivos al bucket de órdenes
          for (const archivo of archivos) {
            try {
              // Descargar del bucket de presupuestos
              const { data: fileData } = await supabase.storage
                .from('presupuestos-archivos')
                .download(archivo.storage_path);

              if (fileData) {
                // Subir al bucket de órdenes
                const newPath = `${presupuesto.company_id}/${ordenTrabajo.id}/${archivo.nombre_storage}`;
                await supabase.storage
                  .from('orden-trabajo-archivos')
                  .upload(newPath, fileData);

                // Crear registro
                await supabase.from('ordenes_trabajo_archivos').insert({
                  orden_id: ordenTrabajo.id,
                  company_id: presupuesto.company_id,
                  nombre_archivo: archivo.nombre_archivo,
                  nombre_storage: archivo.nombre_storage,
                  tipo_mime: archivo.tipo_mime,
                  tamano_bytes: archivo.tamano_bytes,
                  storage_path: newPath,
                  descripcion: archivo.descripcion
                    ? `${archivo.descripcion} (Copiado desde presupuesto)`
                    : 'Copiado desde presupuesto',
                  uploaded_by: user?.id,
                });
              }
            } catch (err) {
              console.error('Error copiando archivo:', err);
              // Continuar con los demás archivos
            }
          }
        }
      }

      // 6. Actualizar estado del presupuesto
      const { error: updatePresupuestoError } = await supabase
        .from('presupuestos')
        .update({
          estado: 'convertido',
          orden_trabajo_id: ordenTrabajo.id,
          updated_by: user?.id,
        })
        .eq('id', data.presupuesto_id);

      if (updatePresupuestoError) throw updatePresupuestoError;

      // 7. Retornar resultado
      return {
        success: true,
        orden_trabajo_id: ordenTrabajo.id,
        numero_orden: ordenTrabajo.numero_orden,
        items_copiados: itemsSistema.length,
        items_personalizados_no_copiados: itemsPersonalizados.length,
        mensaje:
          itemsPersonalizados.length > 0
            ? `Se creó la orden ${ordenTrabajo.numero_orden} con ${itemsSistema.length} items del sistema. Hay ${itemsPersonalizados.length} items personalizados que deberás agregar manualmente.`
            : `Se creó la orden ${ordenTrabajo.numero_orden} con ${itemsSistema.length} items copiados exitosamente.`,
      };
    } catch (err: any) {
      console.error('Error convirtiendo presupuesto:', err);
      setError(err.message);
      return {
        success: false,
        items_copiados: 0,
        items_personalizados_no_copiados: 0,
        error: err.message,
      };
    } finally {
      setLoading(false);
    }
  };

  const validarConversion = async (
    presupuestoId: string
  ): Promise<{
    puede_convertir: boolean;
    motivo?: string;
    warnings: string[];
  }> => {
    try {
      const { data: presupuesto, error: presupuestoError } = await supabase
        .from('presupuestos')
        .select('*, items:presupuestos_items(*)')
        .eq('id', presupuestoId)
        .single();

      if (presupuestoError) throw presupuestoError;

      const warnings: string[] = [];

      // Validar estado
      if (presupuesto.estado !== 'aprobado') {
        return {
          puede_convertir: false,
          motivo: 'El presupuesto debe estar aprobado para convertirse',
          warnings,
        };
      }

      // Validar si ya fue convertido
      if (presupuesto.orden_trabajo_id) {
        return {
          puede_convertir: false,
          motivo: 'Este presupuesto ya fue convertido a orden de trabajo',
          warnings,
        };
      }

      // Validar items
      if (!presupuesto.items || presupuesto.items.length === 0) {
        return {
          puede_convertir: false,
          motivo: 'El presupuesto no tiene items',
          warnings,
        };
      }

      // Advertir sobre items personalizados
      const itemsPersonalizados = presupuesto.items.filter(
        (item: any) => item.tipo_item === 'item_personalizado'
      );

      if (itemsPersonalizados.length > 0) {
        warnings.push(
          `Hay ${itemsPersonalizados.length} items personalizados que no se copiarán automáticamente`
        );
      }

      return {
        puede_convertir: true,
        warnings,
      };
    } catch (err: any) {
      return {
        puede_convertir: false,
        motivo: err.message,
        warnings: [],
      };
    }
  };

  return {
    loading,
    error,
    convertirPresupuesto,
    validarConversion,
  };
}
