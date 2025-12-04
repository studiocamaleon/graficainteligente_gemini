import { supabase } from '../lib/supabase';

/**
 * Descarga una factura desde Supabase Storage
 * @param storagePath - Path del archivo en el bucket 'facturas'
 * @param numeroFactura - Número de la factura para el nombre del archivo
 */
export async function descargarFactura(
  storagePath: string,
  numeroFactura: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Obtener el archivo desde el storage
    const { data, error } = await supabase.storage
      .from('facturas')
      .download(storagePath);

    if (error) {
      console.error('Error descargando factura:', error);
      return {
        success: false,
        error: 'Error al descargar la factura. Por favor, intente nuevamente.',
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'No se pudo obtener el archivo de la factura.',
      };
    }

    // Crear un enlace de descarga
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Factura_${numeroFactura.replace(/\//g, '-')}.pdf`;

    // Simular click para iniciar descarga
    document.body.appendChild(link);
    link.click();

    // Limpiar
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('Error en descarga de factura:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Obtiene la URL pública de una factura (si el bucket es público)
 * @param storagePath - Path del archivo en el bucket 'facturas'
 */
export function obtenerUrlPublicaFactura(storagePath: string): string {
  const { data } = supabase.storage
    .from('facturas')
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

/**
 * Crea una URL firmada temporal para descargar una factura
 * @param storagePath - Path del archivo en el bucket 'facturas'
 * @param expiresIn - Segundos de validez de la URL (default: 3600 = 1 hora)
 */
export async function crearUrlTemporalFactura(
  storagePath: string,
  expiresIn: number = 3600
): Promise<{ url: string | null; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from('facturas')
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error('Error creando URL temporal:', error);
      return {
        url: null,
        error: 'Error al crear enlace de descarga.',
      };
    }

    return { url: data.signedUrl };
  } catch (error) {
    console.error('Error en creación de URL temporal:', error);
    return {
      url: null,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
