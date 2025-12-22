import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Servicio, ServicioNivelPrecio, ServicioPaso, TipoImpactoPrecio } from '../types/database';

interface ServicioWithDetails extends Servicio {
  servicios_categorias?: {
    categoria_id: string;
    categoria?: {
      id: string;
      nombre: string;
      color: string;
    };
  }[];
  estacion?: { id: string; nombre: string };
  niveles_precio?: ServicioNivelPrecio[];
  pasos?: ServicioPaso[];
}

interface UseServiciosParams {
  searchTerm?: string;
  categoriaId?: string | null;
  categoriasIds?: string[]; // Nueva propiedad para filtro múltiple
  estacionId?: string | null;
  tipoImpacto?: TipoImpactoPrecio | null;
  disponibleIndependiente?: boolean | null;
  tieneNiveles?: boolean | null;
  isActive?: boolean | null;
  page?: number;
  itemsPerPage?: number;
}

export function useServicios({
  searchTerm = '',
  categoriaId = null,
  categoriasIds = [],
  estacionId = null,
  tipoImpacto = null,
  disponibleIndependiente = null,
  tieneNiveles = null,
  isActive = null,
  page = 1,
  itemsPerPage = 25,
}: UseServiciosParams = {}) {
  const [servicios, setServicios] = useState<ServicioWithDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchServicios = async () => {
    try {
      setLoading(true);

      // Decidir si usamos inner join para filtrar por categorías
      const filterByCategorias = categoriaId || (categoriasIds && categoriasIds.length > 0);

      let query = supabase
        .from('servicios')
        .select(
          `
          *,
          servicios_categorias${filterByCategorias ? '!inner' : ''}(
            categoria_id,
            categoria:categorias(id, nombre, color)
          ),
          estacion:estaciones_trabajo(id, nombre),
          niveles_precio:servicios_niveles_precio(
            *,
            paso:pasos(
              id,
              nombre,
              etapa,
              estacion:estaciones_trabajo(id, nombre)
            )
          ),
          pasos:servicios_pasos(
            *,
            paso:pasos(
              id,
              nombre,
              estacion:estaciones_trabajo(id, nombre)
            )
          )
        `,
          { count: 'exact' }
        )
        .order('nombre', { ascending: true });

      if (searchTerm) {
        query = query.ilike('nombre', `%${searchTerm}%`);
      }

      if (categoriaId) {
        query = query.eq('servicios_categorias.categoria_id', categoriaId);
      } else if (categoriasIds && categoriasIds.length > 0) {
        // Filtro "OR" para múltiples categorías (IN)
        query = query.in('servicios_categorias.categoria_id', categoriasIds);
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

      setServicios(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching servicios:', error);
      setServicios([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicios();
  }, [searchTerm, categoriaId, categoriasIds?.join(','), estacionId, tipoImpacto, disponibleIndependiente, tieneNiveles, isActive, page, itemsPerPage]);

  return {
    servicios,
    totalCount,
    loading,
    refetch: fetchServicios,
  };
}

interface ServicioFormData {
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

export function useServicio() {
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const createServicio = async (data: ServicioFormData) => {
    try {
      setLoading(true);

      if (!profile?.company_id) {
        throw new Error('No se encontró la empresa del usuario. Por favor, intenta cerrar sesión e iniciar sesión nuevamente.');
      }

      const servicioData: any = {
        company_id: profile.company_id,
        nombre: data.nombre,
        estacion_id: data.estacion_id,
        disponible_independiente: data.disponible_independiente,
        tiene_niveles_precio: data.tiene_niveles_precio,
        is_active: true,
      };

      if (!data.tiene_niveles_precio) {
        servicioData.tipo_impacto = data.tipo_impacto;
        servicioData.valor_impacto = data.valor_impacto;
        servicioData.valor_impacto_secundario = data.valor_impacto_secundario || null;
      }

      const { data: servicio, error: servicioError } = await supabase
        .from('servicios')
        .insert(servicioData)
        .select()
        .single();

      if (servicioError) throw servicioError;

      if (data.categorias_ids && data.categorias_ids.length > 0) {
        const categoriasData = data.categorias_ids.map((categoria_id) => ({
          servicio_id: servicio.id,
          categoria_id,
        }));

        const { error: categoriasError } = await supabase
          .from('servicios_categorias')
          .insert(categoriasData);

        if (categoriasError) {
          await supabase.from('servicios').delete().eq('id', servicio.id);
          throw categoriasError;
        }
      }

      if (data.tiene_niveles_precio && data.niveles && data.niveles.length > 0) {
        const nivelesData = data.niveles.map((nivel) => ({
          servicio_id: servicio.id,
          ...nivel,
        }));

        const { error: nivelesError } = await supabase
          .from('servicios_niveles_precio')
          .insert(nivelesData);

        if (nivelesError) {
          await supabase.from('servicios').delete().eq('id', servicio.id);
          throw nivelesError;
        }
      } else if (!data.tiene_niveles_precio && data.paso_id) {
        const { error: pasoError } = await supabase
          .from('servicios_pasos')
          .insert({
            servicio_id: servicio.id,
            paso_id: data.paso_id,
          });

        if (pasoError) {
          await supabase.from('servicios').delete().eq('id', servicio.id);
          throw pasoError;
        }
      }

      return servicio;
    } catch (error) {
      console.error('Error creating servicio:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateServicio = async (id: string, data: ServicioFormData) => {
    try {
      setLoading(true);

      const servicioData: any = {
        nombre: data.nombre,
        estacion_id: data.estacion_id,
        disponible_independiente: data.disponible_independiente,
        tiene_niveles_precio: data.tiene_niveles_precio,
        updated_at: new Date().toISOString(),
      };

      if (!data.tiene_niveles_precio) {
        servicioData.tipo_impacto = data.tipo_impacto;
        servicioData.valor_impacto = data.valor_impacto;
        servicioData.valor_impacto_secundario = data.valor_impacto_secundario || null;
      } else {
        servicioData.tipo_impacto = null;
        servicioData.valor_impacto = null;
        servicioData.valor_impacto_secundario = null;
      }

      const { error: updateError } = await supabase
        .from('servicios')
        .update(servicioData)
        .eq('id', id);

      if (updateError) throw updateError;

      await supabase.from('servicios_categorias').delete().eq('servicio_id', id);

      if (data.categorias_ids && data.categorias_ids.length > 0) {
        const categoriasData = data.categorias_ids.map((categoria_id) => ({
          servicio_id: id,
          categoria_id,
        }));

        const { error: categoriasError } = await supabase
          .from('servicios_categorias')
          .insert(categoriasData);

        if (categoriasError) throw categoriasError;
      }

      await supabase.from('servicios_pasos').delete().eq('servicio_id', id);

      if (data.tiene_niveles_precio && data.niveles && data.niveles.length > 0) {
        const { data: currentNiveles } = await supabase
          .from('servicios_niveles_precio')
          .select('id')
          .eq('servicio_id', id);

        const currentNivelesIds = (currentNiveles || []).map((n) => n.id);
        const formNivelesIds = data.niveles.filter((n: any) => n.id).map((n: any) => n.id);
        const nivelesIdsToDelete = currentNivelesIds.filter((id) => !formNivelesIds.includes(id));

        if (nivelesIdsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('servicios_niveles_precio')
            .delete()
            .in('id', nivelesIdsToDelete);

          if (deleteError) throw deleteError;
        }

        for (const nivel of data.niveles) {
          const nivelTyped = nivel as any;

          if (nivelTyped.id) {
            const { error: updateNivelError } = await supabase
              .from('servicios_niveles_precio')
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
              .from('servicios_niveles_precio')
              .insert({
                servicio_id: id,
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
        await supabase.from('servicios_niveles_precio').delete().eq('servicio_id', id);

        if (!data.tiene_niveles_precio && data.paso_id) {
          const { error: pasoError } = await supabase
            .from('servicios_pasos')
            .insert({
              servicio_id: id,
              paso_id: data.paso_id,
            });

          if (pasoError) throw pasoError;
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating servicio:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const toggleServicioStatus = async (id: string, currentStatus: boolean) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('servicios')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error toggling servicio status:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteServicio = async (id: string) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('servicios')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting servicio:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    createServicio,
    updateServicio,
    toggleServicioStatus,
    deleteServicio,
    loading,
  };
}
