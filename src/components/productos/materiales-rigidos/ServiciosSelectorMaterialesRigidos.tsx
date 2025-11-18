import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Loader2, CheckSquare, Square } from 'lucide-react';
import { CATEGORIA_MATERIALES_RIGIDOS_ID } from '../../../constants/categorias';

interface Servicio {
  id: string;
  nombre: string;
  descripcion?: string;
  is_active: boolean;
}

interface ServiciosSelectorMaterialesRigidosProps {
  selectedServiciosIds: string[];
  onChange: (serviciosIds: string[]) => void;
}

export function ServiciosSelectorMaterialesRigidos({
  selectedServiciosIds,
  onChange,
}: ServiciosSelectorMaterialesRigidosProps) {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (profile?.company_id) {
      cargarServicios();
    } else if (user && !profile) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [profile?.company_id, user]);

  const cargarServicios = async () => {
    try {
      setIsLoading(true);

      const { data: relaciones, error: relError } = await supabase
        .from('servicios_categorias')
        .select('servicio_id')
        .eq('categoria_id', CATEGORIA_MATERIALES_RIGIDOS_ID);

      if (relError) {
        console.error('[ServiciosSelectorMaterialesRigidos] Error:', relError);
        setServicios([]);
        return;
      }

      if (!relaciones || relaciones.length === 0) {
        setServicios([]);
        return;
      }

      const servicioIds = relaciones.map((r) => r.servicio_id);

      const { data: serviciosData, error: servError } = await supabase
        .from('servicios')
        .select('id, nombre, descripcion, is_active')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .in('id', servicioIds)
        .order('nombre');

      if (servError) {
        console.error('[ServiciosSelectorMaterialesRigidos] Error:', servError);
        setServicios([]);
        return;
      }

      setServicios(serviciosData || []);
    } catch (error) {
      console.error('[ServiciosSelectorMaterialesRigidos] Error inesperado:', error);
      setServicios([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (servicioId: string) => {
    if (selectedServiciosIds.includes(servicioId)) {
      onChange(selectedServiciosIds.filter((id) => id !== servicioId));
    } else {
      onChange([...selectedServiciosIds, servicioId]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      </div>
    );
  }

  if (servicios.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2">
        No hay servicios disponibles
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Servicios Disponibles
      </label>
      <div className="space-y-2">
        {servicios.map((servicio) => {
          const isSelected = selectedServiciosIds.includes(servicio.id);
          return (
            <button
              key={servicio.id}
              type="button"
              onClick={() => handleToggle(servicio.id)}
              className={`
                w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all text-left
                ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center gap-3 flex-1">
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                    {servicio.nombre}
                  </p>
                  {servicio.descripcion && (
                    <p className="text-xs text-gray-500 mt-0.5">{servicio.descripcion}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selectedServiciosIds.length > 0 && (
        <p className="mt-2 text-sm text-gray-500">
          {selectedServiciosIds.length} servicio{selectedServiciosIds.length !== 1 ? 's' : ''} seleccionado{selectedServiciosIds.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
