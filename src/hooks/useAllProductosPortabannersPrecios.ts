import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { normalizeRangoMax, normalizeRangoMin } from '../utils/rangoUtils';

export interface RangoPrecio {
  min: number;
  max: number;
}

export interface TecnologiaSimple {
  id: string;
  nombre: string;
}

export interface ProductoPortabannerParaPrecios {
  id: string;
  nombre: string;
  ancho_cm: number;
  alto_cm: number;
  rango_precio_id: string | null;
  rango_precio?: {
    id: string;
    nombre: string;
    unidad_medida: string;
    rangos: RangoPrecio[];
  } | null;
  tecnologias: TecnologiaSimple[];
}

export interface PrecioPortabanner {
  tecnologia_id: string;
  rango_min: number;
  rango_max: number;
  precio: number;
}

export interface ProductoConPrecios {
  id: string;
  nombre: string;
  ancho_cm: number;
  alto_cm: number;
  rango_precio_id: string;
  rango_nombre: string;
  unidad_medida: string;
  rangos: RangoPrecio[];
  tecnologias: TecnologiaSimple[];
  precios?: Map<string, PrecioPortabanner[]>; // key: tecnologia_id
}

export interface PrecioPortabannerInput {
  producto_id: string;
  tecnologia_id: string;
  rango_precio_min: number;
  rango_precio_max: number;
  precio: number;
}

interface PreciosSnapshot {
  [key: string]: number; // key: "productoId-tecnologiaId-rangoMin-rangoMax" => precio
}

const createPrecioKey = (precio: PrecioPortabannerInput): string => {
  return `${precio.producto_id}-${precio.tecnologia_id}-${precio.rango_precio_min}-${precio.rango_precio_max}`;
};

