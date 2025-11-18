import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface MaterialInfo {
  material_id: string;
  material_nombre: string;
  variante_nombre: string;
  espesor: number | null;
}

export interface ProductoMaterialRigidoParaPrecios {
  id: string;
  producto_materiales_rigidos_id: string;
  nombre: string;
  medida_placa_ancho: number;
  medida_placa_alto: number;
  material: MaterialInfo;
  precio_actual: ProductoMaterialRigidoPrecio | null;
}

export interface ProductoMaterialRigidoPrecio {
  id: string;
  company_id: string;
  producto_materiales_rigidos_id: string;
  material_id: string;
  variante_nombre: string;
  espesor: number | null;
  medida_placa_ancho: number;
  medida_placa_alto: number;
  precio_placa: number;
  precio_mt2: number;
  created_at: string;
  updated_at: string;
}

export interface PrecioMRInput {
  producto_materiales_rigidos_id: string;
  material_id: string;
  variante_nombre: string;
  espesor: number | null;
  medida_placa_ancho: number;
  medida_placa_alto: number;
  precio_placa: number;
}

interface ProductosAgrupados {
  [materialId: string]: {
    material_nombre: string;
    productos: ProductoMaterialRigidoParaPrecios[];
  };
}

interface PreciosModificadosPorProducto {
  [productoComboKey: string]: PrecioMRInput; // Key format: "productoId-varianteNombre-espesor"
}

