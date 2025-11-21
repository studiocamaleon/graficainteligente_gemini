import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { ProductoTalonarioPrecio, PrecioInput } from './useProductosTalonariosPrecios';

// Las tintas ahora son strings simples después de la reversión de normalización
export type TintaInfo = string;

export interface ProductoTalonarioParaPrecios {
  id: string;
  nombre: string;
  medidas_disponibles: Array<{ ancho: number; alto: number }>;
  tipo_copia: string[];
  tipo_venta: 'unidades' | 'cantidades_fijas';
  cantidades_fijas: number[];
  tecnologias: Array<{
    tecnologia_id: string;
    tecnologia_nombre: string;
    tintas: TintaInfo[];
  }>;
  materiales: Array<{
    material_nombre: string;
    variante_nombre: string;
    espesor: number | null;
    unidad_espesor: string | null;
  }>;
  precios_existentes: ProductoTalonarioPrecio[];
}

export interface CombinacionPrecio {
  medida: { ancho: number; alto: number };
  tinta: TintaInfo;
  cantidades: number[];
  tipo_copia: string[];
}

interface PreciosModificadosPorProducto {
  [productoId: string]: PrecioInput[];
}

interface PreciosSnapshot {
  [productoId: string]: PrecioInput[];
}

export function useAllProductosTalonariosPrecios() {
  const [productos, setProductos] = useState<ProductoTalonarioParaPrecios[]>([]);
  const [preciosModificados, setPreciosModificados] = useState<PreciosModificadosPorProducto>({});
  const [preciosSnapshot, setPreciosSnapshot] = useState<PreciosSnapshot>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.company_id) {
      fetchAllProductosConPrecios();
    }
  }, [profile?.company_id]);

  const fetchAllProductosConPrecios = async () => {
    if (!profile?.company_id) return;

    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch all active talonario products
      const { data: productosData, error: productosError } = await supabase
        .from('productos_talonarios')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (productosError) throw productosError;

      if (!productosData || productosData.length === 0) {
        setProductos([]);
        setIsLoading(false);
        return;
      }

      const productoIds = productosData.map((p) => p.id);

      // 2. Fetch all related data in parallel
      const [tecnologiasRes, preciosRes, materialesRes] = await Promise.all([
        // Tecnologías con sus tintas
        supabase
          .from('productos_talonarios_tecnologias')
          .select('producto_talonario_id, tecnologia_id, tintas, tecnologias(nombre)')
          .in('producto_talonario_id', productoIds),
        // Precios existentes
        supabase
          .from('productos_talonarios_precios')
          .select('*')
          .in('producto_talonario_id', productoIds)
          .eq('company_id', profile.company_id),
        // Materiales
        supabase
          .from('productos_talonarios_materiales')
          .select('producto_talonario_id, materiales(nombre, unidad_espesor), variante_nombre, espesor')
          .in('producto_talonario_id', productoIds),
      ]);

      if (tecnologiasRes.error) throw tecnologiasRes.error;
      if (preciosRes.error) throw preciosRes.error;
      if (materialesRes.error) throw materialesRes.error;

      // 4. Group data by product
      const tecnologiasByProducto = new Map<string, any[]>();
      (tecnologiasRes.data || []).forEach((tec: any) => {
        if (!tecnologiasByProducto.has(tec.producto_talonario_id)) {
          tecnologiasByProducto.set(tec.producto_talonario_id, []);
        }
        tecnologiasByProducto.get(tec.producto_talonario_id)!.push(tec);
      });

      const preciosByProducto = new Map<string, ProductoTalonarioPrecio[]>();
      (preciosRes.data || []).forEach((precio: any) => {
        if (!preciosByProducto.has(precio.producto_talonario_id)) {
          preciosByProducto.set(precio.producto_talonario_id, []);
        }
        preciosByProducto.get(precio.producto_talonario_id)!.push(precio);
      });

      const materialesByProducto = new Map<string, any[]>();
      (materialesRes.data || []).forEach((mat: any) => {
        if (!materialesByProducto.has(mat.producto_talonario_id)) {
          materialesByProducto.set(mat.producto_talonario_id, []);
        }
        materialesByProducto.get(mat.producto_talonario_id)!.push(mat);
      });

      // 5. Build complete product objects
      const productosCompletos: ProductoTalonarioParaPrecios[] = productosData.map((producto) => {
        const tecnologias = (tecnologiasByProducto.get(producto.id) || []).map((tec: any) => {
          // Las tintas ahora son strings simples
          const tintasArray: TintaInfo[] = tec.tintas || [];

          return {
            tecnologia_id: tec.tecnologia_id,
            tecnologia_nombre: tec.tecnologias?.nombre || 'Sin nombre',
            tintas: tintasArray,
          };
        });

        const materiales = (materialesByProducto.get(producto.id) || []).map((mat: any) => ({
          material_nombre: mat.materiales?.nombre || 'Sin nombre',
          variante_nombre: mat.variante_nombre,
          espesor: mat.espesor,
          unidad_espesor: mat.materiales?.unidad_espesor || null,
        }));

        return {
          id: producto.id,
          nombre: producto.nombre,
          medidas_disponibles: producto.medidas_disponibles || [],
          tipo_copia: producto.tipo_copia || [],
          tipo_venta: producto.tipo_venta,
          cantidades_fijas: producto.cantidades_fijas || [],
          tecnologias,
          materiales,
          precios_existentes: preciosByProducto.get(producto.id) || [],
        };
      });

      setProductos(productosCompletos);

      // 6. Create initial snapshot of existing prices for comparison
      const initialSnapshot: PreciosSnapshot = {};
      productosCompletos.forEach((producto) => {
        const preciosExistentes = producto.precios_existentes.map((precio) => ({
          medida_ancho: precio.medida_ancho,
          medida_alto: precio.medida_alto,
          tinta: precio.tinta,
          cantidad: precio.cantidad,
          tipo_copia: precio.tipo_copia,
          precio: precio.precio,
        }));
        initialSnapshot[producto.id] = preciosExistentes;
      });
      setPreciosSnapshot(initialSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar productos');
      console.error('Error fetching productos con precios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to create a unique key for a precio
  const createPrecioKey = (precio: PrecioInput): string => {
    return `${precio.medida_ancho}-${precio.medida_alto}-${precio.tinta}-${precio.cantidad}-${precio.tipo_copia}`;
  };

  // Helper function to compare two precio arrays and find actual changes
  const getChangedPrecios = (
    currentPrecios: PrecioInput[],
    snapshotPrecios: PrecioInput[]
  ): PrecioInput[] => {
    const changedPrecios: PrecioInput[] = [];

    // Create maps for quick lookup
    const snapshotMap = new Map<string, number>();
    snapshotPrecios.forEach((p) => {
      snapshotMap.set(createPrecioKey(p), p.precio);
    });

    const currentMap = new Map<string, number>();
    currentPrecios.forEach((p) => {
      currentMap.set(createPrecioKey(p), p.precio);
    });

    // Find new or modified prices
    currentPrecios.forEach((currentPrecio) => {
      const key = createPrecioKey(currentPrecio);
      const snapshotPrecio = snapshotMap.get(key);

      // It's a change if: precio is new OR precio value has changed
      if (snapshotPrecio === undefined || snapshotPrecio !== currentPrecio.precio) {
        changedPrecios.push(currentPrecio);
      }
    });

    // Find deleted prices (existed in snapshot but not in current)
    snapshotPrecios.forEach((snapshotPrecio) => {
      const key = createPrecioKey(snapshotPrecio);
      if (!currentMap.has(key)) {
        // Price was deleted, add it with precio 0 to mark for deletion
        changedPrecios.push({
          ...snapshotPrecio,
          precio: 0,
        });
      }
    });

    return changedPrecios;
  };

  const updatePreciosForProducto = (productoId: string, precios: PrecioInput[]) => {
    setPreciosModificados((prev) => ({
      ...prev,
      [productoId]: precios,
    }));
  };

  const saveAllPrecios = async () => {
    if (!profile?.company_id) {
      throw new Error('No se pudo obtener el company_id del usuario');
    }

    const productosModificados = Object.keys(preciosModificados);
    if (productosModificados.length === 0) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Save each product's prices
      for (const productoId of productosModificados) {
        const precios = preciosModificados[productoId];

        // Filter valid prices (precio > 0)
        const preciosValidos = precios.filter((p) => p.precio > 0);

        // Separate prices to upsert vs delete
        const preciosParaUpsert = preciosValidos.map((precio) => ({
          company_id: profile.company_id,
          producto_talonario_id: productoId,
          medida_ancho: precio.medida_ancho,
          medida_alto: precio.medida_alto,
          tinta: precio.tinta,
          cantidad: precio.cantidad,
          tipo_copia: precio.tipo_copia,
          precio: precio.precio,
        }));

        // Find prices with precio = 0 or empty (need to be deleted)
        const preciosParaEliminar = precios.filter((p) => p.precio <= 0);

        // Upsert valid prices (insert or update)
        if (preciosParaUpsert.length > 0) {
          const { error: upsertError } = await supabase
            .from('productos_talonarios_precios')
            .upsert(preciosParaUpsert, {
              onConflict: 'producto_talonario_id,medida_ancho,medida_alto,tinta,cantidad,tipo_copia',
              ignoreDuplicates: false,
            });

          if (upsertError) throw upsertError;
        }

        // Delete prices that were set to 0 or empty
        for (const precio of preciosParaEliminar) {
          const { error: deleteError } = await supabase
            .from('productos_talonarios_precios')
            .delete()
            .eq('producto_talonario_id', productoId)
            .eq('company_id', profile.company_id)
            .eq('medida_ancho', precio.medida_ancho)
            .eq('medida_alto', precio.medida_alto)
            .eq('tinta', precio.tinta)
            .eq('cantidad', precio.cantidad)
            .eq('tipo_copia', precio.tipo_copia);

          if (deleteError) throw deleteError;
        }
      }

      // Clear modified prices and refetch to update snapshot
      setPreciosModificados({});
      await fetchAllProductosConPrecios();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al guardar precios';
      setError(errorMsg);
      console.error('Error saving all precios:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const getPreciosModificadosCount = () => {
    let totalChanges = 0;

    Object.keys(preciosModificados).forEach((productoId) => {
      const currentPrecios = preciosModificados[productoId];
      const snapshotPrecios = preciosSnapshot[productoId] || [];

      // Get only the prices that have actually changed since initial load
      const changedPrecios = getChangedPrecios(currentPrecios, snapshotPrecios);
      totalChanges += changedPrecios.length;
    });

    return totalChanges;
  };

  const hasUnsavedChanges = () => {
    return getPreciosModificadosCount() > 0;
  };

  const clearChanges = () => {
    setPreciosModificados({});
  };

  return {
    productos,
    preciosModificados,
    isLoading,
    isSaving,
    error,
    updatePreciosForProducto,
    saveAllPrecios,
    getPreciosModificadosCount,
    hasUnsavedChanges,
    clearChanges,
    refetch: fetchAllProductosConPrecios,
  };
}
