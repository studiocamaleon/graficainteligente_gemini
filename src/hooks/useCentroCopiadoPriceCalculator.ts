import { useState, useCallback, useEffect, useRef } from 'react';
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

export interface ConfiguracionGuillotinado {
  cantidad_hojas: number;
  cantidad_copias: number;
}

export interface ConfiguracionPloteoCAD {
  tipo_papel: string;
  ancho_rollo: 60 | 90;
  metros_lineales: number;
  cantidad_copias: number;
}

interface DesglosePrecios {
  precio_impresion_unitario: number;
  precio_impresion_total: number;
  precio_anillado_unitario: number;
  precio_anillado_total: number;
  precio_plastificado_unitario: number;
  precio_plastificado_total: number;
  precio_guillotinado_unitario: number;
  precio_guillotinado_total: number;
  precio_ploteo_cad_unitario: number;
  precio_ploteo_cad_total: number;
  subtotal_item: number;
  total_copias: number;
}

interface RangoPrecioImpresionCache {
  id: string;
  hojas_desde: number;
  hojas_hasta: number | null;
}

interface RangoAnilladoCache {
  hojas_desde: number;
  hojas_hasta: number | null;
  precio_ring_wire: number;
  precio_plastico: number;
}

interface PlastificadoCache {
  unidades_desde: number;
  unidades_hasta: number | null;
  precio: number;
}

interface RangoGuillotinadoCache {
  hojas_desde: number;
  hojas_hasta: number | null;
  precio: number;
}

