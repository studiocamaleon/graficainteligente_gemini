import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Acabado, AcabadoNivelPrecio, AcabadoPaso, TipoImpactoPrecio } from '../types/database';

interface AcabadoWithDetails extends Acabado {
  acabados_categorias?: {
    categoria_id: string;
    categoria?: {
      id: string;
      nombre: string;
      color: string;
    };
  }[];
  estacion?: { id: string; nombre: string };
  niveles_precio?: AcabadoNivelPrecio[];
  pasos?: AcabadoPaso[];
}

interface UseAcabadosParams {
  searchTerm?: string;
  categoriaId?: string | null;
  estacionId?: string | null;
  tipoImpacto?: TipoImpactoPrecio | null;
  disponibleIndependiente?: boolean | null;
  tieneNiveles?: boolean | null;
  isActive?: boolean | null;
  page?: number;
  itemsPerPage?: number;
}

export function useAcabados({
  searchTerm = '',
  categoriaId = null,
  estacionId = null,
  tipoImpacto = null,
  disponibleIndependiente = null,
  tieneNiveles = null,
  isActive = null,
  page = 1,
  itemsPerPage = 25,
}: UseAcabadosParams = {}) {
  const [acabados, setAcabados] = useState<AcabadoWithDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAcabados = async () => {
    try {
      setLoading(true);

      const selectStr = `
          *,
          acabados_categorias${categoriaId ? '!inner' : ''}(
            categoria_id,
            categoria:categorias(id, nombre, color)
          ),
          estacion:estaciones_trabajo(id, nombre),
          niveles_precio:acabados_niveles_precio(*),
          pasos:acabados_pasos(*)
        `;

      let query = supabase
        .from('acabados')
        .select(selectStr, { count: 'exact' })
        .order('nombre', { ascending: true });

      if (searchTerm) {
        query = query.ilike('nombre', `%${searchTerm}%`);
      }

      if (categoriaId) {
        query = query.eq('acabados_categorias.categoria_id', categoriaId);
      }

      if (estacionId) {
        query = query.eq('estacion_id', estacionId);
      }

      if (tipoImpacto) {
        query = query.eq('tipo_impacto', tipoImpacto);
      }

      if (disponibleIndependiente !== null) {
        query = query.eq('disponible_independiente', disponibleIndependiente);
      }

      if (tieneNiveles !== null) {
        query = query.eq('tiene_niveles_precio', tieneNiveles);
      }

      if (isActive !== null) {
        query = query.eq('is_active', isActive);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setAcabados(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching acabados:', error);
      setAcabados([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcabados();
  }, [searchTerm, categoriaId, estacionId, tipoImpacto, disponibleIndependiente, tieneNiveles, isActive, page, itemsPerPage]);

  return {
    acabados,
    totalCount,
    loading,
    refetch: fetchAcabados,
  };
}

interface AcabadoFormData {
  nombre: string;
  categorias_ids: string[];
  estacion_id: string;
  disponible_independiente: boolean;
  tiene_niveles_precio: boolean;
  tipo_impacto?: TipoImpactoPrecio | null;
  valor_impacto?: number | null;
  valor_impacto_secundario?: number | null;
  paso_id?: string | null;
  niveles?: {
    id?: string;
    nombre: string;
    tipo_impacto: TipoImpactoPrecio;
    valor_impacto: number;
    valor_impacto_secundario: number | null;
    paso_id: string | null;
    orden: number;
  }[];
}

export function useAcabado() {
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const createAcabado = async (data: AcabadoFormData) => {
    try {
      setLoading(true);

      if (!profile?.company_id) {
        throw new Error('No se encontró la empresa del usuario. Por favor, intenta cerrar sesión e iniciar sesión nuevamente.');
      }

      const acabadoData: any = {
        company_id: profile.company_id,
        nombre: data.nombre,
        estacion_id: data.estacion_id,
        disponible_independiente: data.disponible_independiente,
        tiene_niveles_precio: data.tiene_niveles_precio,
        is_active: true,
      };

      if (!data.tiene_niveles_precio) {
        acabadoData.tipo_impacto = data.tipo_impacto;
        acabadoData.valor_impacto = data.valor_impacto;
        acabadoData.valor_impacto_secundario = data.valor_impacto_secundario || null;
      }

      const { data: acabado, error: acabadoError } = await supabase
        .from('acabados')
        .insert(acabadoData)
        .select()
        .single();

      if (acabadoError) throw acabadoError;

      if (data.categorias_ids && data.categorias_ids.length > 0) {
        const categoriasData = data.categorias_ids.map((categoria_id) => ({
          acabado_id: acabado.id,
          categoria_id,
        }));

        const { error: categoriasError } = await supabase
          .from('acabados_categorias')
          .insert(categoriasData);

        if (categoriasError) {
          await supabase.from('acabados').delete().eq('id', acabado.id);
          throw categoriasError;
        }
      }

      if (data.tiene_niveles_precio && data.niveles && data.niveles.length > 0) {
        const nivelesData = data.niveles.map((nivel) => ({
          acabado_id: acabado.id,
          nombre: nivel.nombre,
          tipo_impacto: nivel.tipo_impacto,
          valor_impacto: nivel.valor_impacto,
          valor_impacto_secundario: nivel.valor_impacto_secundario || null,
          paso_id: nivel.paso_id || null,
          orden: nivel.orden,
        }));

        const { error: nivelesError } = await supabase
          .from('acabados_niveles_precio')
          .insert(nivelesData);

        if (nivelesError) {
          await supabase.from('acabados').delete().eq('id', acabado.id);
          throw nivelesError;
        }
      } else if (!data.tiene_niveles_precio && data.paso_id) {
        const { error: pasoError } = await supabase
          .from('acabados_pasos')
          .insert({
            acabado_id: acabado.id,
            paso_id: data.paso_id,
          });

        if (pasoError) {
          await supabase.from('acabados').delete().eq('id', acabado.id);
          throw pasoError;
        }
      }

      return acabado;
    } catch (error) {
      console.error('Error creating acabado:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateAcabado = async (id: string, data: AcabadoFormData) => {
    try {
      setLoading(true);

      const acabadoData: any = {
        nombre: data.nombre,
        estacion_id: data.estacion_id,
        disponible_independiente: data.disponible_independiente,
        tiene_niveles_precio: data.tiene_niveles_precio,
        updated_at: new Date().toISOString(),
      };

      if (!data.tiene_niveles_precio) {
        acabadoData.tipo_impacto = data.tipo_impacto;
        acabadoData.valor_impacto = data.valor_impacto;
        acabadoData.valor_impacto_secundario = data.valor_impacto_secundario || null;
      } else {
        acabadoData.tipo_impacto = null;
        acabadoData.valor_impacto = null;
        acabadoData.valor_impacto_secundario = null;
      }

      const { error: updateError } = await supabase
        .from('acabados')
        .update(acabadoData)
        .eq('id', id);

      if (updateError) throw updateError;

      await supabase.from('acabados_categorias').delete().eq('acabado_id', id);

      if (data.categorias_ids && data.categorias_ids.length > 0) {
        const categoriasData = data.categorias_ids.map((categoria_id) => ({
          acabado_id: id,
          categoria_id,
        }));

        const { error: categoriasError } = await supabase
          .from('acabados_categorias')
          .insert(categoriasData);

        if (categoriasError) throw categoriasError;
      }

      await supabase.from('acabados_pasos').delete().eq('acabado_id', id);

      if (data.tiene_niveles_precio && data.niveles && data.niveles.length > 0) {
        const { data: currentNiveles } = await supabase
          .from('acabados_niveles_precio')
          .select('id')
          .eq('acabado_id', id);

        const currentNivelesIds = (currentNiveles || []).map((n) => n.id);
        const formNivelesIds = data.niveles.filter((n: any) => n.id).map((n: any) => n.id);
        const nivelesIdsToDelete = currentNivelesIds.filter((id) => !formNivelesIds.includes(id));

        if (nivelesIdsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('acabados_niveles_precio')
            .delete()
            .in('id', nivelesIdsToDelete);

          if (deleteError) throw deleteError;
        }

        for (const nivel of data.niveles) {
          const nivelTyped = nivel as any;

          if (nivelTyped.id) {
            const { error: updateNivelError } = await supabase
              .from('acabados_niveles_precio')
              .update({
                nombre: nivelTyped.nombre,
                tipo_impacto: nivelTyped.tipo_impacto,
                valor_impacto: nivelTyped.valor_impacto,
                valor_impacto_secundario: nivelTyped.valor_impacto_secundario || null,
                paso_id: nivelTyped.paso_id || null,
                orden: nivelTyped.orden,
              })
              .eq('id', nivelTyped.id);

            if (updateNivelError) throw updateNivelError;
          } else {
            const { error: insertNivelError } = await supabase
              .from('acabados_niveles_precio')
              .insert({
                acabado_id: id,
                nombre: nivelTyped.nombre,
                tipo_impacto: nivelTyped.tipo_impacto,
                valor_impacto: nivelTyped.valor_impacto,
                valor_impacto_secundario: nivelTyped.valor_impacto_secundario || null,
                paso_id: nivelTyped.paso_id || null,
                orden: nivelTyped.orden,
              });

            if (insertNivelError) throw insertNivelError;
          }
        }
      } else {
        await supabase.from('acabados_niveles_precio').delete().eq('acabado_id', id);

        if (!data.tiene_niveles_precio && data.paso_id) {
          const { error: pasoError } = await supabase
            .from('acabados_pasos')
            .insert({
              acabado_id: id,
              paso_id: data.paso_id,
            });

          if (pasoError) throw pasoError;
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating acabado:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const toggleAcabadoStatus = async (id: string, currentStatus: boolean) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('acabados')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error toggling acabado status:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteAcabado = async (id: string) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('acabados')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting acabado:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    createAcabado,
    updateAcabado,
    toggleAcabadoStatus,
    deleteAcabado,
    loading,
  };
}
