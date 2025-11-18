import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { normalizeRangoMax, normalizeRangoMin } from '../utils/rangoUtils';

export interface RangoPrecio {
  min: number;
  max: number;
}

export interface TecnologiaConTintas {
  id: string;
  nombre: string;
  tintas: string[];
}

export interface ProductoGFParaPrecios {
  id: string;
  nombre: string;
  tipo_venta: 'mt2' | 'mt_lineal';
  rango_precio_id: string | null;
  rango_precio?: {
    id: string;
    nombre: string;
    unidad_medida: string;
    rangos: RangoPrecio[];
  } | null;
  tecnologias: TecnologiaConTintas[];
}

export interface PrecioProducto {
  rango_min: number;
  rango_max: number;
  precio: number;
}

export interface ProductoPorRango {
  id: string;
  nombre: string;
  rango_precio_id: string;
  rango_nombre: string;
  unidad_medida: string;
  rangos: RangoPrecio[];
  tipo_venta: 'mt2' | 'mt_lineal';
  ancho_fijo?: number;
  precios?: PrecioProducto[];
}

export interface TecnologiaAgrupada {
  id: string;
  nombre: string;
  tintas: {
    tinta: string;
    productosPorRango: Map<string, ProductoPorRango[]>;
  }[];
}

export interface PrecioGFInput {
  producto_gran_formato_id: string;
  tecnologia_id: string;
  tinta: string;
  rango_precio_min: number;
  rango_precio_max: number;
  precio: number;
}

interface PreciosModificados {
  [productoId: string]: PrecioGFInput[];
}

interface PreciosSnapshot {
  [key: string]: number; // key: "productoId-tecnologiaId-tinta-rangoMin-rangoMax" => precio
}

// Helper function to create a unique key for a precio
const createPrecioKey = (precio: PrecioGFInput): string => {
  return `${precio.producto_gran_formato_id}-${precio.tecnologia_id}-${precio.tinta}-${precio.rango_precio_min}-${precio.rango_precio_max}`;
};

// Helper function to compare current precios against snapshot and find actual changes
const getChangedPrecios = (
  currentPrecios: PrecioGFInput[],
  snapshot: PreciosSnapshot
): PrecioGFInput[] => {
  const changedPrecios: PrecioGFInput[] = [];

  // Create a map of current precios
  const currentMap = new Map<string, number>();
  currentPrecios.forEach((p) => {
    currentMap.set(createPrecioKey(p), p.precio);
  });

  // Find new or modified prices
  currentPrecios.forEach((currentPrecio) => {
    const key = createPrecioKey(currentPrecio);
    const snapshotPrecio = snapshot[key];

    // It's a change if: precio is new OR precio value has changed
    if (snapshotPrecio === undefined || snapshotPrecio !== currentPrecio.precio) {
      changedPrecios.push(currentPrecio);
    }
  });

  // Find deleted prices (existed in snapshot but not in current)
  Object.keys(snapshot).forEach((key) => {
    if (!currentMap.has(key)) {
      // Price was deleted - we need to track this
      // Parse the key back to components to add to changed list
      const [productoId, tecnologiaId, tinta, rangoMin, rangoMax] = key.split('-');
      changedPrecios.push({
        producto_gran_formato_id: productoId,
        tecnologia_id: tecnologiaId,
        tinta: tinta,
        rango_precio_min: parseFloat(rangoMin),
        rango_precio_max: parseFloat(rangoMax),
        precio: 0, // Mark as deleted with precio 0
      });
    }
  });

  return changedPrecios;
};

