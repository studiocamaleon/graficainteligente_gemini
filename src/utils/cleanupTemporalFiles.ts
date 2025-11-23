import { supabase } from '../lib/supabase';

/**
 * Limpia archivos temporales antiguos (>24 horas) de la base de datos
 * Ejecuta la función de base de datos que elimina archivos huérfanos
 */
export async function limpiarArchivosTemporalesAntiguos() {
  try {

    const { data, error } = await supabase.rpc(
      'fn_limpiar_adjuntos_temporales_antiguos'
    );

    if (error) {
      console.error('[Cleanup] Error ejecutando función de limpieza:', error);
      throw error;
    }

    if (data && data.length > 0) {
      const stats = data[0];
      const totalEliminados =
        (stats.archivos_eliminados || 0) +
        (stats.archivos_produccion_eliminados || 0) +
        (stats.links_eliminados || 0);

      if (totalEliminados > 0) {
        console.log('[Cleanup] Archivos temporales eliminados:', {
          archivos: stats.archivos_eliminados || 0,
          archivosProduccion: stats.archivos_produccion_eliminados || 0,
          links: stats.links_eliminados || 0,
          total: totalEliminados
        });

        // Eliminar archivos físicos de storage
        const storagePathsCliente = stats.storage_paths_cliente || [];
        const storagePathsProduccion = stats.storage_paths_produccion || [];

        if (storagePathsCliente.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('ordenes-trabajo-archivos')
            .remove(storagePathsCliente);

          if (storageError) {
            console.error('[Cleanup] Error eliminando archivos de storage (cliente):', storageError);
          } else {
            console.log(`[Cleanup] ${storagePathsCliente.length} archivos eliminados de storage (cliente)`);
          }
        }

        if (storagePathsProduccion.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('ordenes-trabajo-archivos')
            .remove(storagePathsProduccion);

          if (storageError) {
            console.error('[Cleanup] Error eliminando archivos de storage (producción):', storageError);
          } else {
            console.log(`[Cleanup] ${storagePathsProduccion.length} archivos eliminados de storage (producción)`);
          }
        }

        return {
          success: true,
          totalEliminados,
          stats
        };
      } else {
        return {
          success: true,
          totalEliminados: 0
        };
      }
    }

    return {
      success: true,
      totalEliminados: 0
    };
  } catch (err: any) {
    console.error('[Cleanup] Error limpiando archivos temporales antiguos:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Inicia la limpieza automática periódica de archivos temporales
 * - Ejecuta limpieza al cargar la app
 * - Programa limpieza cada 6 horas
 */
export function iniciarLimpiezaAutomatica() {

  // Ejecutar limpieza inmediata al cargar la app
  limpiarArchivosTemporalesAntiguos();

  // Programar limpieza cada 6 horas
  const INTERVALO_6_HORAS = 6 * 60 * 60 * 1000; // 6 horas en milisegundos

  const intervalId = setInterval(() => {
    limpiarArchivosTemporalesAntiguos();
  }, INTERVALO_6_HORAS);

  // Retornar función para detener limpieza (si se necesita)
  return () => {
    clearInterval(intervalId);
  };
}
