import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  CentroCopiadoOrdenItem,
  TipoItemCopiado,
  TipoTintaCopiado,
  CaraImpresaCopiado,
  TipoAnillado,
  TipoPlastificado
} from '../types/database';

interface OrdenItemWithRelations extends CentroCopiadoOrdenItem {
  tamanio_papel?: {
    id: string;
    nombre: string;
    ancho_mm: number;
    alto_mm: number;
  };
  papel?: {
    id: string;
    material_id: string;
    variante_nombre: string;
    espesor: number | null;
    unidad_espesor: string | null;
  };
}

interface CreateItemImpresionData {
  orden_copiado_id: string;
  tamanio_papel_id: string;
  papel_id: string;
  tipo_tinta: TipoTintaCopiado;
  cara_impresa: CaraImpresaCopiado;
  cantidad_hojas: number;
  cantidad_unidades: number;
  tipo_anillado?: TipoAnillado;
  tipo_plastificado?: TipoPlastificado;
  cantidad_plastificado?: number;
  con_guillotinado?: boolean;
  precio_unitario: number;
  subtotal: number;
  descripcion?: string;
}

export function useCentroCopiadoOrdenItems(ordenCopiadoId?: string) {
  const { profile } = useAuth();
  const [items, setItems] = useState<OrdenItemWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!profile?.company_id || !ordenCopiadoId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('centro_copiado_ordenes_items')
        .select(
          `
          *,
          tamanio_papel:centro_copiado_tamanios_papel(id, nombre, ancho_mm, alto_mm),
          papel:centro_copiado_papeles(id, material_id, variante_nombre, espesor, unidad_espesor)
        `
        )
        .eq('orden_copiado_id', ordenCopiadoId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      setItems((data || []) as OrdenItemWithRelations[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar items');
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, ordenCopiadoId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const createItemImpresion = useCallback(
    async (data: CreateItemImpresionData) => {
      if (!profile?.company_id) {
        setError('No se pudo obtener la información del usuario');
        return null;
      }

      try {
        setError(null);

        const itemData: Partial<CentroCopiadoOrdenItem> = {
          orden_copiado_id: data.orden_copiado_id,
          tipo_item: 'impresion',
          tamanio_papel_id: data.tamanio_papel_id,
          papel_id: data.papel_id,
          tipo_tinta: data.tipo_tinta,
          cara_impresa: data.cara_impresa,
          cantidad_hojas: data.cantidad_hojas,
          cantidad_unidades: data.cantidad_unidades,
          tipo_anillado: data.tipo_anillado || null,
          tipo_plastificado: data.tipo_plastificado || null,
          con_guillotinado: data.con_guillotinado || false,
          precio_unitario: data.precio_unitario,
          subtotal: data.subtotal,
          descripcion: data.descripcion || null,
        };

        const { data: newItem, error: insertError } = await supabase
          .from('centro_copiado_ordenes_items')
          .insert(itemData)
          .select()
          .single();

        if (insertError) throw insertError;

        await fetchItems();
        await updateOrdenTotal(data.orden_copiado_id);
        return newItem;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al crear item';
        setError(errorMessage);
        console.error('Error creating item:', err);
        return null;
      }
    },
    [profile?.company_id, fetchItems]
  );

  const createItemAnillado = useCallback(
    async (ordenCopiadoId: string, tipoAnillado: TipoAnillado, cantidadUnidades: number, precio: number) => {
      if (!profile?.company_id) {
        setError('No se pudo obtener la información del usuario');
        return null;
      }

      try {
        setError(null);

        const itemData: Partial<CentroCopiadoOrdenItem> = {
          orden_copiado_id: ordenCopiadoId,
          tipo_item: 'anillado',
          tipo_anillado: tipoAnillado,
          cantidad_unidades: cantidadUnidades,
          precio_unitario: precio,
          subtotal: precio * cantidadUnidades,
          tamanio_papel_id: null,
          papel_id: null,
          tipo_tinta: null,
          cara_impresa: null,
          cantidad_hojas: null,
          tipo_plastificado: null,
        };

        const { data: newItem, error: insertError } = await supabase
          .from('centro_copiado_ordenes_items')
          .insert(itemData)
          .select()
          .single();

        if (insertError) throw insertError;

        await fetchItems();
        await updateOrdenTotal(ordenCopiadoId);
        return newItem;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al crear item de anillado';
        setError(errorMessage);
        console.error('Error creating anillado item:', err);
        return null;
      }
    },
    [profile?.company_id, fetchItems]
  );

  const createItemPlastificado = useCallback(
    async (ordenCopiadoId: string, tipoPlastificado: TipoPlastificado, cantidadUnidades: number, precio: number) => {
      if (!profile?.company_id) {
        setError('No se pudo obtener la información del usuario');
        return null;
      }

      try {
        setError(null);

        const itemData: Partial<CentroCopiadoOrdenItem> = {
          orden_copiado_id: ordenCopiadoId,
          tipo_item: 'plastificado',
          tipo_plastificado: tipoPlastificado,
          cantidad_unidades: cantidadUnidades,
          precio_unitario: precio,
          subtotal: precio * cantidadUnidades,
          tamanio_papel_id: null,
          papel_id: null,
          tipo_tinta: null,
          cara_impresa: null,
          cantidad_hojas: null,
          tipo_anillado: null,
        };

        const { data: newItem, error: insertError } = await supabase
          .from('centro_copiado_ordenes_items')
          .insert(itemData)
          .select()
          .single();

        if (insertError) throw insertError;

        await fetchItems();
        await updateOrdenTotal(ordenCopiadoId);
        return newItem;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al crear item de plastificado';
        setError(errorMessage);
        console.error('Error creating plastificado item:', err);
        return null;
      }
    },
    [profile?.company_id, fetchItems]
  );

  const updateItem = useCallback(
    async (itemId: string, updates: Partial<CentroCopiadoOrdenItem>) => {
      if (!profile?.company_id) {
        setError('No se pudo obtener la información del usuario');
        return false;
      }

      try {
        setError(null);

        const { error: updateError } = await supabase
          .from('centro_copiado_ordenes_items')
          .update(updates)
          .eq('id', itemId);

        if (updateError) throw updateError;

        await fetchItems();
        if (ordenCopiadoId) {
          await updateOrdenTotal(ordenCopiadoId);
        }
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al actualizar item';
        setError(errorMessage);
        console.error('Error updating item:', err);
        return false;
      }
    },
    [profile?.company_id, fetchItems, ordenCopiadoId]
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!profile?.company_id) {
        setError('No se pudo obtener la información del usuario');
        return false;
      }

      try {
        setError(null);

        const { error: deleteError } = await supabase
          .from('centro_copiado_ordenes_items')
          .delete()
          .eq('id', itemId);

        if (deleteError) throw deleteError;

        await fetchItems();
        if (ordenCopiadoId) {
          await updateOrdenTotal(ordenCopiadoId);
        }
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al eliminar item';
        setError(errorMessage);
        console.error('Error deleting item:', err);
        return false;
      }
    },
    [profile?.company_id, fetchItems, ordenCopiadoId]
  );

  const updateOrdenTotal = async (ordenId: string) => {
    try {
      const { data: items } = await supabase
        .from('centro_copiado_ordenes_items')
        .select('subtotal')
        .eq('orden_copiado_id', ordenId);

      if (items) {
        const total = items.reduce((sum, item) => sum + Number(item.subtotal), 0);

        await supabase
          .from('centro_copiado_ordenes')
          .update({ total })
          .eq('id', ordenId);
      }
    } catch (err) {
      console.error('Error updating orden total:', err);
    }
  };

  return {
    items,
    loading,
    error,
    fetchItems,
    createItemImpresion,
    createItemAnillado,
    createItemPlastificado,
    updateItem,
    deleteItem,
  };
}
