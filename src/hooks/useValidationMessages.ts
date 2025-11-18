import { supabase } from '../lib/supabase';

interface DependencyDetails {
  has_dependencies: boolean;
  dependency_count: number;
  dependency_details: Record<string, any>;
}

export function useValidationMessages() {
  const checkCategoriaDependencies = async (categoriaId: string): Promise<DependencyDetails | null> => {
    try {
      const { data, error } = await supabase.rpc('check_categoria_has_dependencies', {
        categoria_id_param: categoriaId,
      });

      if (error) throw error;

      return data?.[0] || null;
    } catch (error) {
      console.error('Error checking categoria dependencies:', error);
      return null;
    }
  };

  const checkEstacionDependencies = async (estacionId: string): Promise<DependencyDetails | null> => {
    try {
      const { data, error } = await supabase.rpc('check_estacion_has_dependencies', {
        estacion_id_param: estacionId,
      });

      if (error) throw error;

      return data?.[0] || null;
    } catch (error) {
      console.error('Error checking estacion dependencies:', error);
      return null;
    }
  };

  const checkPasoDependencies = async (pasoId: string): Promise<DependencyDetails | null> => {
    try {
      const { data, error } = await supabase.rpc('check_paso_has_dependencies', {
        paso_id_param: pasoId,
      });

      if (error) throw error;

      return data?.[0] || null;
    } catch (error) {
      console.error('Error checking paso dependencies:', error);
      return null;
    }
  };


  const getCategoriaDeactivationMessage = (
    nombre: string,
    details: DependencyDetails | null
  ): string => {
    if (!details || !details.has_dependencies) {
      return `¿Está seguro que desea desactivar la categoría "${nombre}"?`;
    }

    const { servicios = 0, acabados = 0 } = details.dependency_details;

    let message = `No se puede desactivar la categoría "${nombre}" porque tiene:\n\n`;

    if (servicios > 0) {
      message += `• ${servicios} servicio${servicios !== 1 ? 's' : ''} activo${servicios !== 1 ? 's' : ''}\n`;
    }

    if (acabados > 0) {
      message += `• ${acabados} acabado${acabados !== 1 ? 's' : ''} activo${acabados !== 1 ? 's' : ''}\n`;
    }

    message += '\nDesactive primero todos los servicios y acabados asociados a esta categoría.';

    return message;
  };

  const getEstacionDeactivationMessage = (
    nombre: string,
    details: DependencyDetails | null
  ): string => {
    if (!details || !details.has_dependencies) {
      return `¿Está seguro que desea desactivar la estación de trabajo "${nombre}"?`;
    }

    const { pasos_activos = 0 } = details.dependency_details;

    let message = `No se puede desactivar la estación "${nombre}" porque tiene:\n\n`;
    message += `• ${pasos_activos} paso${pasos_activos !== 1 ? 's' : ''} de producción activo${pasos_activos !== 1 ? 's' : ''}\n\n`;
    message += 'Desactive primero todos los pasos que utilicen esta estación.';

    return message;
  };

  const getPasoDeactivationMessage = (
    nombre: string,
    details: DependencyDetails | null
  ): string => {
    if (!details || !details.has_dependencies) {
      return `¿Está seguro que desea desactivar el paso "${nombre}"?`;
    }

    const {
      grupos_pasos = 0,
      servicios_niveles = 0,
      servicios_directos = 0,
      acabados_niveles = 0,
      acabados_directos = 0,
    } = details.dependency_details;

    let message = `No se puede desactivar el paso "${nombre}" porque está siendo usado en:\n\n`;

    if (grupos_pasos > 0) {
      message += `• ${grupos_pasos} grupo${grupos_pasos !== 1 ? 's' : ''} de pasos\n`;
    }

    const totalServicios = servicios_niveles + servicios_directos;
    if (totalServicios > 0) {
      message += `• ${totalServicios} servicio${totalServicios !== 1 ? 's' : ''}\n`;
    }

    const totalAcabados = acabados_niveles + acabados_directos;
    if (totalAcabados > 0) {
      message += `• ${totalAcabados} acabado${totalAcabados !== 1 ? 's' : ''}\n`;
    }

    message += '\nElimine primero todas las referencias a este paso.';

    return message;
  };

  return {
    checkCategoriaDependencies,
    checkEstacionDependencies,
    checkPasoDependencies,
    getCategoriaDeactivationMessage,
    getEstacionDeactivationMessage,
    getPasoDeactivationMessage,
  };
}