export function useAllProductosMaterialesRigidosPrecios() {
  const [productosAgrupados, setProductosAgrupados] = useState<ProductosAgrupados>({});
  const [preciosModificados, setPreciosModificados] = useState<PreciosModificadosPorProducto>({});
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

      // 1. Fetch all active productos materiales rigidos
      const { data: productosData, error: productosError } = await supabase
        .from('productos_materiales_rigidos')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('nombre', { ascending: true });

      if (productosError) throw productosError;

      if (!productosData || productosData.length === 0) {
        setProductosAgrupados({});
        setIsLoading(false);
        return;
      }

      const productoIds = productosData.map((p) => p.id);

      // 2. Fetch all related data in parallel
      const [materialesRes, preciosRes, materialesInfoRes] = await Promise.all([
        // Relaciones de materiales para cada producto (cada registro es una combinación única variante-espesor)
        supabase
          .from('productos_materiales_rigidos_materiales')
          .select('producto_materiales_rigidos_id, material_id, variante_nombre, espesor')
          .in('producto_materiales_rigidos_id', productoIds),
        // Precios existentes
        supabase
          .from('productos_materiales_rigidos_precios')
          .select('*')
          .in('producto_materiales_rigidos_id', productoIds)
          .eq('company_id', profile.company_id),
        // Info de materiales para obtener nombres
        supabase.from('materiales').select('id, nombre'),
      ]);

      if (materialesRes.error) throw materialesRes.error;
      if (preciosRes.error) throw preciosRes.error;
      if (materialesInfoRes.error) throw materialesInfoRes.error;

      // 3. Create material info lookup map
      const materialesMap = new Map<string, string>();
      (materialesInfoRes.data || []).forEach((mat: any) => {
        materialesMap.set(mat.id, mat.nombre);
      });

      // 4. Group materiales by producto (múltiples combinaciones por producto)
      const materialesByProducto = new Map<string, any[]>();
      (materialesRes.data || []).forEach((mat: any) => {
        if (!materialesByProducto.has(mat.producto_materiales_rigidos_id)) {
          materialesByProducto.set(mat.producto_materiales_rigidos_id, []);
        }
        materialesByProducto.get(mat.producto_materiales_rigidos_id)!.push(mat);
      });

      // 5. Group precios by producto + variante + espesor
      const preciosByComboKey = new Map<string, ProductoMaterialRigidoPrecio>();
      (preciosRes.data || []).forEach((precio: any) => {
        // Normalizar el espesor a string para evitar problemas de comparación
        const espesorStr = precio.espesor !== null ? String(Number(precio.espesor).toFixed(2)) : 'null';
        const key = `${precio.producto_materiales_rigidos_id}-${precio.variante_nombre}-${espesorStr}`;
        preciosByComboKey.set(key, precio);
      });

      // 6. Build complete product objects grouped by material
      // Cada combinación variante-espesor será un "producto" independiente en la tabla
      const agrupados: ProductosAgrupados = {};

      productosData.forEach((producto) => {
        const combinacionesMaterial = materialesByProducto.get(producto.id) || [];

        // Para cada combinación variante-espesor, crear un registro en la tabla
        combinacionesMaterial.forEach((materialRelacion) => {
          const materialNombre = materialesMap.get(materialRelacion.material_id) || 'Material Desconocido';
          const materialId = materialRelacion.material_id;

          // Normalizar el espesor para la clave de búsqueda
          const espesorNormalizado = materialRelacion.espesor !== null
            ? Number(materialRelacion.espesor).toFixed(2)
            : 'null';
          const comboKey = `${producto.id}-${materialRelacion.variante_nombre}-${espesorNormalizado}`;
          const precioActual = preciosByComboKey.get(comboKey) || null;

          const productoCompleto: ProductoMaterialRigidoParaPrecios = {
            id: comboKey, // ID único por combinación
            producto_materiales_rigidos_id: producto.id, // UUID original del producto
            nombre: producto.nombre,
            medida_placa_ancho: producto.medidas_ancho,
            medida_placa_alto: producto.medidas_alto,
            material: {
              material_id: materialId,
              material_nombre: materialNombre,
              variante_nombre: materialRelacion.variante_nombre,
              espesor: materialRelacion.espesor !== null ? Number(materialRelacion.espesor) : null,
            },
            precio_actual: precioActual,
          };

          // Group by material
          if (!agrupados[materialId]) {
            agrupados[materialId] = {
              material_nombre: materialNombre,
              productos: [],
            };
          }

          agrupados[materialId].productos.push(productoCompleto);
        });
      });

      // 7. Sort products within each material group
      Object.values(agrupados).forEach((grupo) => {
        grupo.productos.sort((a, b) => {
          // Primero por nombre de producto
          const nombreComp = a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
          if (nombreComp !== 0) return nombreComp;

          // Luego por variante
          const varianteComp = a.material.variante_nombre.localeCompare(b.material.variante_nombre, 'es', { sensitivity: 'base' });
          if (varianteComp !== 0) return varianteComp;

          // Finalmente por espesor (numérico, null al final)
          if (a.material.espesor === null && b.material.espesor === null) return 0;
          if (a.material.espesor === null) return 1;
          if (b.material.espesor === null) return -1;
          return a.material.espesor - b.material.espesor;
        });
      });

      setProductosAgrupados(agrupados);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar productos');
      console.error('Error fetching productos con precios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePrecioForProducto = (productoComboKey: string, precio: PrecioMRInput) => {
    setPreciosModificados((prev) => ({
      ...prev,
      [productoComboKey]: precio,
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

      // Save each product's price
      for (const productoComboKey of productosModificados) {
        const precio = preciosModificados[productoComboKey];

        // Check if price already exists for this specific combination
        let query = supabase
          .from('productos_materiales_rigidos_precios')
          .select('id')
          .eq('producto_materiales_rigidos_id', precio.producto_materiales_rigidos_id)
          .eq('material_id', precio.material_id)
          .eq('variante_nombre', precio.variante_nombre)
          .eq('company_id', profile.company_id);

        // Manejar espesor null o numérico
        if (precio.espesor === null) {
          query = query.is('espesor', null);
        } else {
          query = query.eq('espesor', Number(precio.espesor));
        }

        const { data: existingPrice } = await query.maybeSingle();

        if (existingPrice) {
          // Update existing price
          const { error: updateError } = await supabase
            .from('productos_materiales_rigidos_precios')
            .update({
              precio_placa: precio.precio_placa,
              medida_placa_ancho: precio.medida_placa_ancho,
              medida_placa_alto: precio.medida_placa_alto,
            })
            .eq('id', existingPrice.id);

          if (updateError) throw updateError;
        } else {
          // Insert new price
          const { error: insertError } = await supabase
            .from('productos_materiales_rigidos_precios')
            .insert({
              company_id: profile.company_id,
              producto_materiales_rigidos_id: precio.producto_materiales_rigidos_id,
              material_id: precio.material_id,
              variante_nombre: precio.variante_nombre,
              espesor: precio.espesor,
              espesores: precio.espesor !== null ? [precio.espesor] : [], // Mantener array para compatibilidad
              medida_placa_ancho: precio.medida_placa_ancho,
              medida_placa_alto: precio.medida_placa_alto,
              precio_placa: precio.precio_placa,
              precio_mt2: 0, // Will be calculated by trigger
            });

          if (insertError) throw insertError;
        }
      }

      // Clear modified prices and refetch
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
    return Object.keys(preciosModificados).length;
  };

  const hasUnsavedChanges = () => {
    return Object.keys(preciosModificados).length > 0;
  };

  const clearChanges = () => {
    setPreciosModificados({});
  };

  // Calculate m² for a placa
  const calcularM2Placa = (ancho: number, alto: number): number => {
    return (ancho * alto) / 10000;
  };

  // Calculate price per m²
  const calcularPrecioM2 = (precioPlaca: number, ancho: number, alto: number): number => {
    const m2 = calcularM2Placa(ancho, alto);
    return m2 > 0 ? precioPlaca / m2 : 0;
  };

  return {
    productosAgrupados,
    preciosModificados,
    isLoading,
    isSaving,
    error,
    updatePrecioForProducto,
    saveAllPrecios,
    getPreciosModificadosCount,
    hasUnsavedChanges,
    clearChanges,
    calcularM2Placa,
    calcularPrecioM2,
    refetch: fetchAllProductosConPrecios,
  };
}
