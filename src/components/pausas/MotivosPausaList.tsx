import { useState } from 'react';
import { Edit2, Trash2, Plus, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { useMotivosPausa } from '../../hooks/useMotivosPausa';
import { MotivoPausaForm } from './MotivoPausaForm';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { supabase } from '../../lib/supabase';
import type { MotivoPausa } from '../../hooks/useMotivosPausa';

const categoriasConfig: Record<string, { label: string; emoji: string }> = {
  cliente: { label: 'Cliente', emoji: '👤' },
  materiales: { label: 'Materiales', emoji: '📦' },
  maquinaria: { label: 'Maquinaria', emoji: '⚙️' },
  personal: { label: 'Personal', emoji: '👥' },
  externo: { label: 'Externo', emoji: '🌐' },
  otro: { label: 'Otro', emoji: '⏸️' },
};

export function MotivosPausaList() {
  const { motivos, loading, recargar } = useMotivosPausa();
  const { showToast } = useToast();
  const { showConfirm } = useConfirmDialog();

  const [showForm, setShowForm] = useState(false);
  const [motivoEdit, setMotivoEdit] = useState<MotivoPausa | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const motivosFiltrados = showInactive
    ? motivos
    : motivos.filter((m) => m.is_active);

  const handleEdit = (motivo: MotivoPausa) => {
    setMotivoEdit(motivo);
    setShowForm(true);
  };

  const handleDelete = async (motivo: MotivoPausa) => {
    const confirmed = await showConfirm({
      title: 'Eliminar Motivo',
      message: `¿Estás seguro de que deseas eliminar el motivo "${motivo.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('pasos_motivos_pausa')
        .delete()
        .eq('id', motivo.id);

      if (error) throw error;

      showToast('Motivo eliminado correctamente', 'success');
      recargar();
    } catch (error) {
      console.error('Error eliminando motivo:', error);
      showToast(
        error instanceof Error ? error.message : 'Error eliminando motivo',
        'error'
      );
    }
  };

  const handleToggleActive = async (motivo: MotivoPausa) => {
    try {
      const { error } = await supabase
        .from('pasos_motivos_pausa')
        .update({ is_active: !motivo.is_active })
        .eq('id', motivo.id);

      if (error) throw error;

      showToast(
        `Motivo ${motivo.is_active ? 'desactivado' : 'activado'} correctamente`,
        'success'
      );
      recargar();
    } catch (error) {
      console.error('Error actualizando estado:', error);
      showToast(
        error instanceof Error ? error.message : 'Error actualizando estado',
        'error'
      );
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setMotivoEdit(null);
  };

  const handleSuccess = () => {
    recargar();
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-sm text-gray-500 mt-4">Cargando motivos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Motivos de Pausa
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona los motivos disponibles para pausar pasos de producción
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Ver Solo Activos
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Ver Todos
              </>
            )}
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Motivo
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium mb-1">Acerca de los motivos de pausa</p>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li>Los motivos activos aparecen en el diálogo de pausar paso</li>
            <li>Puedes desactivar motivos sin eliminarlos</li>
            <li>
              Los motivos con descripción obligatoria requieren justificación
            </li>
            <li>El orden determina cómo se muestran en el selector</li>
          </ul>
        </div>
      </div>

      {/* Tabla */}
      {motivosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            {showInactive
              ? 'No hay motivos registrados'
              : 'No hay motivos activos'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Motivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descripción Requerida
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orden
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {motivosFiltrados.map((motivo) => {
                const catConfig = categoriasConfig[motivo.categoria];
                return (
                  <tr
                    key={motivo.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      !motivo.is_active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: motivo.color }}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {motivo.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{catConfig?.emoji}</span>
                        <span className="text-sm text-gray-600">
                          {catConfig?.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {motivo.requiere_descripcion ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Sí
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {motivo.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm text-gray-600">{motivo.orden}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleActive(motivo)}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={motivo.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {motivo.is_active ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(motivo)}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(motivo)}
                          className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      <MotivoPausaForm
        isOpen={showForm}
        onClose={handleCloseForm}
        motivo={motivoEdit}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
