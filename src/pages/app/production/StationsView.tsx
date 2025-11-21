import { useState } from 'react';
import { useProductionStations, type StationStep } from '../../../hooks/useProductionStations';
import { StationCard } from '../../../components/production/StationCard';
import { StationStepCard } from '../../../components/production/StationStepCard';
import { StationSelector } from '../../../components/production/StationSelector';
import { JobExecutionModal } from '../../../components/production/JobExecutionModal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/Button';
import { RefreshCw, Radio, Boxes, CheckCircle2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { EstadoOrdenItem } from '../../../types/database';

export function StationsView() {
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const { stations, loading, error, refreshStations, isUpdating } = useProductionStations({
    estacionId: selectedStationId,
  });

  const [selectedStep, setSelectedStep] = useState<StationStep | null>(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);

  const navigate = useNavigate();

  const handleStationClick = (estacionId: string) => {
    setSelectedStationId(estacionId);
  };

  const handleViewAllStations = () => {
    setSelectedStationId(null);
  };

  const handleViewStepDetails = (step: StationStep) => {
    setSelectedStep(step);
    setShowExecutionModal(true);
  };

  const handleCloseModal = () => {
    setShowExecutionModal(false);
    setSelectedStep(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Cargando estaciones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error al cargar estaciones</h3>
        <p className="text-red-600">{error}</p>
        <Button onClick={refreshStations} variant="outline" className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  if (stations.length === 0 && !selectedStationId) {
    return (
      <EmptyState
        icon={Boxes}
        title="No hay estaciones configuradas"
        description="Configura tus estaciones de trabajo en el módulo ABM Core"
      >
        <Button onClick={() => navigate('/app/abm-core/estaciones')}>Ir a Estaciones</Button>
      </EmptyState>
    );
  }

  const totalActivePasos = stations.reduce((sum, station) => sum + station.total_pasos_activos, 0);
  const selectedStation = selectedStationId
    ? stations.find((s) => s.estacion_id === selectedStationId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <StationSelector
            stations={stations.map((s) => ({
              estacion_id: s.estacion_id,
              estacion_nombre: s.estacion_nombre,
              total_activos: s.total_pasos_activos,
            }))}
            selectedStationId={selectedStationId}
            onChange={setSelectedStationId}
          />
          <div className="text-sm text-gray-600">
            <span className="font-semibold">{totalActivePasos}</span>{' '}
            {totalActivePasos === 1 ? 'paso activo' : 'pasos activos'}
          </div>
          {isUpdating && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Sincronizando...</span>
            </div>
          )}
        </div>
        <Button onClick={refreshStations} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {!selectedStationId ? (
        <>
          {stations.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Sin actividad en producción"
              description="No hay pasos activos en ninguna estación en este momento"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stations.map((station) => (
                <StationCard
                  key={station.estacion_id}
                  estacion_id={station.estacion_id}
                  estacion_nombre={station.estacion_nombre}
                  estacion_descripcion={station.estacion_descripcion}
                  pasos_en_proceso={station.pasos_en_proceso}
                  pasos_pendientes={station.pasos_pendientes}
                  total_activos={station.total_pasos_activos}
                  onClick={() => handleStationClick(station.estacion_id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {selectedStation ? (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {selectedStation.estacion_nombre}
                    </h2>
                    {selectedStation.estacion_descripcion && (
                      <p className="text-gray-600">{selectedStation.estacion_descripcion}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600">
                      {selectedStation.total_pasos_activos}
                    </div>
                    <div className="text-sm text-gray-600">
                      {selectedStation.total_pasos_activos === 1 ? 'paso activo' : 'pasos activos'}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={handleViewAllStations}>
                    ← Ver todas las estaciones
                  </Button>
                </div>
              </div>

              {selectedStation.pasos.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Sin pasos activos"
                  description="Esta estación no tiene pasos pendientes o en proceso"
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></span>
                        En Proceso
                      </h3>
                      <span className="text-sm text-gray-500">
                        {selectedStation.pasos_en_proceso}{' '}
                        {selectedStation.pasos_en_proceso === 1 ? 'paso' : 'pasos'}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {selectedStation.pasos
                        .filter((paso) => paso.estado_paso === 'en_proceso')
                        .map((paso) => (
                          <StationStepCard
                            key={paso.ruta_id}
                            {...paso}
                            onViewDetails={() => handleViewStepDetails(paso)}
                          />
                        ))}
                      {selectedStation.pasos_en_proceso === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          No hay pasos en proceso
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                        Pendientes
                      </h3>
                      <span className="text-sm text-gray-500">
                        {selectedStation.pasos_pendientes}{' '}
                        {selectedStation.pasos_pendientes === 1 ? 'paso' : 'pasos'}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {selectedStation.pasos
                        .filter((paso) => paso.estado_paso === 'pendiente')
                        .map((paso) => (
                          <StationStepCard
                            key={paso.ruta_id}
                            {...paso}
                            onViewDetails={() => handleViewStepDetails(paso)}
                          />
                        ))}
                      {selectedStation.pasos_pendientes === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          No hay pasos pendientes
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Boxes}
              title="Estación no encontrada"
              description="La estación seleccionada no existe o no está activa"
            >
              <Button onClick={handleViewAllStations}>Ver todas las estaciones</Button>
            </EmptyState>
          )}
        </>
      )}

      {selectedStep && (
        <JobExecutionModal
          isOpen={showExecutionModal}
          onClose={handleCloseModal}
          job={{
            id: selectedStep.orden_item_id,
            orden_id: selectedStep.orden_id,
            numero_orden: selectedStep.numero_orden,
            cliente_nombre: selectedStep.cliente_nombre,
            producto_nombre: selectedStep.producto_nombre,
            cantidad: selectedStep.cantidad,
            fecha_creacion: selectedStep.fecha_creacion_orden,
            estado: 'en_proceso' as EstadoOrdenItem,
            producto_categoria: null,
            total_pasos: 0,
            pasos_completados: 0,
            pasos_en_proceso: 0,
            pasos_pendientes: 0,
            progreso_porcentaje: 0,
            paso_relevante: null,
          }}
          onJobUpdated={refreshStations}
        />
      )}
    </div>
  );
}
