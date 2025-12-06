import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Producto } from './useProductos';
import type { Servicio, ServicioNivelPrecio, WizardItemData } from '../types/database';
import type { Acabado, AcabadoNivelPrecio } from '../types/database';
import type { TipoImpactoPrecio } from '../types/database';

export interface ProductoPrecio {
  id: string;
  producto_id: string;
  tecnologia_id: string | null;
  tipo_tinta: string | null;
  cara_impresion: string | null;
  cantidad: number;
  precio_venta: number;
}

export interface PriceCalculation {
  precioBase: number;
  precioServicios: number;
  precioAcabados: number;
  precioUnitarioFinal: number;
  precioTotal: number;
  desglose: {
    base: { descripcion: string; valor: number };
    servicios: Array<{ nombre: string; valor: number; descripcion: string }>;
    acabados: Array<{ nombre: string; valor: number; descripcion: string }>;
  };
}

interface CalculatePriceParams {
  producto: Producto | WizardItemData;
  cantidad: number;
  tecnologiaId?: string;
  tipoTinta?: string;
  caraImpresion?: string;
  medidas?: { ancho: number; alto: number };
  materialId?: string;
  varianteNombre?: string;
  espesor?: number;
  servicios?: Array<{
    servicio: Servicio;
    nivelPrecio?: ServicioNivelPrecio;
  }>;
  acabados?: Array<{
    acabado: Acabado;
    nivelPrecio?: AcabadoNivelPrecio;
  }>;
}

interface PriceCache {
  key: string;
  price: number;
  timestamp: number;
}

function isWizardItemData(producto: any): producto is WizardItemData {
  return 'producto_id' in producto && 'producto_nombre' in producto && 'servicios_disponibles' in producto;
}

function normalizeQueryParam(value: string | undefined | null): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value;
}