export function useCentroCopiadoPriceCalculator() {
  const { profile } = useAuth();
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rangosImpresionCacheRef = useRef<RangoPrecioImpresionCache[] | null>(null);
  const precioImpresionCacheRef = useRef<Map<string, number>>(new Map());
  const rangosAnilladoCacheRef = useRef<RangoAnilladoCache[] | null>(null);
  const plastificadosByTipoCacheRef = useRef<Map<string, PlastificadoCache[]>>(new Map());
  const rangosGuillotinadoCacheRef = useRef<RangoGuillotinadoCache[] | null>(null);
  const precioPloteoCacheRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    rangosImpresionCacheRef.current = null;
    precioImpresionCacheRef.current.clear();
    rangosAnilladoCacheRef.current = null;
    plastificadosByTipoCacheRef.current.clear();
    rangosGuillotinadoCacheRef.current = null;
    precioPloteoCacheRef.current.clear();
  }, [profile?.company_id]);

  const getRangosImpresion = useCallback(async () => {
    if (rangosImpresionCacheRef.current) {
      return rangosImpresionCacheRef.current;
    }
    const { data: rangos, error: rangosError } = await supabase
      .from('centro_copiado_rangos_precio_impresion')
      .select('*')
      .eq('company_id', profile?.company_id)
      .eq('is_active', true)
      .order('hojas_desde', { ascending: true });
    if (rangosError) throw rangosError;
    rangosImpresionCacheRef.current = rangos || [];
    return rangosImpresionCacheRef.current;
  }, [profile?.company_id]);

  const getPrecioImpresion = useCallback(
    async (
      tamanioPapelId: string,
      papelId: string,
      tipoTinta: TipoTintaCopiado,
      caraImpresa: CaraImpresaCopiado,
      rangoPrecioId: string
    ) => {
      const key = [
        profile?.company_id,
        tamanioPapelId,
        papelId,
        tipoTinta,
        caraImpresa,
        rangoPrecioId,
      ].join(':');
      if (precioImpresionCacheRef.current.has(key)) {
        return precioImpresionCacheRef.current.get(key) as number;
      }

      const { data: precio, error: precioError } = await supabase
        .from('centro_copiado_precios_impresion')
        .select('precio')
        .eq('company_id', profile?.company_id)
        .eq('tamanio_papel_id', tamanioPapelId)
        .eq('papel_id', papelId)
        .eq('tipo_tinta', tipoTinta)
        .eq('cara_impresa', caraImpresa)
        .eq('rango_precio_id', rangoPrecioId)
        .maybeSingle();

      if (precioError) throw precioError;
      if (!precio) {
        throw new Error('No se encontró precio configurado para esta combinación');
      }

      const value = Number(precio.precio);
      precioImpresionCacheRef.current.set(key, value);
      return value;
    },
    [profile?.company_id]
  );

  const getRangosAnillado = useCallback(async () => {
    if (rangosAnilladoCacheRef.current) return rangosAnilladoCacheRef.current;
    const { data: rangos, error: rangosError } = await supabase
      .from('centro_copiado_rangos_anillado')
      .select('*')
      .eq('company_id', profile?.company_id)
      .eq('is_active', true)
      .order('hojas_desde', { ascending: true });
    if (rangosError) throw rangosError;
    rangosAnilladoCacheRef.current = rangos || [];
    return rangosAnilladoCacheRef.current;
  }, [profile?.company_id]);

  const getPlastificadosByTipo = useCallback(async (tipo: TipoPlastificado) => {
    const key = `${profile?.company_id}:${tipo}`;
    if (plastificadosByTipoCacheRef.current.has(key)) {
      return plastificadosByTipoCacheRef.current.get(key) as PlastificadoCache[];
    }
    const { data, error: plastificadosError } = await supabase
      .from('centro_copiado_plastificados')
      .select('*')
      .eq('company_id', profile?.company_id)
      .eq('tipo', tipo)
      .eq('is_active', true);
    if (plastificadosError) throw plastificadosError;
    const rows = data || [];
    plastificadosByTipoCacheRef.current.set(key, rows);
    return rows;
  }, [profile?.company_id]);

  const getRangosGuillotinado = useCallback(async () => {
    if (rangosGuillotinadoCacheRef.current) return rangosGuillotinadoCacheRef.current;
    const { data: rangos, error: rangosError } = await supabase
      .from('centro_copiado_rangos_guillotinado')
      .select('*')
      .eq('company_id', profile?.company_id)
      .eq('is_active', true)
      .order('hojas_desde', { ascending: true });
    if (rangosError) throw rangosError;
    rangosGuillotinadoCacheRef.current = rangos || [];
    return rangosGuillotinadoCacheRef.current;
  }, [profile?.company_id]);

  const getPrecioPloteo = useCallback(async (tipoPapel: string, anchoRollo: 60 | 90) => {
    const key = `${profile?.company_id}:${tipoPapel}:${anchoRollo}`;
    if (precioPloteoCacheRef.current.has(key)) {
      return precioPloteoCacheRef.current.get(key) as number;
    }
    const { data: precioConfig, error } = await supabase
      .from('centro_copiado_ploteo_cad_precios')
      .select('precio_metro_lineal')
      .eq('company_id', profile?.company_id)
      .eq('tipo_papel', tipoPapel)
      .eq('ancho_cm', anchoRollo)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    if (!precioConfig) {
      throw new Error(`No hay precio configurado para ${tipoPapel} ${anchoRollo}cm.`);
    }
    const value = Number(precioConfig.precio_metro_lineal);
    precioPloteoCacheRef.current.set(key, value);
    return value;
  }, [profile?.company_id]);

  const calcularPrecioImpresion = useCallback(
    async (config: ConfiguracionImpresion): Promise<DesglosePrecios> => {
      if (!profile?.company_id) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      try {
        setCalculating(true);
        setError(null);

        const totalHojas = config.cantidad_hojas * config.cantidad_copias;

        const rangos = await getRangosImpresion();

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

        const precioImpresionUnitario = await getPrecioImpresion(
          config.tamanio_papel_id,
          config.papel_id,
          config.tipo_tinta,
          config.cara_impresa,
          rangoAplicable.id
        );
        const precioImpresionTotal = precioImpresionUnitario * totalHojas;

        return {
          precio_impresion_unitario: precioImpresionUnitario,
          precio_impresion_total: precioImpresionTotal,
          precio_anillado_unitario: 0,
          precio_anillado_total: 0,
          precio_plastificado_unitario: 0,
          precio_plastificado_total: 0,
          precio_guillotinado_unitario: 0,
          precio_guillotinado_total: 0,
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
    [profile?.company_id, getPrecioImpresion, getRangosImpresion]
  );

  const calcularPrecioAnillado = useCallback(
    async (config: ConfiguracionAnillado): Promise<number> => {
      if (!profile?.company_id) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      if (!config.tipo_anillado || !config.cantidad_hojas || !config.cantidad_copias) {
        return 0;
      }

      try {
        const rangos = await getRangosAnillado();

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
    [profile?.company_id, getRangosAnillado]
  );

  const calcularPrecioPlastificado = useCallback(
    async (config: ConfiguracionPlastificado): Promise<number> => {
      if (!profile?.company_id) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      if (!config.tipo_plastificado || !config.cantidad_copias) {
        return 0;
      }

      try {
        const cantidadHojasPlastificar = config.cantidad_especifica || config.cantidad_hojas || 0;

        if (cantidadHojasPlastificar <= 0) {
          return 0;
        }

        const plastificados = await getPlastificadosByTipo(config.tipo_plastificado);

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
    [profile?.company_id, getPlastificadosByTipo]
  );

  const calcularPrecioGuillotinado = useCallback(
    async (config: ConfiguracionGuillotinado): Promise<number> => {
      if (!profile?.company_id) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      if (!config.cantidad_hojas || !config.cantidad_copias) {
        return 0;
      }

      try {
        const rangos = await getRangosGuillotinado();

        if (!rangos || rangos.length === 0) {
          throw new Error('No hay rangos de guillotinado configurados. Por favor, configure los rangos en la sección de Terminaciones.');
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
          throw new Error(`No hay rango de guillotinado para ${config.cantidad_hojas} hojas. Los rangos configurados son ${rangoInfo}.`);
        }

        const precioTotal = Number(rangoAplicable.precio);

        return precioTotal * config.cantidad_copias;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al calcular precio de guillotinado';
        setError(errorMessage);
        throw err;
      }
    },
    [profile?.company_id, getRangosGuillotinado]
  );

  const calcularPrecioPloteoCAD = useCallback(
    async (config: ConfiguracionPloteoCAD): Promise<number> => {
      if (!profile?.company_id) {
        throw new Error('No se pudo obtener la información del usuario');
      }

      if (!config.metros_lineales || !config.cantidad_copias) {
        return 0;
      }

      try {
        const precioMetroLineal = await getPrecioPloteo(config.tipo_papel, config.ancho_rollo);
        const precioTotal = precioMetroLineal * config.metros_lineales * config.cantidad_copias;
        return precioTotal;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al calcular precio de Ploteo CAD';
        setError(errorMessage);
        throw err;
      }
    },
    [profile?.company_id, getPrecioPloteo]
  );



  const calcularPrecioCompleto = useCallback(
    async (
      configImpresion?: ConfiguracionImpresion,
      configAnillado?: ConfiguracionAnillado,
      configPlastificado?: ConfiguracionPlastificado,
      configGuillotinado?: ConfiguracionGuillotinado,
      configPloteoCAD?: ConfiguracionPloteoCAD
    ): Promise<DesglosePrecios> => {
      try {
        setCalculating(true);
        setError(null);

        let preciosImpresion = { precio_impresion_total: 0, precio_impresion_unitario: 0 };

        // Mode: Impresion de Hojas
        if (configImpresion) {
          preciosImpresion = await calcularPrecioImpresion(configImpresion);
        }

        // Mode: Ploteo CAD
        let precioPloteoTotal = 0;
        let precioPloteoUnitario = 0;
        if (configPloteoCAD) {
          precioPloteoTotal = await calcularPrecioPloteoCAD(configPloteoCAD);
          precioPloteoUnitario = precioPloteoTotal / configPloteoCAD.cantidad_copias;
        }

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

        let precioGuillotinadoTotal = 0;
        let precioGuillotinadoUnitario = 0;
        if (configGuillotinado) {
          precioGuillotinadoTotal = await calcularPrecioGuillotinado(configGuillotinado);
          precioGuillotinadoUnitario = precioGuillotinadoTotal / configGuillotinado.cantidad_copias;
        }

        const subtotal =
          preciosImpresion.precio_impresion_total +
          precioPloteoTotal +
          precioAnilladoTotal +
          precioPlastificadoTotal +
          precioGuillotinadoTotal;

        const totalCopias = configImpresion?.cantidad_copias || configPloteoCAD?.cantidad_copias || 1;

        return {
          precio_impresion_unitario: preciosImpresion.precio_impresion_unitario,
          precio_impresion_total: preciosImpresion.precio_impresion_total,
          precio_anillado_unitario: precioAnilladoUnitario,
          precio_anillado_total: precioAnilladoTotal,
          precio_plastificado_unitario: precioPlastificadoUnitario,
          precio_plastificado_total: precioPlastificadoTotal,
          precio_guillotinado_unitario: precioGuillotinadoUnitario,
          precio_guillotinado_total: precioGuillotinadoTotal,
          precio_ploteo_cad_unitario: precioPloteoUnitario,
          precio_ploteo_cad_total: precioPloteoTotal,
          subtotal_item: subtotal,
          total_copias: totalCopias,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al calcular precio completo';
        setError(errorMessage);
        throw err;
      } finally {
        setCalculating(false);
      }
    },
    [calcularPrecioImpresion, calcularPrecioAnillado, calcularPrecioPlastificado, calcularPrecioGuillotinado, calcularPrecioPloteoCAD]
  );

  return {
    calculating,
    error,
    calcularPrecioImpresion,
    calcularPrecioAnillado,
    calcularPrecioPlastificado,
    calcularPrecioGuillotinado,
    calcularPrecioPloteoCAD,
    calcularPrecioCompleto,
  };
}
