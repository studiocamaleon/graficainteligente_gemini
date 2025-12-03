import { useState } from 'react';
import { supabase } from '../lib/supabase';

export type CategoriaProducto =
  | 'gran_formato'
  | 'impresion_laser'
  | 'materiales_rigidos'
  | 'plotter_corte'
  | 'portabanners'
  | 'sellos'
  | 'talonarios';

interface AumentoMasivoResult {
  success: boolean;
  categoria: string;
  registros_actualizados: number;
  porcentaje_aplicado: number;
}

export interface ProductoPreview {
  id: string;
  nombre: string;
  precioActual: number;
  precioNuevo: number;
  diferencia: number;
  diferenciaPorcentaje: number;
  cantidadPrecios?: number;
}

export function useAumentoMasivoPreciosProductos() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AumentoMasivoResult | null>(null);

  const aplicarAumento = async (
    categoria: CategoriaProducto,
    porcentaje: number,
    productosIds?: string[]
  ): Promise<AumentoMasivoResult> => {
    setIsLoading(true);
    setError(null);

    try {
      // Validar porcentaje
      if (porcentaje < -50 || porcentaje > 200) {
        throw new Error('El porcentaje debe estar entre -50% y +200%');
      }

      // Preparar parámetros
      const params: {
        p_categoria: string;
        p_porcentaje: number;
        p_productos_ids?: string[];
        p_company_id?: string;
      } = {
        p_categoria: categoria,
        p_porcentaje: porcentaje,
      };

      // Solo enviar productos_ids si hay alguno especificado
      if (productosIds && productosIds.length > 0) {
        params.p_productos_ids = productosIds;
      }

      // Llamar a la función SQL
      const { data, error: rpcError } = await supabase.rpc('fn_aumentar_precios_categoria', params);

      if (rpcError) {
        console.error('Error en RPC:', rpcError);
        throw new Error(rpcError.message || 'Error al aplicar el aumento de precios');
      }

      if (!data) {
        throw new Error('No se recibió respuesta del servidor');
      }

      const result: AumentoMasivoResult = data as AumentoMasivoResult;
      setLastResult(result);

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al aplicar aumento';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const calcularPreviewPorcentaje = (
    precioActual: number,
    porcentaje: number
  ): { precioNuevo: number; diferencia: number } => {
    const factor = 1 + porcentaje / 100;
    const precioNuevo = Math.round(precioActual * factor * 100) / 100;
    const diferencia = precioNuevo - precioActual;

    return { precioNuevo, diferencia };
  };

  const previsualizarAumento = (
    productos: Array<{ id: string; nombre: string; precio: number }>,
    porcentaje: number
  ): ProductoPreview[] => {
    if (!productos || productos.length === 0) {
      return [];
    }

    return productos.map((producto) => {
      const { precioNuevo, diferencia } = calcularPreviewPorcentaje(producto.precio, porcentaje);

      return {
        id: producto.id,
        nombre: producto.nombre,
        precioActual: producto.precio,
        precioNuevo,
        diferencia,
        diferenciaPorcentaje: porcentaje,
      };
    });
  };

  const contarPreciosReales = async (
    categoria: CategoriaProducto,
    productosIds: string[]
  ): Promise<Map<string, number>> => {
    const conteoMap = new Map<string, number>();

    if (productosIds.length === 0) {
      return conteoMap;
    }

    try {
      let tableName = '';
      let columnName = '';

      // Determinar tabla y columna según categoría
      switch (categoria) {
        case 'impresion_laser':
          tableName = 'productos_impresion_laser_precios';
          columnName = 'producto_laser_id';
          break;
        case 'gran_formato':
          tableName = 'productos_gran_formato_precios';
          columnName = 'producto_gran_formato_id';
          break;
        case 'materiales_rigidos':
          tableName = 'productos_materiales_rigidos_precios';
          columnName = 'producto_materiales_rigidos_id';
          break;
        case 'plotter_corte':
          tableName = 'productos_plotter_corte_precios';
          columnName = 'producto_id';
          break;
        case 'portabanners':
          tableName = 'productos_portabanners_precios';
          columnName = 'producto_id';
          break;
        case 'sellos':
          tableName = 'productos_sellos_precios';
          columnName = 'producto_id';
          break;
        case 'talonarios':
          tableName = 'productos_talonarios_precios';
          columnName = 'producto_talonario_id';
          break;
        default:
          return conteoMap;
      }

      // Consultar conteo de precios por producto
      const { data, error } = await supabase
        .from(tableName)
        .select(`${columnName}`)
        .in(columnName, productosIds);

      if (error) {
        console.error('Error contando precios:', error);
        return conteoMap;
      }

      // Contar ocurrencias por producto
      data?.forEach((row: any) => {
        const productoId = row[columnName];
        conteoMap.set(productoId, (conteoMap.get(productoId) || 0) + 1);
      });

      return conteoMap;
    } catch (error) {
      console.error('Error en contarPreciosReales:', error);
      return conteoMap;
    }
  };

  const resetError = () => setError(null);
  const resetLastResult = () => setLastResult(null);

  return {
    aplicarAumento,
    previsualizarAumento,
    calcularPreviewPorcentaje,
    contarPreciosReales,
    isLoading,
    error,
    lastResult,
    resetError,
    resetLastResult,
  };
}
