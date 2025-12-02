import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type {
  PresupuestoItem,
  PresupuestoItemConProducto,
  CreatePresupuestoItemData,
  UpdatePresupuestoItemData,
  CreateItemPersonalizadoData,
} from '../types/presupuestos';

export function usePresupuestoItems(presupuestoId: string | undefined) {
  const [items, setItems] = useState<PresupuestoItemConProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (presupuestoId) {
      fetchItems();
    } else {
      setItems([]);
      setLoading(false);
    }
  }, [presupuestoId]);

  const fetchItems = async () => {
    if (!presupuestoId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('presupuestos_items')
        .select('*')
        .eq('presupuesto_id', presupuestoId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      setItems((data as PresupuestoItemConProducto[]) || []);
    } catch (err: any) {
      console.error('Error fetching presupuesto items:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (
    data: CreatePresupuestoItemData
  ): Promise<PresupuestoItem | null> => {
    try {
      setError(null);

      const { data: newItem, error: createError } = await supabase
        .from('presupuestos_items')
        .insert(data)
        .select()
        .single();

      if (createError) throw createError;

      await fetchItems();
      return newItem as PresupuestoItem;
    } catch (err: any) {
      console.error('Error adding item:', err);
      setError(err.message);
      return null;
    }
  };

  const addItemPersonalizado = async (
    data: CreateItemPersonalizadoData
  ): Promise<PresupuestoItem | null> => {
    try {
      setError(null);

      const itemData: CreatePresupuestoItemData = {
        presupuesto_id: data.presupuesto_id,
        tipo_item: 'item_personalizado',
        producto_nombre: data.producto_nombre,
        configuracion: {},
        cantidad: data.cantidad,
        precio_base: 0,
        precio_servicios: 0,
        precio_acabados: 0,
        precio_unitario_final: data.precio_unitario_final,
        precio_total: data.cantidad * data.precio_unitario_final,
        descripcion: data.descripcion,
        tiempo_produccion_dias: data.tiempo_produccion_dias,
      };

      return await addItem(itemData);
    } catch (err: any) {
      console.error('Error adding item personalizado:', err);
      setError(err.message);
      return null;
    }
  };

  const updateItem = async (
    id: string,
    data: UpdatePresupuestoItemData
  ): Promise<boolean> => {
    try {
      setError(null);

      // Recalcular precio_total si cambia cantidad o precio_unitario_final
      const updateData = { ...data };
      if (data.cantidad !== undefined || data.precio_unitario_final !== undefined) {
        const item = items.find((i) => i.id === id);
        if (item) {
          const cantidad = data.cantidad ?? item.cantidad;
          const precioUnitario =
            data.precio_unitario_final ?? item.precio_unitario_final;
          updateData.precio_total = cantidad * precioUnitario;
        }
      }

      const { error: updateError } = await supabase
        .from('presupuestos_items')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchItems();
      return true;
    } catch (err: any) {
      console.error('Error updating item:', err);
      setError(err.message);
      return false;
    }
  };

  const deleteItem = async (id: string): Promise<boolean> => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('presupuestos_items')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchItems();
      return true;
    } catch (err: any) {
      console.error('Error deleting item:', err);
      setError(err.message);
      return false;
    }
  };

  const duplicarItem = async (id: string): Promise<PresupuestoItem | null> => {
    try {
      setError(null);

      const item = items.find((i) => i.id === id);
      if (!item) {
        throw new Error('Item no encontrado');
      }

      const itemDuplicado: CreatePresupuestoItemData = {
        presupuesto_id: item.presupuesto_id,
        tipo_item: item.tipo_item,
        producto_id: item.producto_id,
        producto_nombre: item.producto_nombre,
        producto_categoria: item.producto_categoria,
        configuracion: item.configuracion,
        cantidad: item.cantidad,
        precio_base: item.precio_base,
        precio_servicios: item.precio_servicios,
        precio_acabados: item.precio_acabados,
        precio_unitario_final: item.precio_unitario_final,
        precio_total: item.precio_total,
        descripcion: item.descripcion
          ? `${item.descripcion} (Copia)`
          : undefined,
        tiempo_produccion_dias: item.tiempo_produccion_dias,
      };

      return await addItem(itemDuplicado);
    } catch (err: any) {
      console.error('Error duplicando item:', err);
      setError(err.message);
      return null;
    }
  };

  // Calcular totales
  const calcularTotales = () => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.precio_total), 0);
    const totalItems = items.length;
    const totalUnidades = items.reduce((sum, item) => sum + Number(item.cantidad), 0);

    return {
      subtotal,
      totalItems,
      totalUnidades,
    };
  };

  return {
    items,
    loading,
    error,
    totales: calcularTotales(),
    refetch: fetchItems,
    addItem,
    addItemPersonalizado,
    updateItem,
    deleteItem,
    duplicarItem,
  };
}