export function usePriceCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { company } = useAuth();
  const priceCache = useRef<Map<string, PriceCache>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const getPrecioBase = useCallback(
    async (
      productoId: string,
      tecnologiaId: string | null,
      tipoTinta: string | null,
      caraImpresion: string | null,
      cantidad: number,
      materialId?: string,
      varianteNombre?: string,
      requiereSinRangos: boolean = false
    ): Promise<number> => {
      if (!productoId || cantidad <= 0) {
        return 0;
      }

      try {
        const normalizedMaterialId = normalizeQueryParam(materialId);
        const normalizedVarianteNombre = normalizeQueryParam(varianteNombre);
        const normalizedTecnologiaId = normalizeQueryParam(tecnologiaId);
        const normalizedTipoTinta = normalizeQueryParam(tipoTinta);
        const normalizedCaraImpresion = normalizeQueryParam(caraImpresion);

        console.log('[getPrecioBase] DEBUG:', {
          productoId,
          cantidad,
          requiereSinRangos,
          materialId: normalizedMaterialId,
          varianteNombre: normalizedVarianteNombre,
          tecnologiaId: normalizedTecnologiaId,
          tipoTinta: normalizedTipoTinta,
          caraImpresion: normalizedCaraImpresion
        });

        let query = supabase
          .from('productos_precios')
          .select('precio_venta')
          .eq('producto_id', productoId)
          .eq('cantidad', cantidad);

        if (requiereSinRangos) {
          query = query.is('rango_min', null).is('rango_max', null);
        }

        if (normalizedMaterialId !== null) {
          query = query.eq('material_id', normalizedMaterialId);
        } else {
          query = query.is('material_id', null);
        }

        if (normalizedVarianteNombre !== null) {
          query = query.eq('variante_nombre', normalizedVarianteNombre);
        } else {
          query = query.is('variante_nombre', null);
        }

        if (normalizedTecnologiaId !== null) {
          query = query.eq('tecnologia_id', normalizedTecnologiaId);
        } else {
          query = query.is('tecnologia_id', null);
        }

        if (normalizedTipoTinta !== null) {
          query = query.eq('tipo_tinta', normalizedTipoTinta);
        } else {
          query = query.is('tipo_tinta', null);
        }

        if (normalizedCaraImpresion !== null) {
          query = query.eq('cara_impresion', normalizedCaraImpresion);
        } else {
          query = query.is('cara_impresion', null);
        }

        const { data, error: fetchError } = await query.maybeSingle();

        console.log('[getPrecioBase] Result:', { data, error: fetchError });

        if (fetchError) {
          console.error('[getPrecioBase] Error en consulta:', fetchError.message);
          return 0;
        }

        if (!data) {
          console.warn('[getPrecioBase] No se encontró precio base para los parámetros especificados');
          console.warn('[getPrecioBase] Parámetros:', {
            productoId,
            cantidad,
            materialId: normalizedMaterialId,
            varianteNombre: normalizedVarianteNombre,
            tecnologiaId: normalizedTecnologiaId,
            tipoTinta: normalizedTipoTinta,
            caraImpresion: normalizedCaraImpresion
          });
          return 0;
        }

        return data.precio_venta || 0;
      } catch (err) {
        console.warn('Error obteniendo precio base:', err);
        return 0;
      }
    },
    []
  );

  const calculateMetrosCuadrados = (ancho: number, alto: number): number => {
    return (ancho * alto) / 10000;
  };

  const calculateMetrosLineales = (ancho: number): number => {
    return ancho / 100;
  };

  const getPrecioConRangos = useCallback(
    async (
      productoId: string,
      tecnologiaId: string | null,
      tipoTinta: string | null,
      caraImpresion: string | null,
      cantidadTotal: number,
      rangoId?: string,
      materialId?: string,
      varianteNombre?: string
    ): Promise<number> => {
      try {
        console.log('[getPrecioConRangos] DEBUG:', {
          productoId,
          cantidadTotal,
          rangoId,
          materialId,
          varianteNombre,
          tecnologiaId,
          tipoTinta,
          caraImpresion
        });

        if (!rangoId || !company?.id) {
          console.log('[getPrecioConRangos] No rangoId or company');
          return 0;
        }

        const { data: rango, error: rangoError } = await supabase
          .from('rangos_precio')
          .select('rangos')
          .eq('id', rangoId)
          .eq('company_id', company.id)
          .maybeSingle();

        console.log('[getPrecioConRangos] Rango data:', rango);

        if (rangoError) throw rangoError;
        if (!rango || !rango.rangos) return 0;

        const rangoAplicable = rango.rangos.find(
          (r: any) => cantidadTotal >= r.min && (r.max === null || cantidadTotal <= r.max)
        );

        console.log('[getPrecioConRangos] Rango aplicable:', rangoAplicable);

        if (!rangoAplicable) {
          const ultimoRango = rango.rangos[rango.rangos.length - 1];
          if (ultimoRango.max === null || cantidadTotal > ultimoRango.max) {
            return await getPrecioBaseRango(
              productoId,
              tecnologiaId,
              tipoTinta,
              caraImpresion,
              ultimoRango.min,
              ultimoRango.max,
              materialId,
              varianteNombre
            );
          }
          return 0;
        }

        return await getPrecioBaseRango(
          productoId,
          tecnologiaId,
          tipoTinta,
          caraImpresion,
          rangoAplicable.min,
          rangoAplicable.max,
          materialId,
          varianteNombre
        );
      } catch (err) {
        console.error('Error obteniendo precio con rangos:', err);
        return 0;
      }
    },
    [company]
  );

  const getPrecioBaseRango = useCallback(
    async (
      productoId: string,
      tecnologiaId: string | null,
      tipoTinta: string | null,
      caraImpresion: string | null,
      rangoMin: number,
      rangoMax: number | null,
      materialId?: string,
      varianteNombre?: string
    ): Promise<number> => {
      try {
        const normalizedMaterialId = normalizeQueryParam(materialId);
        const normalizedVarianteNombre = normalizeQueryParam(varianteNombre);
        const normalizedTecnologiaId = normalizeQueryParam(tecnologiaId);
        const normalizedTipoTinta = normalizeQueryParam(tipoTinta);
        const normalizedCaraImpresion = normalizeQueryParam(caraImpresion);

        console.log('[getPrecioBaseRango] Parámetros normalizados:', {
          productoId,
          rangoMin,
          rangoMax,
          normalizedMaterialId,
          normalizedVarianteNombre,
          normalizedTecnologiaId,
          normalizedTipoTinta,
          normalizedCaraImpresion
        });

        let query = supabase
          .from('productos_precios')
          .select('*')
          .eq('producto_id', productoId);

        if (normalizedMaterialId !== null) {
          query = query.eq('material_id', normalizedMaterialId);
        } else {
          query = query.is('material_id', null);
        }

        if (normalizedVarianteNombre !== null) {
          query = query.eq('variante_nombre', normalizedVarianteNombre);
        } else {
          query = query.is('variante_nombre', null);
        }

        if (normalizedTecnologiaId !== null) {
          query = query.eq('tecnologia_id', normalizedTecnologiaId);
        } else {
          query = query.is('tecnologia_id', null);
        }

        if (normalizedTipoTinta !== null) {
          query = query.eq('tipo_tinta', normalizedTipoTinta);
        } else {
          query = query.is('tipo_tinta', null);
        }

        if (normalizedCaraImpresion !== null) {
          query = query.eq('cara_impresion', normalizedCaraImpresion);
        } else {
          query = query.is('cara_impresion', null);
        }

        query = query.eq('rango_min', rangoMin);

        if (rangoMax !== null) {
          query = query.eq('rango_max', rangoMax);
        } else {
          query = query.is('rango_max', null);
        }

        const { data, error: fetchError } = await query.maybeSingle();

        console.log('[getPrecioBaseRango] Resultado de consulta:', {
          data,
          error: fetchError,
          precio: data?.precio_venta || 0
        });

        if (fetchError) {
          console.error('[getPrecioBaseRango] Error en consulta:', fetchError);
          throw fetchError;
        }

        if (!data) {
          console.warn('[getPrecioBaseRango] No se encontró precio para los parámetros especificados');
          console.warn('[getPrecioBaseRango] Esto puede significar que:');
          console.warn('  1. El producto no existe en la base de datos');
          console.warn('  2. No se han configurado precios para este producto');
          console.warn('  3. La combinación de material/variante/rango no tiene precio definido');
          return 0;
        }

        return data.precio_venta || 0;
      } catch (err) {
        console.error('[getPrecioBaseRango] Error:', err);
        return 0;
      }
    },
    []
  );

  const calculateImpactoServicio = useCallback(
    (
      tipoImpacto: TipoImpactoPrecio,
      valorImpacto: number,
      valorImpactoSecundario: number | null,
      precioBase: number,
      cantidad: number,
      medidas?: { ancho: number; alto: number }
    ): number => {
      switch (tipoImpacto) {
        case 'sin_impacto':
          return 0;

        case 'precio_fijo':
          return valorImpacto;

        case 'por_unidad':
          return valorImpacto * cantidad;

        case 'porcentual':
          return (precioBase * valorImpacto) / 100;

        case 'por_mt2':
          if (medidas) {
            const mt2 = calculateMetrosCuadrados(medidas.ancho, medidas.alto);
            return valorImpacto * mt2 * cantidad;
          }
          return 0;

        case 'por_mt_lineal':
          if (medidas) {
            const mtLineal = calculateMetrosLineales(medidas.ancho);
            return valorImpacto * mtLineal * cantidad;
          }
          return 0;

        case 'fijo_porcentual':
          return valorImpacto + (precioBase * (valorImpactoSecundario || 0)) / 100;

        case 'fijo_mt2':
          if (medidas) {
            const mt2 = calculateMetrosCuadrados(medidas.ancho, medidas.alto);
            return valorImpacto + (valorImpactoSecundario || 0) * mt2 * cantidad;
          }
          return valorImpacto;

        case 'fijo_mt_lineal':
          if (medidas) {
            const mtLineal = calculateMetrosLineales(medidas.ancho);
            return valorImpacto + (valorImpactoSecundario || 0) * mtLineal * cantidad;
          }
          return valorImpacto;

        case 'por_minuto':
          return valorImpacto * cantidad;

        case 'fijo_minuto':
          return valorImpacto + (valorImpactoSecundario || 0) * cantidad;

        default:
          return 0;
      }
    },
    []
  );

  const getDescripcionImpacto = useCallback(
    (
      tipoImpacto: TipoImpactoPrecio,
      valorImpacto: number,
      valorImpactoSecundario: number | null,
      medidas?: { ancho: number; alto: number }
    ): string => {
      switch (tipoImpacto) {
        case 'sin_impacto':
          return 'Sin impacto';

        case 'precio_fijo':
          return `Precio fijo: $${valorImpacto.toFixed(2)}`;

        case 'por_unidad':
          return `$${valorImpacto.toFixed(2)} por unidad`;

        case 'porcentual':
          return `${valorImpacto}% del precio base`;

        case 'por_mt2':
          if (medidas) {
            const mt2 = calculateMetrosCuadrados(medidas.ancho, medidas.alto);
            return `$${valorImpacto.toFixed(2)} por m² (${mt2.toFixed(2)} m²)`;
          }
          return `$${valorImpacto.toFixed(2)} por m²`;

        case 'por_mt_lineal':
          if (medidas) {
            const mtLineal = calculateMetrosLineales(medidas.ancho);
            return `$${valorImpacto.toFixed(2)} por metro lineal (${mtLineal.toFixed(2)} m)`;
          }
          return `$${valorImpacto.toFixed(2)} por metro lineal`;

        case 'fijo_porcentual':
          return `$${valorImpacto.toFixed(2)} + ${valorImpactoSecundario || 0}%`;

        case 'fijo_mt2':
          return `$${valorImpacto.toFixed(2)} + $${(valorImpactoSecundario || 0).toFixed(2)} por m²`;

        case 'fijo_mt_lineal':
          return `$${valorImpacto.toFixed(2)} + $${(valorImpactoSecundario || 0).toFixed(2)} por metro lineal`;

        case 'por_minuto':
          return `$${valorImpacto.toFixed(2)} por minuto`;

        case 'fijo_minuto':
          return `$${valorImpacto.toFixed(2)} + minutos`;

        default:
          return 'Impacto desconocido';
      }
    },
    []
  );

  const getCachedPrice = useCallback((key: string): number | null => {
    const cached = priceCache.current.get(key);
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.price;
    }
    return null;
  }, []);

  const setCachedPrice = useCallback((key: string, price: number) => {
    priceCache.current.set(key, { key, price, timestamp: Date.now() });
    if (priceCache.current.size > 100) {
      const oldestKey = Array.from(priceCache.current.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      priceCache.current.delete(oldestKey);
    }
  }, []);

  const calculatePrice = useCallback(
    async (params: CalculatePriceParams): Promise<PriceCalculation> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const {
        producto,
        cantidad,
        tecnologiaId,
        tipoTinta,
        caraImpresion,
        medidas,
        materialId,
        varianteNombre,
        espesor,
        servicios = [],
        acabados = [],
      } = params;

      if (!producto || cantidad <= 0) {
        return {
          precioBase: 0,
          precioServicios: 0,
          precioAcabados: 0,
          precioUnitarioFinal: 0,
          precioTotal: 0,
          desglose: {
            base: { descripcion: 'Producto no seleccionado', valor: 0 },
            servicios: [],
            acabados: [],
          },
        };
      }

      const productoId = isWizardItemData(producto) ? producto.producto_id : producto.id;
      const pricingInfo = isWizardItemData(producto)
        ? { unidad_pricing: producto.unidad_pricing, rango_precio_id: producto.rango_precio_id, tiene_descuento: producto.tiene_descuento }
        : producto.pricing;

      try {
        setLoading(true);
        setError(null);

        let precioBase = 0;
        const { unidad_pricing, rango_precio_id, tiene_descuento } = pricingInfo || {};

        console.log('[calculatePrice] Inicio:', {
          productoId,
          unidad_pricing,
          rango_precio_id,
          tiene_descuento,
          cantidad,
          tecnologiaId,
          tipoTinta,
          caraImpresion,
          materialId,
          varianteNombre,
          espesor,
          medidas
        });

        if (unidad_pricing === 'mt2' && medidas) {
          const mt2 = calculateMetrosCuadrados(medidas.ancho, medidas.alto);
          const mt2Totales = mt2 * cantidad;

          const cacheKey = `${productoId}_${materialId}_${varianteNombre}_${espesor}_${tecnologiaId}_${tipoTinta}_${caraImpresion}_mt2_${mt2Totales}`;
          const cachedPrice = getCachedPrice(cacheKey);

          if (cachedPrice !== null) {
            precioBase = cachedPrice * mt2;
          } else if (tiene_descuento && rango_precio_id) {
            const precioPorMt2 = await getPrecioConRangos(
              productoId,
              tecnologiaId || null,
              tipoTinta || null,
              caraImpresion || null,
              mt2Totales,
              rango_precio_id,
              materialId,
              varianteNombre
            );
            setCachedPrice(cacheKey, precioPorMt2);
            precioBase = precioPorMt2 * mt2;
          } else {
            const precioPorMt2 = await getPrecioBase(
              productoId,
              tecnologiaId || null,
              tipoTinta || null,
              caraImpresion || null,
              1,
              materialId,
              varianteNombre
            );
            setCachedPrice(cacheKey, precioPorMt2);
            precioBase = precioPorMt2 * mt2;
          }
        } else if (unidad_pricing === 'mt_lineal' && medidas) {
          const mtLineal = calculateMetrosLineales(medidas.ancho);
          const mtLinealesTotales = mtLineal * cantidad;

          const cacheKey = `${productoId}_${materialId}_${varianteNombre}_${espesor}_${tecnologiaId}_${tipoTinta}_${caraImpresion}_mtlineal_${mtLinealesTotales}`;
          const cachedPrice = getCachedPrice(cacheKey);

          if (cachedPrice !== null) {
            precioBase = cachedPrice * mtLineal;
          } else if (tiene_descuento && rango_precio_id) {
            const precioPorMtLineal = await getPrecioConRangos(
              productoId,
              tecnologiaId || null,
              tipoTinta || null,
              caraImpresion || null,
              mtLinealesTotales,
              rango_precio_id,
              materialId,
              varianteNombre
            );
            setCachedPrice(cacheKey, precioPorMtLineal);
            precioBase = precioPorMtLineal * mtLineal;
          } else {
            const precioPorMtLineal = await getPrecioBase(
              productoId,
              tecnologiaId || null,
              tipoTinta || null,
              caraImpresion || null,
              1,
              materialId,
              varianteNombre
            );
            setCachedPrice(cacheKey, precioPorMtLineal);
            precioBase = precioPorMtLineal * mtLineal;
          }
        } else if (unidad_pricing === 'cantidades_fijas' || unidad_pricing === 'por_unidad') {
          const cacheKey = `${productoId}_${materialId}_${varianteNombre}_${espesor}_${tecnologiaId}_${tipoTinta}_${caraImpresion}_cantidad_${cantidad}`;
          const cachedPrice = getCachedPrice(cacheKey);

          if (cachedPrice !== null) {
            precioBase = cachedPrice;
          } else {
            precioBase = await getPrecioBase(
              productoId,
              tecnologiaId || null,
              tipoTinta || null,
              caraImpresion || null,
              cantidad,
              materialId,
              varianteNombre,
              true
            );
            setCachedPrice(cacheKey, precioBase);
          }
        } else {
          const cacheKey = `${productoId}_${materialId}_${varianteNombre}_${espesor}_${tecnologiaId}_${tipoTinta}_${caraImpresion}_cantidad_${cantidad}`;
          const cachedPrice = getCachedPrice(cacheKey);

          if (cachedPrice !== null) {
            precioBase = cachedPrice;
          } else {
            precioBase = await getPrecioBase(
              productoId,
              tecnologiaId || null,
              tipoTinta || null,
              caraImpresion || null,
              cantidad,
              materialId,
              varianteNombre
            );
            setCachedPrice(cacheKey, precioBase);
          }
        }

        if (precioBase === 0) {
          console.warn('[calculatePrice] No se encontró precio base. Verifica que:');
          console.warn('  1. El producto existe en la base de datos');
          console.warn('  2. Se han configurado precios para este producto en la sección de Precios');
          console.warn('  3. Los parámetros de búsqueda (material, variante, cantidad, etc.) coinciden con los precios configurados');
        }

        const serviciosDesglose: Array<{ nombre: string; valor: number; descripcion: string }> =
          [];
        let precioServicios = 0;

        for (const { servicio, nivelPrecio } of servicios) {
          let impacto = 0;
          let descripcion = '';

          if (nivelPrecio) {
            impacto = calculateImpactoServicio(
              nivelPrecio.tipo_impacto,
              nivelPrecio.valor_impacto,
              nivelPrecio.valor_impacto_secundario,
              precioBase,
              cantidad,
              medidas
            );
            descripcion = getDescripcionImpacto(
              nivelPrecio.tipo_impacto,
              nivelPrecio.valor_impacto,
              nivelPrecio.valor_impacto_secundario,
              medidas
            );
          } else if (servicio.tipo_impacto && servicio.valor_impacto !== null) {
            impacto = calculateImpactoServicio(
              servicio.tipo_impacto,
              servicio.valor_impacto,
              servicio.valor_impacto_secundario,
              precioBase,
              cantidad,
              medidas
            );
            descripcion = getDescripcionImpacto(
              servicio.tipo_impacto,
              servicio.valor_impacto,
              servicio.valor_impacto_secundario,
              medidas
            );
          }

          if (impacto > 0) {
            serviciosDesglose.push({
              nombre: nivelPrecio ? `${servicio.nombre} - ${nivelPrecio.nombre}` : servicio.nombre,
              valor: impacto,
              descripcion,
            });
            precioServicios += impacto;
          }
        }

        const acabadosDesglose: Array<{ nombre: string; valor: number; descripcion: string }> = [];
        let precioAcabados = 0;

        for (const { acabado, nivelPrecio } of acabados) {
          let impacto = 0;
          let descripcion = '';

          if (nivelPrecio) {
            impacto = calculateImpactoServicio(
              nivelPrecio.tipo_impacto,
              nivelPrecio.valor_impacto,
              nivelPrecio.valor_impacto_secundario,
              precioBase,
              cantidad,
              medidas
            );
            descripcion = getDescripcionImpacto(
              nivelPrecio.tipo_impacto,
              nivelPrecio.valor_impacto,
              nivelPrecio.valor_impacto_secundario,
              medidas
            );
          } else if (acabado.tipo_impacto && acabado.valor_impacto !== null) {
            impacto = calculateImpactoServicio(
              acabado.tipo_impacto,
              acabado.valor_impacto,
              acabado.valor_impacto_secundario,
              precioBase,
              cantidad,
              medidas
            );
            descripcion = getDescripcionImpacto(
              acabado.tipo_impacto,
              acabado.valor_impacto,
              acabado.valor_impacto_secundario,
              medidas
            );
          }

          if (impacto > 0) {
            acabadosDesglose.push({
              nombre: nivelPrecio ? `${acabado.nombre} - ${nivelPrecio.nombre}` : acabado.nombre,
              valor: impacto,
              descripcion,
            });
            precioAcabados += impacto;
          }
        }

        let precioUnitarioFinal: number;
        let precioTotal: number;

        if (unidad_pricing === 'cantidades_fijas') {
          precioTotal = precioBase + precioServicios + precioAcabados;
          precioUnitarioFinal = precioTotal / cantidad;
        } else if (unidad_pricing === 'mt2' && medidas) {
          precioUnitarioFinal = precioBase + precioServicios + precioAcabados;
          precioTotal = precioUnitarioFinal * cantidad;
        } else if (unidad_pricing === 'mt_lineal' && medidas) {
          precioUnitarioFinal = precioBase + precioServicios + precioAcabados;
          precioTotal = precioUnitarioFinal * cantidad;
        } else {
          precioUnitarioFinal = precioBase + precioServicios + precioAcabados;
          precioTotal = precioUnitarioFinal * cantidad;
        }

        return {
          precioBase,
          precioServicios,
          precioAcabados,
          precioUnitarioFinal,
          precioTotal,
          desglose: {
            base: {
              descripcion: unidad_pricing === 'cantidades_fijas'
                ? `Precio base por ${cantidad} unidades`
                : `Precio base (cantidad: ${cantidad})`,
              valor: precioBase,
            },
            servicios: serviciosDesglose,
            acabados: acabadosDesglose,
          },
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al calcular precio';
        setError(errorMessage);
        console.error('Error calculating price:', err);

        return {
          precioBase: 0,
          precioServicios: 0,
          precioAcabados: 0,
          precioUnitarioFinal: 0,
          precioTotal: 0,
          desglose: {
            base: { descripcion: 'Error', valor: 0 },
            servicios: [],
            acabados: [],
          },
        };
      } finally {
        setLoading(false);
      }
    },
    [getPrecioBase, getPrecioConRangos, calculateImpactoServicio, getDescripcionImpacto, getCachedPrice, setCachedPrice]
  );

  return {
    calculatePrice,
    loading,
    error,
  };
}
