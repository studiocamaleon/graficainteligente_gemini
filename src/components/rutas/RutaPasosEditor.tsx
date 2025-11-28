import { useState } from 'react';
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown, Settings, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useRutaPasos } from '../../hooks/useRutaPasos';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { RutaPasoModal } from './RutaPasoModal';
import type { RutaProduccionPaso, EtapaPaso } from '../../types/database';

interface RutaPasosEditorProps {
  rutaId: string;
  rutaNombre: string;
  onClose: () => void;
}

const ETAPAS: EtapaPaso[] = ['Pre-prensa', 'Produccion', 'Terminacion', 'Instalacion'];

const ETAPA_COLORS: Record<EtapaPaso, { bg: string; text: string; border: string }> = {
  'Pre-prensa': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  'Produccion': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  'Terminacion': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  'Instalacion': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
};

export function RutaPasosEditor({ rutaId, rutaNombre, onClose }: RutaPasosEditorProps) {
  const { pasos, loading, error, addPaso, updatePaso, deletePaso, reorderPasos, refetch } = useRutaPasos({
    rutaId,
    etapa: null,
  });

  const [selectedEtapa, setSelectedEtapa] = useState<EtapaPaso>('Pre-prensa');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPaso, setEditingPaso] = useState<RutaProduccionPaso | null>(null);

  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmDelete,
  } = useConfirmDialog();

  const pasosPorEtapa = pasos.filter((p) => p.etapa === selectedEtapa);

  const getConteoEtapa = (etapa: EtapaPaso) => {
    return pasos.filter((p) => p.etapa === etapa).length;
  };

  const handleMovePaso = async (paso: RutaProduccionPaso, direction: 'up' | 'down') => {
    const pasosEtapa = pasos.filter((p) => p.etapa === paso.etapa).sort((a, b) => a.orden - b.orden);
    const currentIndex = pasosEtapa.findIndex((p) => p.id === paso.id);

    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === pasosEtapa.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const reorderedPasos = [...pasosEtapa];
    [reorderedPasos[currentIndex], reorderedPasos[newIndex]] = [
      reorderedPasos[newIndex],
      reorderedPasos[currentIndex],
    ];

    await reorderPasos(paso.etapa as EtapaPaso, reorderedPasos);
  };

  const handleDeletePaso = (paso: RutaProduccionPaso) => {
    confirmDelete({
      itemName: paso.paso?.nombre || paso.servicio?.nombre || paso.acabado?.nombre || paso.tecnologia?.nombre || 'desconocido',
      warningMessage: 'Esta acción eliminará el paso de la ruta de producción.',
      onConfirm: async () => {
        await deletePaso(paso.id);
      },
    });
  };

  const getNombrePaso = (paso: RutaProduccionPaso): string => {
    if (paso.paso?.nombre) {
      return paso.paso.nombre;
    }

    if (paso.servicio?.nombre) {
      return paso.servicio.nombre;
    }

    if (paso.acabado?.nombre) {
      return paso.acabado.nombre;
    }

    if (paso.tecnologia?.nombre) {
      return paso.tecnologia.nombre;
    }

    // Nombre descriptivo basado en el tipo de condición
    switch (paso.tipo_condicion) {
      case 'servicio_con_nivel':
        return 'Servicio con niveles';
      case 'servicio_sin_nivel':
        return 'Servicio';
      case 'acabado_con_nivel':
        return 'Acabado con niveles';
      case 'acabado_sin_nivel':
        return 'Acabado';
      case 'tecnologia_tinta':
        return 'Tecnología + Tinta';
      default:
        return 'Paso condicional';
    }
  };

  const getTipoCondicionLabel = (tipoCondicion: string | null): string => {
    if (!tipoCondicion || tipoCondicion === 'sin_condicion') return '';

    const labels: Record<string, string> = {
      'servicio_sin_nivel': 'Servicio',
      'servicio_con_nivel': 'Servicio con niveles',
      'acabado_sin_nivel': 'Acabado',
      'acabado_con_nivel': 'Acabado con niveles',
      'tecnologia_tinta': 'Tecnología + Tinta',
    };

    return labels[tipoCondicion] || '';
  };

  const getTotalPasos = () => pasos.length;

  const getEtapasIncompletas = () => {
    return ETAPAS.filter((etapa) => getConteoEtapa(etapa) === 0);
  };

  const isRutaCompleta = getEtapasIncompletas().length === 0;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{rutaNombre}</h2>
            <p className="text-sm text-gray-600 mb-4">
              Configura los pasos de producción organizados por las 5 etapas fundamentales
            </p>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="info">{getTotalPasos()} pasos totales</Badge>
                {isRutaCompleta ? (
                  <Badge variant="success">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Ruta completa
                  </Badge>
                ) : (
                  <Badge variant="warning">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {getEtapasIncompletas().length} etapas sin pasos
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {ETAPAS.map((etapa) => {
          const conteo = getConteoEtapa(etapa);
          const colors = ETAPA_COLORS[etapa];
          const isSelected = selectedEtapa === etapa;

          return (
            <button
              key={etapa}
              onClick={() => setSelectedEtapa(etapa)}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${isSelected ? `${colors.bg} ${colors.border} shadow-md` : 'bg-white border-gray-200 hover:border-gray-300'}
              `}
            >
              <div className={`text-sm font-medium ${isSelected ? colors.text : 'text-gray-600'}`}>
                {etapa}
              </div>
              <div className={`text-2xl font-bold mt-1 ${isSelected ? colors.text : 'text-gray-900'}`}>
                {conteo}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {conteo === 0 ? 'sin pasos' : conteo === 1 ? 'paso' : 'pasos'}
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${ETAPA_COLORS[selectedEtapa].bg}`}></span>
                Pasos de {selectedEtapa}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {pasosPorEtapa.length === 0
                  ? 'No hay pasos configurados para esta etapa'
                  : `${pasosPorEtapa.length} paso${pasosPorEtapa.length !== 1 ? 's' : ''} configurado${pasosPorEtapa.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setIsAddModalOpen(true)}
              disabled={loading}
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Paso
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Cargando pasos...</p>
              <p className="text-xs text-gray-400 mt-2">Ruta ID: {rutaId.slice(0, 8)}...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 bg-red-50 rounded-lg border-2 border-red-300">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-700 font-medium mb-1">Error al cargar pasos</p>
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <Button variant="primary" onClick={() => refetch()}>
                Reintentar
              </Button>
            </div>
          ) : pasosPorEtapa.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium mb-1">No hay pasos en esta etapa</p>
              <p className="text-sm text-gray-500 mb-4">
                Agrega el primer paso para comenzar a configurar esta etapa
              </p>
              <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Primer Paso
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {pasosPorEtapa.map((paso, index) => (
                <div
                  key={paso.id}
                  className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMovePaso(paso, 'up')}
                        disabled={index === 0}
                        title="Mover arriba"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMovePaso(paso, 'down')}
                        disabled={index === pasosPorEtapa.length - 1}
                        title="Mover abajo"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-500 mt-0.5">#{paso.orden + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">
                              {getNombrePaso(paso)}
                            </h4>
                            {paso.es_obligatorio ? (
                              <Badge variant="success">Obligatorio</Badge>
                            ) : (
                              <Badge variant="warning">Condicional</Badge>
                            )}
                          </div>
                          {!paso.es_obligatorio && paso.tipo_condicion && paso.tipo_condicion !== 'sin_condicion' && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {getTipoCondicionLabel(paso.tipo_condicion)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingPaso(paso)}
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePaso(paso)}
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {isAddModalOpen && (
        <RutaPasoModal
          rutaId={rutaId}
          etapa={selectedEtapa}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            refetch();
          }}
        />
      )}

      {editingPaso && (
        <RutaPasoModal
          rutaId={rutaId}
          etapa={selectedEtapa}
          paso={editingPaso}
          onClose={() => setEditingPaso(null)}
          onSuccess={() => {
            setEditingPaso(null);
            refetch();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        variant={dialogState.variant}
        isLoading={isConfirmLoading}
      />
    </div>
  );
}
