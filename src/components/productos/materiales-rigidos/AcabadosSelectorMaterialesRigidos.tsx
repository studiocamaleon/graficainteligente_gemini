import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Loader2, CheckSquare, Square } from 'lucide-react';
import { CATEGORIA_MATERIALES_RIGIDOS_ID } from '../../../constants/categorias';

interface Acabado {
  id: string;
  nombre: string;
  is_active: boolean;
}

interface AcabadosSelectorMaterialesRigidosProps {
  selectedAcabadosIds: string[];
  onChange: (acabadosIds: string[]) => void;
}

export function AcabadosSelectorMaterialesRigidos({
  selectedAcabadosIds,
  onChange,
}: AcabadosSelectorMaterialesRigidosProps) {
  const [acabados, setAcabados] = useState<Acabado[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (profile?.company_id) {
      cargarAcabados();
    } else if (user && !profile) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [profile?.company_id, user]);

  const cargarAcabados = async () => {
    try {
      setIsLoading(true);

      const { data: relaciones, error: relError } = await supabase
        .from('acabados_categorias')
        .select('acabado_id')
        .eq('categoria_id', CATEGORIA_MATERIALES_RIGIDOS_ID);

      if (relError) {
        console.error('[AcabadosSelectorMaterialesRigidos] Error:', relError);
        setAcabados([]);
        return;
      }

      if (!relaciones || relaciones.length === 0) {
        setAcabados([]);
        return;
      }

      const acabadoIds = relaciones.map((r) => r.acabado_id);

      const { data: acabadosData, error: acabError } = await supabase
        .from('acabados')
        .select('id, nombre, is_active')
        .eq('company_id', profile?.company_id)
        .eq('is_active', true)
        .in('id', acabadoIds)
        .order('nombre');

      if (acabError) {
        console.error('[AcabadosSelectorMaterialesRigidos] Error:', acabError);
        setAcabados([]);
        return;
      }

      setAcabados(acabadosData || []);
    } catch (error) {
      console.error('[AcabadosSelectorMaterialesRigidos] Error inesperado:', error);
      setAcabados([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (acabadoId: string) => {
    if (selectedAcabadosIds.includes(acabadoId)) {
      onChange(selectedAcabadosIds.filter((id) => id !== acabadoId));
    } else {
      onChange([...selectedAcabadosIds, acabadoId]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      </div>
    );
  }

  if (acabados.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2">
        No hay acabados disponibles
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Acabados Disponibles
      </label>
      <div className="space-y-2">
        {acabados.map((acabado) => {
          const isSelected = selectedAcabadosIds.includes(acabado.id);
          return (
            <button
              key={acabado.id}
              type="button"
              onClick={() => handleToggle(acabado.id)}
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
                    {acabado.nombre}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selectedAcabadosIds.length > 0 && (
        <p className="mt-2 text-sm text-gray-500">
          {selectedAcabadosIds.length} acabado{selectedAcabadosIds.length !== 1 ? 's' : ''} seleccionado{selectedAcabadosIds.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