export function useAllProductosPortabannersPrecios() {
  const { user } = useAuth();
  const [productos, setProductos] = useState<ProductoConPrecios[]>([]);
  const [tecnologias, setTecnologias] = useState<TecnologiaSimple[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preciosModificados, setPreciosModificados] = useState<PrecioPortabannerInput[]>([]);
  const [preciosSnapshot, setPreciosSnapshot] = useState<PreciosSnapshot>({});
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompanyId() {
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setCompanyId(profile.company_id);
      }
    }

    fetchCompanyId();
  }, [user]);

  const fetchProductos = useCallback(async () => {
    if (!companyId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch productos activos
      const { data: productosData, error: productosError } = await supabase
        .from('productos_portabanners')
        .select('id, nombre, ancho_cm, alto_cm, rango_precio_id')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('nombre', { ascending: true });

      if (productosError) throw productosError;

      if (!productosData || productosData.length === 0) {
        setProductos([]);
        setTecnologias([]);
        setIsLoading(false);
        return;
      }

      // Fetch tecnologías únicas de todos los productos
      const tecnologiasSet = new Map<string, TecnologiaSimple>();

      const productosConDatos = await Promise.all(
        productosData.map(async (producto) => {
          // Fetch tecnologías del producto
          const { data: tecnologiasData } = await supabase
            .from('productos_portabanners_tecnologias')
            .select(`
              tecnologia_id,
              tecnologias (
                id,
                nombre
              )
            `)
            .eq('producto_id', producto.id);

          const productoTecnologias: TecnologiaSimple[] =
            tecnologiasData?.map((t: any) => {
              const tec = {
                id: t.tecnologia_id,
                nombre: t.tecnologias.nombre,
              };
              tecnologiasSet.set(tec.id, tec);
              return tec;
            }) || [];

          // Fetch rango de precio si está asignado
          let rangoPrecio = null;
          if (producto.rango_precio_id) {
            const { data: rangoData } = await supabase
              .from('rangos_precio')
              .select('id, nombre, unidad_medida, rangos')
              .eq('id', producto.rango_precio_id)
              .maybeSingle();

            if (rangoData) {
              const rangosNormalizados = (rangoData.rangos as RangoPrecio[]).map(rango => ({
                min: normalizeRangoMin(rango.min),
                max: normalizeRangoMax(rango.max),
              }));

              rangoPrecio = {
                id: rangoData.id,
                nombre: rangoData.nombre,
                unidad_medida: rangoData.unidad_medida,
                rangos: rangosNormalizados,
              };
            }
          }

          return {
            ...producto,
            tecnologias: productoTecnologias,
            rango_precio: rangoPrecio,
          };
        })
      );

      // Filtrar solo productos que tienen rango de precio asignado
      const productosConRango = productosConDatos.filter(
        (p) => p.rango_precio !== null
      );

      if (productosConRango.length === 0) {
        setProductos([]);
        setTecnologias([]);
        setIsLoading(false);
        return;
      }

      // Fetch precios existentes
      const productosIds = productosConRango.map((p) => p.id);
      const preciosMap = new Map<string, Map<string, PrecioPortabanner[]>>();

      const { data: preciosExistentes } = await supabase
        .from('productos_portabanners_precios')
        .select('producto_id, tecnologia_id, cantidad_desde, cantidad_hasta, precio')
        .in('producto_id', productosIds)
        .eq('company_id', companyId);

      if (preciosExistentes) {
        preciosExistentes.forEach((precio) => {
          const productoId = precio.producto_id;
          const tecnologiaId = precio.tecnologia_id;

          if (!preciosMap.has(productoId)) {
            preciosMap.set(productoId, new Map());
          }
          if (!preciosMap.get(productoId)!.has(tecnologiaId)) {
            preciosMap.get(productoId)!.set(tecnologiaId, []);
          }

          preciosMap.get(productoId)!.get(tecnologiaId)!.push({
            tecnologia_id: tecnologiaId,
            rango_min: normalizeRangoMin(precio.cantidad_desde),
            rango_max: normalizeRangoMax(precio.cantidad_hasta),
            precio: precio.precio,
          });
        });
      }

      // Construir productos finales con precios
      const productosFinales: ProductoConPrecios[] = productosConRango.map((producto) => ({
        id: producto.id,
        nombre: producto.nombre,
        ancho_cm: producto.ancho_cm,
        alto_cm: producto.alto_cm,
        rango_precio_id: producto.rango_precio_id!,
        rango_nombre: producto.rango_precio?.nombre || '',
        unidad_medida: producto.rango_precio?.unidad_medida || '',
        rangos: producto.rango_precio?.rangos || [],
        tecnologias: producto.tecnologias,
        precios: preciosMap.get(producto.id),
      }));

      setProductos(productosFinales);
      setTecnologias(Array.from(tecnologiasSet.values()));

      // Create snapshot
      const initialSnapshot: PreciosSnapshot = {};
      preciosMap.forEach((tecnologiasMap, productoId) => {
        tecnologiasMap.forEach((precios, tecnologiaId) => {
          precios.forEach((precio) => {
            const key = createPrecioKey({
              producto_id: productoId,
              tecnologia_id: tecnologiaId,
              rango_precio_min: precio.rango_min,
              rango_precio_max: precio.rango_max,
              precio: precio.precio,
            });
            initialSnapshot[key] = precio.precio;
          });
        });
      });
      setPreciosSnapshot(initialSnapshot);
    } catch (err) {
      console.error('Error fetching productos portabanners:', err);
      setError(
        err instanceof Error ? err.message : 'Error al cargar los productos'
      );
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchProductos();
    }
  }, [companyId, fetchProductos]);

  const updatePrecios = useCallback((precios: PrecioPortabannerInput[]) => {
    setPreciosModificados(precios);
  }, []);

  const saveAllPrecios = useCallback(async () => {
    if (!companyId) return;

    try {
      setIsSaving(true);
      setError(null);

      if (preciosModificados.length === 0) {
        return;
      }

      // Agrupar por producto + tecnología para borrado selectivo
      const combinacionesUnicas = new Map<string, { producto_id: string; tecnologia_id: string }>();

      preciosModificados.forEach((precio) => {
        const key = `${precio.producto_id}-${precio.tecnologia_id}`;
        if (!combinacionesUnicas.has(key)) {
          combinacionesUnicas.set(key, {
            producto_id: precio.producto_id,
            tecnologia_id: precio.tecnologia_id,
          });
        }
      });

      // Borrar precios existentes solo para las combinaciones modificadas
      for (const combinacion of combinacionesUnicas.values()) {
        const { error: deleteError } = await supabase
          .from('productos_portabanners_precios')
          .delete()
          .eq('producto_id', combinacion.producto_id)
          .eq('tecnologia_id', combinacion.tecnologia_id)
          .eq('company_id', companyId);

        if (deleteError) throw deleteError;
      }

      // Insertar nuevos precios
      const preciosToInsert = preciosModificados
        .filter((p) => p.precio > 0)
        .map((precio) => ({
          company_id: companyId,
          producto_id: precio.producto_id,
          ancho_cm: productos.find((p) => p.id === precio.producto_id)?.ancho_cm || 0,
          alto_cm: productos.find((p) => p.id === precio.producto_id)?.alto_cm || 0,
          tecnologia_id: precio.tecnologia_id,
          cantidad_desde: normalizeRangoMin(precio.rango_precio_min),
          cantidad_hasta: normalizeRangoMax(precio.rango_precio_max),
          precio: precio.precio,
        }));

      if (preciosToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('productos_portabanners_precios')
          .insert(preciosToInsert);

        if (insertError) throw insertError;
      }

      // Update snapshot
      const newSnapshot: PreciosSnapshot = { ...preciosSnapshot };
      preciosModificados.forEach((precio) => {
        const key = createPrecioKey(precio);
        newSnapshot[key] = precio.precio;
      });
      setPreciosSnapshot(newSnapshot);

      // Clear modified precios
      setPreciosModificados([]);

      // Refresh data
      await fetchProductos();
    } catch (err) {
      console.error('Error saving precios portabanners:', err);
      setError(
        err instanceof Error ? err.message : 'Error al guardar los precios'
      );
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [preciosModificados, companyId, productos, preciosSnapshot, fetchProductos]);

  const hasUnsavedChanges = useCallback(() => {
    return preciosModificados.length > 0;
  }, [preciosModificados]);

  return {
    productos,
    tecnologias,
    isLoading,
    isSaving,
    error,
    updatePrecios,
    saveAllPrecios,
    hasUnsavedChanges,
  };
}