export function useAllProductosGranFormatoPrecios() {
  const { user } = useAuth();
  const [productos, setProductos] = useState<ProductoGFParaPrecios[]>([]);
  const [tecnologiasAgrupadas, setTecnologiasAgrupadas] = useState<TecnologiaAgrupada[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preciosModificados, setPreciosModificados] = useState<PreciosModificados>({});
  const [preciosSnapshot, setPreciosSnapshot] = useState<PreciosSnapshot>({});
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Get company_id for current user
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
        .from('productos_gran_formato')
        .select('id, nombre, tipo_venta, rango_precio_id, anchos_disponibles')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (productosError) throw productosError;

      if (!productosData || productosData.length === 0) {
        setProductos([]);
        setIsLoading(false);
        return;
      }

      // Fetch tecnologías y tintas para cada producto
      const productosConDatos = await Promise.all(
        productosData.map(async (producto) => {
          // Fetch tecnologías
          const { data: tecnologiasData } = await supabase
            .from('productos_gran_formato_tecnologias')
            .select(`
              tecnologia_id,
              tintas,
              tecnologias (
                id,
                nombre
              )
            `)
            .eq('producto_gran_formato_id', producto.id);

          const tecnologias: TecnologiaConTintas[] =
            tecnologiasData?.map((t: any) => ({
              id: t.tecnologia_id,
              nombre: t.tecnologias.nombre,
              tintas: t.tintas || [],
            })) || [];

          // Fetch rango de precio si está asignado
          let rangoPrecio = null;
          if (producto.rango_precio_id) {
            const { data: rangoData } = await supabase
              .from('rangos_precio')
              .select('id, nombre, unidad_medida, rangos')
              .eq('id', producto.rango_precio_id)
              .maybeSingle();

            if (rangoData) {
              // Normalizar los valores max de los rangos al cargarlos desde la BD
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
            tecnologias,
            rango_precio: rangoPrecio,
          };
        })
      );

      // Filtrar solo productos que tienen rango de precio asignado
      const productosConRango = productosConDatos.filter(
        (p) => p.rango_precio !== null
      );

      setProductos(productosConRango);

      // Fetch existing precios for all products
      const productoIds = productosConRango.map((p) => p.id);
      let preciosMap = new Map<string, Map<string, Map<string, PrecioProducto[]>>>();

      if (productoIds.length > 0) {
        const { data: preciosExistentes } = await supabase
          .from('productos_gran_formato_precios')
          .select('producto_gran_formato_id, tecnologia_id, tinta, rango_precio_min, rango_precio_max, precio')
          .in('producto_gran_formato_id', productoIds)
          .eq('company_id', companyId);

        if (preciosExistentes) {
          preciosExistentes.forEach((precio) => {
            const productoId = precio.producto_gran_formato_id;
            const tecnologiaId = precio.tecnologia_id;
            const tinta = precio.tinta;

            if (!preciosMap.has(productoId)) {
              preciosMap.set(productoId, new Map());
            }
            if (!preciosMap.get(productoId)!.has(tecnologiaId)) {
              preciosMap.get(productoId)!.set(tecnologiaId, new Map());
            }
            if (!preciosMap.get(productoId)!.get(tecnologiaId)!.has(tinta)) {
              preciosMap.get(productoId)!.get(tecnologiaId)!.set(tinta, []);
            }

            preciosMap.get(productoId)!.get(tecnologiaId)!.get(tinta)!.push({
              rango_min: normalizeRangoMin(precio.rango_precio_min),
              rango_max: normalizeRangoMax(precio.rango_precio_max),
              precio: precio.precio,
            });
          });
        }
      }

      // Agrupar por tecnología
      const tecnologiasMap = new Map<string, TecnologiaAgrupada>();

      productosConRango.forEach((producto) => {
        producto.tecnologias.forEach((tecnologia) => {
          if (!tecnologiasMap.has(tecnologia.id)) {
            tecnologiasMap.set(tecnologia.id, {
              id: tecnologia.id,
              nombre: tecnologia.nombre,
              tintas: [],
            });
          }

          const tecData = tecnologiasMap.get(tecnologia.id)!;

          tecnologia.tintas.forEach((tinta) => {
            let tintaData = tecData.tintas.find((t) => t.tinta === tinta);
            if (!tintaData) {
              tintaData = {
                tinta,
                productosPorRango: new Map(),
              };
              tecData.tintas.push(tintaData);
            }

            const rangoKey = producto.rango_precio_id || 'sin-rango';
            if (!tintaData.productosPorRango.has(rangoKey)) {
              tintaData.productosPorRango.set(rangoKey, []);
            }

            const precios = preciosMap.get(producto.id)?.get(tecnologia.id)?.get(tinta) || [];

            tintaData.productosPorRango.get(rangoKey)!.push({
              id: producto.id,
              nombre: producto.nombre,
              rango_precio_id: producto.rango_precio_id!,
              rango_nombre: producto.rango_precio?.nombre || '',
              unidad_medida: producto.rango_precio?.unidad_medida || '',
              rangos: producto.rango_precio?.rangos || [],
              tipo_venta: producto.tipo_venta,
              ancho_fijo: producto.tipo_venta === 'mt_lineal' && producto.anchos_disponibles.length > 0
                ? producto.anchos_disponibles[0]
                : undefined,
              precios: precios.length > 0 ? precios : undefined,
            });
          });
        });
      });

      setTecnologiasAgrupadas(Array.from(tecnologiasMap.values()));

      // Create snapshot from already loaded precios
      if (productoIds.length > 0) {
        const initialSnapshot: PreciosSnapshot = {};
        preciosMap.forEach((tecnologiasMap, productoId) => {
          tecnologiasMap.forEach((tintasMap, tecnologiaId) => {
            tintasMap.forEach((precios, tinta) => {
              precios.forEach((precio) => {
                const key = createPrecioKey({
                  producto_gran_formato_id: productoId,
                  tecnologia_id: tecnologiaId,
                  tinta: tinta,
                  rango_precio_min: precio.rango_min,
                  rango_precio_max: precio.rango_max,
                  precio: precio.precio,
                });
                initialSnapshot[key] = precio.precio;
              });
            });
          });
        });
        setPreciosSnapshot(initialSnapshot);
      }
    } catch (err) {
      console.error('Error fetching productos:', err);
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

  const updatePreciosForProducto = useCallback(
    (productoId: string, precios: PrecioGFInput[]) => {
      setPreciosModificados((prev) => ({
        ...prev,
        [productoId]: precios,
      }));
    },
    []
  );

  const saveAllPrecios = useCallback(async () => {
    if (!companyId) return;

    try {
      setIsSaving(true);
      setError(null);

      const allPrecios: PrecioGFInput[] = Object.values(preciosModificados).flat();

      if (allPrecios.length === 0) {
        return;
      }

      // Delete existing precios for modified productos
      const productosIds = Object.keys(preciosModificados);
      for (const productoId of productosIds) {
        await supabase
          .from('productos_gran_formato_precios')
          .delete()
          .eq('producto_gran_formato_id', productoId)
          .eq('company_id', companyId);
      }

      // Insert new precios with normalized range values
      const preciosToInsert = allPrecios.map((precio) => ({
        ...precio,
        company_id: companyId,
        rango_precio_min: normalizeRangoMin(precio.rango_precio_min),
        rango_precio_max: normalizeRangoMax(precio.rango_precio_max),
      }));

      const { error: insertError } = await supabase
        .from('productos_gran_formato_precios')
        .insert(preciosToInsert);

      if (insertError) throw insertError;

      // Update snapshot with new prices
      const newSnapshot: PreciosSnapshot = { ...preciosSnapshot };
      allPrecios.forEach((precio) => {
        const key = createPrecioKey(precio);
        newSnapshot[key] = precio.precio;
      });
      setPreciosSnapshot(newSnapshot);

      // Clear modified precios
      setPreciosModificados({});
    } catch (err) {
      console.error('Error saving precios:', err);
      setError(
        err instanceof Error ? err.message : 'Error al guardar los precios'
      );
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [preciosModificados, companyId]);

  const getPreciosModificadosCount = useCallback(() => {
    let totalChanges = 0;

    Object.keys(preciosModificados).forEach((productoId) => {
      const currentPrecios = preciosModificados[productoId];

      // Get only the prices that have actually changed since initial load
      const changedPrecios = getChangedPrecios(currentPrecios, preciosSnapshot);
      totalChanges += changedPrecios.length;
    });

    return totalChanges;
  }, [preciosModificados, preciosSnapshot]);

  const hasUnsavedChanges = useCallback(() => {
    return Object.keys(preciosModificados).length > 0;
  }, [preciosModificados]);

  return {
    productos,
    tecnologiasAgrupadas,
    isLoading,
    isSaving,
    error,
    updatePreciosForProducto,
    saveAllPrecios,
    getPreciosModificadosCount,
    hasUnsavedChanges,
  };
}
