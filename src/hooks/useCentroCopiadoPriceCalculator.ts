import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  TipoTintaCopiado,
  CaraImpresaCopiado,
  TipoAnillado,
  TipoPlastificado
} from '../types/database';

interface ConfiguracionImpresion {
  tamanio_papel_id: string;
  papel_id: string;
  tipo_tinta: TipoTintaCopiado;
  cara_impresa: CaraImpresaCopiado;
  cantidad_hojas: number;
  cantidad_copias: number;
}

interface ConfiguracionAnillado {
  tipo_anillado: TipoAnillado;
  cantidad_hojas: number;
  cantidad_copias: number;
}

interface ConfiguracionPlastificado {
  tipo_plastificado: TipoPlastificado;
  cantidad_hojas?: number;
  cantidad_especifica?: number;
  cantidad_copias: number;
}

interface DesglosePrecios {
  precio_impresion_unitario: number;
  precio_impresion_total: number;
  precio_anillado_unitario: number;
  precio_anillado_total: number;
  precio_plastificado_unitario: number;
  precio_plastificado_total: number;
  subtotal_item: number;
  total_copias: number;
}

export function useCentroCopiadoPriceCalculator() {
  const { profile } = useAuth();
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calcularPrecioImpresion = useCallback(
    async (config: ConfiguracionImpresion): Promise<DesglosePrecios> => {
      if (!profile?.company_id) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      try {
        setCalculating(true);
        setError(null);

        const totalHojas = config.cantidad_hojas * config.cantidad_copias;

        const { data: rangos, error: rangosError } = await supabase
          .from('centro_copiado_rangos_precio_impresion')
          .select('*')
          .eq('company_id', profile.company_id)
          .eq('is_active', true)
          .order('hojas_desde', { ascending: true });

        if (rangosError) throw rangosError;

        if (!rangos || rangos.length === 0) {
          throw new Error('No hay rangos de precio configurados');
        }

        const rangoAplicable = rangos.find(
          (rango) =>
            totalHojas >= rango.hojas_desde &&
            (rango.hojas_hasta === null || totalHojas <= rango.hojas_hasta)
        );

        if (!rangoAplicable) {
          throw new Error('No se encontró un rango de precio aplicable para esta cantidad');
        }

        const { data: precio, error: precioError } = await supabase
          .from('centro_copiado_precios_impresion')
          .select('precio')
          .eq('company_id', profile.company_id)
          .eq('tamanio_papel_id', config.tamanio_papel_id)
          .eq('papel_id', config.papel_id)
          .eq('tipo_tinta', config.tipo_tinta)
          .eq('cara_impresa', config.cara_impresa)
          .eq('rango_precio_id', rangoAplicable.id)
          .maybeSingle();

        if (precioError) throw precioError;

        if (!precio) {
          throw new Error('No se encontró precio configurado para esta combinación');
        }

        const precioImpresionUnitario = Number(precio.precio);
        const precioImpresionTotal = precioImpresionUnitario * totalHojas;

        return {
          precio_impresion_unitario: precioImpresionUnitario,
          precio_impresion_total: precioImpresionTotal,
          precio_anillado_unitario: 0,
          precio_anillado_total: 0,
          precio_plastificado_unitario: 0,
          precio_plastificado_total: 0,
          subtotal_item: precioImpresionTotal,
          total_copias: config.cantidad_copias,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al calcular precio de impresión';
        setError(errorMessage);
        throw err;
      } finally {
        setCalculating(false);
      }
    },
    [profile?.company_id]
  );

  const calcularPrecioAnillado = useCallback(
    async (config: ConfiguracionAnillado): Promise<number> => {
      if (!profile?.company_id) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      try {
        const { data: rangos, error: rangosError } = await supabase
          .from('centro_copiado_rangos_anillado')
          .select('*')
          .eq('company_id', profile.company_id)
          .eq('is_active', true)
          .order('hojas_desde', { ascending: true });

        if (rangosError) throw rangosError;

        if (!rangos || rangos.length === 0) {
          throw new Error('No hay rangos de anillado configurados. Por favor, configure los rangos en la sección de Terminaciones.');
        }

        const rangoAplicable = rangos.find(
          (rango) =>
            config.cantidad_hojas >= rango.hojas_desde &&
            (rango.hojas_hasta === null || config.cantidad_hojas <= rango.hojas_hasta)
        );

        if (!rangoAplicable) {
          const rangoMin = rangos[0]?.hojas_desde || 0;
          const rangoMax = rangos[rangos.length - 1]?.hojas_hasta;
          const rangoInfo = rangoMax
            ? `entre ${rangoMin} y ${rangoMax} hojas`
            : `desde ${rangoMin} hojas`;
          throw new Error(`No hay rango de anillado para ${config.cantidad_hojas} hojas. Los rangos configurados son ${rangoInfo}.`);
        }

        const precioUnitario =
          config.tipo_anillado === 'ring_wire'
            ? Number(rangoAplicable.precio_ring_wire)
            : Number(rangoAplicable.precio_plastico);

        return precioUnitario * config.cantidad_copias;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al calcular precio de anillado';
        setError(errorMessage);
        throw err;
      }
    },
    [profile?.company_id]
  );

  const calcularPrecioPlastificado = useCallback(
    async (config: ConfiguracionPlastificado): Promise<number> => {
      if (!profile?.company_id) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      try {
        const cantidadHojasPlastificar = config.cantidad_especifica || config.cantidad_hojas || 0;

        const { data: plastificados, error: plastificadosError } = await supabase
          .from('centro_copiado_plastificados')
          .select('*')
          .eq('company_id', profile.company_id)
          .eq('tipo', config.tipo_plastificado)
          .eq('is_active', true);

        if (plastificadosError) throw plastificadosError;

        if (!plastificados || plastificados.length === 0) {
          throw new Error(`No hay precios de plastificado configurados para el tipo "${config.tipo_plastificado}". Por favor, configure los precios en la sección de Terminaciones.`);
        }

        const rangoAplicable = plastificados.find(
          (rango) =>
            cantidadHojasPlastificar >= rango.unidades_desde &&
            (rango.unidades_hasta === null || cantidadHojasPlastificar <= rango.unidades_hasta)
        );

        if (!rangoAplicable) {
          const rangoMin = plastificados[0]?.unidades_desde || 0;
          const rangoMax = plastificados[plastificados.length - 1]?.unidades_hasta;
          const rangoInfo = rangoMax
            ? `entre ${rangoMin} y ${rangoMax} hojas`
            : `desde ${rangoMin} hojas`;
          throw new Error(`No hay rango de plastificado para ${cantidadHojasPlastificar} hojas. Los rangos configurados son ${rangoInfo}.`);
        }

        const precioUnitario = Number(rangoAplicable.precio);

        return precioUnitario * cantidadHojasPlastificar * config.cantidad_copias;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al calcular precio de plastificado';
        setError(errorMessage);
        throw err;
      }
    },
    [profile?.company_id]
  );

  const calcularPrecioCompleto = useCallback(
    async (
      configImpresion: ConfiguracionImpresion,
      configAnillado?: ConfiguracionAnillado,
      configPlastificado?: ConfiguracionPlastificado
    ): Promise<DesglosePrecios> => {
      try {
        setCalculating(true);
        setError(null);

        const preciosImpresion = await calcularPrecioImpresion(configImpresion);

        let precioAnilladoTotal = 0;
        let precioAnilladoUnitario = 0;
        if (configAnillado) {
          precioAnilladoTotal = await calcularPrecioAnillado(configAnillado);
          precioAnilladoUnitario = precioAnilladoTotal / configAnillado.cantidad_copias;
        }

        let precioPlastificadoTotal = 0;
        let precioPlastificadoUnitario = 0;
        if (configPlastificado) {
          precioPlastificadoTotal = await calcularPrecioPlastificado(configPlastificado);
          const cantidadHojas = configPlastificado.cantidad_especifica || configPlastificado.cantidad_hojas || 0;
          if (cantidadHojas > 0 && configPlastificado.cantidad_copias > 0) {
            precioPlastificadoUnitario = precioPlastificadoTotal / (cantidadHojas * configPlastificado.cantidad_copias);
          }
        }

        const subtotal =
          preciosImpresion.precio_impresion_total +
          precioAnilladoTotal +
          precioPlastificadoTotal;

        return {
          precio_impresion_unitario: preciosImpresion.precio_impresion_unitario,
          precio_impresion_total: preciosImpresion.precio_impresion_total,
          precio_anillado_unitario: precioAnilladoUnitario,
          precio_anillado_total: precioAnilladoTotal,
          precio_plastificado_unitario: precioPlastificadoUnitario,
          precio_plastificado_total: precioPlastificadoTotal,
          subtotal_item: subtotal,
          total_copias: configImpresion.cantidad_copias,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al calcular precio completo';
        setError(errorMessage);
        throw err;
      } finally {
        setCalculating(false);
      }
    },
    [calcularPrecioImpresion, calcularPrecioAnillado, calcularPrecioPlastificado]
  );

  return {
    calculating,
    error,
    calcularPrecioImpresion,
    calcularPrecioAnillado,
    calcularPrecioPlastificado,
    calcularPrecioCompleto,
  };
}
