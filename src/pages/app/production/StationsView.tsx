import { useCallback, useMemo, useState } from 'react';
import { useProductionStations, type StationStep } from '../../../hooks/useProductionStations';
import { StationCard } from '../../../components/production/StationCard';
import { StationStepCard } from '../../../components/production/StationStepCard';
import { StationStepGroup } from '../../../components/production/StationStepGroup';
import { StationSelector } from '../../../components/production/StationSelector';
import { JobExecutionModal } from '../../../components/production/JobExecutionModal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/Button';
import { RefreshCw, Radio, Boxes, CheckCircle2, Clock, ArrowUpDown, CalendarClock, CheckSquare, Square, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { EstadoOrdenItem } from '../../../types/database';
import { useStepExecution } from '../../../hooks/useStepExecution';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../lib/supabase';

type StepStatusFilter = 'all' | 'mesa' | 'pendiente';

export function StationsView() {
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [deliverySort, setDeliverySort] = useState<'none' | 'asc' | 'desc'>('asc');
  const { stations, loading, error, refreshStations, isUpdating, setMesaOwnerForRuta } = useProductionStations({
    estacionId: selectedStationId,
  });

  const [selectedStep, setSelectedStep] = useState<StationStep | null>(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [selectedRutaIds, setSelectedRutaIds] = useState<string[]>([]);
  const [isBulkCompleting, setIsBulkCompleting] = useState(false);
  const [isMovingStep, setIsMovingStep] = useState(false);
  const [draggedRutaId, setDraggedRutaId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<'mesa' | 'pendientes' | null>(null);
  const [statusFilter, setStatusFilter] = useState<StepStatusFilter>('all');
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const { completeStep } = useStepExecution();
  const { profile } = useAuth();

  const navigate = useNavigate();

  const handleStationChange = (estacionId: string | null) => {
    setSelectedStationId(estacionId);
    setSelectedRutaIds([]);
    setStatusFilter('all');
    setOnlyUrgent(false);
  };

  const handleStationClick = (estacionId: string) => {
    handleStationChange(estacionId);
  };

  const handleViewAllStations = () => {
    handleStationChange(null);
  };

  const handleViewStepDetails = (step: StationStep) => {
    setSelectedStep(step);
    setShowExecutionModal(true);
  };

  const handleCloseModal = () => {
    setShowExecutionModal(false);
    setSelectedStep(null);
  };

  const toggleStepSelection = (step: StationStep) => {
    setSelectedRutaIds((prev) => {
      if (prev.includes(step.ruta_id)) {
        return prev.filter((id) => id !== step.ruta_id);
      }
      return [...prev, step.ruta_id];
    });
  };

  const toggleGroupSelection = (steps: StationStep[]) => {
    const stepIds = steps.map((step) => step.ruta_id);
    setSelectedRutaIds((prev) => {
      const allSelected = stepIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !stepIds.includes(id));
      }
      const next = new Set(prev);
      stepIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const clearSelection = () => setSelectedRutaIds([]);

  const handleToggleDeliverySort = () => {
    setDeliverySort((prev) => {
      if (prev === 'none') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'none';
    });
  };

  const parseDeliveryDate = (value: string | null | undefined) => {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
  };

  const getDeliveryStatus = useCallback((step: StationStep): 'overdue' | 'today' | 'tomorrow' | null => {
    const time = parseDeliveryDate(step.fecha_estimada_entrega);
    if (time === null) return null;

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const endTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999).getTime();

    if (time < startToday) return 'overdue';
    if (time <= endToday) return 'today';
    if (time <= endTomorrow) return 'tomorrow';
    return null;
  }, []);

  const isUrgentStep = useCallback((step: StationStep) => getDeliveryStatus(step) !== null, [getDeliveryStatus]);

  const isInMyMesa = useCallback((step: StationStep) => {
    return !!profile?.id && step.mesa_owner_user_id === profile.id;
  }, [profile?.id]);

  const getMesaBadge = useCallback((step: StationStep): { text: string; variant: 'mine' | 'other' } | null => {
    if (!step.mesa_owner_user_id) return null;
    if (profile?.id && step.mesa_owner_user_id === profile.id) {
      return { text: 'En tu mesa', variant: 'mine' };
    }
    return {
      text: `En mesa de trabajo: ${step.mesa_owner_name || 'Usuario desconocido'}`,
      variant: 'other',
    };
  }, [profile?.id]);

  const sortStepsByDelivery = (steps: StationStep[]) => {
    if (deliverySort === 'none') return steps;
    return [...steps].sort((a, b) => {
      const dateA = parseDeliveryDate(a.fecha_estimada_entrega);
      const dateB = parseDeliveryDate(b.fecha_estimada_entrega);

      if (dateA === null && dateB === null) return 0;
      if (dateA === null) return 1;
      if (dateB === null) return -1;
      return deliverySort === 'asc' ? dateA - dateB : dateB - dateA;
    });
  };

  const renderGroupedSteps = (steps: StationStep[]) => {
    const groups = new Map<string, StationStep[]>();

    steps.forEach((step) => {
      // Agrupar por Global ID si existe, sino por Orden + Paso
      // Esto agrupa visualmente items idénticos de la misma orden
      const key = step.global_task_id || `${step.orden_id}-${step.paso_id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(step);
    });

    return Array.from(groups.entries()).map(([key, groupSteps]) => {
      const deliveryStatusByRuta = Object.fromEntries(
        groupSteps.map((step) => [step.ruta_id, getDeliveryStatus(step)])
      ) as Record<string, 'overdue' | 'today' | 'tomorrow' | null>;
      const mesaBadgeByRuta = Object.fromEntries(
        groupSteps.map((step) => [step.ruta_id, getMesaBadge(step)])
      ) as Record<string, { text: string; variant: 'mine' | 'other' } | null>;
      if (groupSteps.length > 1) {
        return (
          <StationStepGroup
            key={`group-${key}`}
            steps={groupSteps}
            onViewDetails={handleViewStepDetails}
            selectedRutaIds={selectedRutaIds}
            deliveryStatusByRuta={deliveryStatusByRuta}
            mesaBadgeByRuta={mesaBadgeByRuta}
            onToggleStepSelect={toggleStepSelection}
            onToggleGroupSelect={toggleGroupSelection}
            onStepDragStart={(step, event) => {
              setDraggedRutaId(step.ruta_id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', step.ruta_id);
            }}
            onStepDragEnd={() => {
              setDraggedRutaId(null);
              setDropTarget(null);
            }}
          />
        );
      } else {
        return (
          <StationStepCard
            key={groupSteps[0].ruta_id}
            {...groupSteps[0]}
            onViewDetails={() => handleViewStepDetails(groupSteps[0])}
            selected={selectedRutaIds.includes(groupSteps[0].ruta_id)}
            deliveryStatus={getDeliveryStatus(groupSteps[0])}
            mesaBadgeText={getMesaBadge(groupSteps[0])?.text || null}
            mesaBadgeVariant={getMesaBadge(groupSteps[0])?.variant || 'other'}
            draggable
            onDragStart={(event) => {
              setDraggedRutaId(groupSteps[0].ruta_id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', groupSteps[0].ruta_id);
            }}
            onDragEnd={() => {
              setDraggedRutaId(null);
              setDropTarget(null);
            }}
            onToggleSelect={() => toggleStepSelection(groupSteps[0])}
          />
        );
      }
    });
  };

  const selectedStationSteps = useMemo(() => {
    if (!selectedStationId) return [];
    const currentStation = stations.find((s) => s.estacion_id === selectedStationId);
    return currentStation?.pasos ?? [];
  }, [selectedStationId, stations]);

  const filteredStationSteps = useMemo(() => {
    if (!selectedStationId) return [];
    return selectedStationSteps.filter((step) => {
      const statusOk =
        statusFilter === 'all'
          ? true
          : statusFilter === 'mesa'
          ? isInMyMesa(step)
          : step.estado_paso === 'pendiente';
      const urgentOk = onlyUrgent ? isUrgentStep(step) : true;
      return statusOk && urgentOk;
    });
  }, [selectedStationId, selectedStationSteps, statusFilter, onlyUrgent, isUrgentStep, isInMyMesa]);

  const selectedSteps = useMemo(
    () => selectedStationSteps.filter((step) => selectedRutaIds.includes(step.ruta_id)),
    [selectedStationSteps, selectedRutaIds]
  );

  const metrics = useMemo(() => {
    const base = selectedStationSteps;
    return {
      total: base.length,
      mesaTrabajo: base.filter((step) => isInMyMesa(step)).length,
      pendientes: base.filter((step) => step.estado_paso === 'pendiente').length,
      urgentes: base.filter((step) => isUrgentStep(step)).length,
      mostrando: filteredStationSteps.length,
    };
  }, [selectedStationSteps, filteredStationSteps, isUrgentStep, isInMyMesa]);

  const takeStepToMyMesa = useCallback(async (step: StationStep) => {
    if (!profile?.company_id || !profile?.id || !selectedStationId) {
      return { success: false as const, status: 'invalid' as const };
    }

    const { data, error } = await supabase.rpc('fn_take_step_to_user_mesa', {
      p_company_id: profile.company_id,
      p_ruta_id: step.ruta_id,
      p_estacion_id: selectedStationId,
      p_user_id: profile.id,
    });

    if (error) {
      return { success: false as const, status: 'error' as const };
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return {
      success: true as const,
      status: (row?.status || 'error') as 'taken' | 'taken_by_other' | 'already_mine' | 'error',
      ownerUserId: row?.owner_user_id || null,
      ownerName: row?.owner_name || null,
    };
  }, [profile?.company_id, profile?.id, selectedStationId]);

  const releaseStepFromMyMesa = useCallback(async (step: StationStep) => {
    if (!profile?.company_id || !profile?.id) {
      return { success: false as const, status: 'invalid' as const };
    }

    const { data, error } = await supabase.rpc('fn_release_step_from_user_mesa', {
      p_company_id: profile.company_id,
      p_ruta_id: step.ruta_id,
      p_user_id: profile.id,
      p_force: false,
    });

    if (error) {
      return { success: false as const, status: 'error' as const };
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return {
      success: true as const,
      status: (row?.status || 'error') as 'released' | 'not_owner' | 'error',
    };
  }, [profile?.company_id, profile?.id]);

  const findStepByRutaId = useCallback((rutaId: string) => {
    return selectedStationSteps.find((step) => step.ruta_id === rutaId) || null;
  }, [selectedStationSteps]);

  const handleDropToMesa = async () => {
    if (!draggedRutaId) return;
    const step = findStepByRutaId(draggedRutaId);
    if (!step) return;
    if (isInMyMesa(step)) {
      setDraggedRutaId(null);
      setDropTarget(null);
      return;
    }

    setIsMovingStep(true);
    setMesaOwnerForRuta(step.ruta_id, profile?.id || null, profile?.full_name || 'Usuario desconocido');
    const result = await takeStepToMyMesa(step);
    if (!result.success || result.status === 'error') {
      setMesaOwnerForRuta(step.ruta_id, step.mesa_owner_user_id, step.mesa_owner_name);
      alert('No se pudo mover la tarea a la mesa de trabajo.');
    } else if (result.status === 'taken_by_other') {
      setMesaOwnerForRuta(step.ruta_id, result.ownerUserId, result.ownerName || 'Usuario desconocido');
      alert(`La tarea ya está en mesa de trabajo: ${result.ownerName || 'Usuario desconocido'}.`);
    } else {
      setMesaOwnerForRuta(step.ruta_id, profile?.id || null, profile?.full_name || 'Usuario desconocido');
    }
    setIsMovingStep(false);
    setDraggedRutaId(null);
    setDropTarget(null);
  };

  const handleDropToPendientes = async () => {
    if (!draggedRutaId) return;
    const step = findStepByRutaId(draggedRutaId);
    if (!step) return;
    if (!step.mesa_owner_user_id) {
      setDraggedRutaId(null);
      setDropTarget(null);
      return;
    }
    if (!isInMyMesa(step)) {
      alert(`Esta tarea está en mesa de trabajo: ${step.mesa_owner_name || 'Usuario desconocido'}.`);
      setDraggedRutaId(null);
      setDropTarget(null);
      return;
    }

    setIsMovingStep(true);
    setMesaOwnerForRuta(step.ruta_id, null, null);
    const result = await releaseStepFromMyMesa(step);
    if (!result.success || result.status !== 'released') {
      setMesaOwnerForRuta(step.ruta_id, step.mesa_owner_user_id, step.mesa_owner_name);
      alert('No se pudo mover la tarea a pendientes.');
    }
    setIsMovingStep(false);
    setDraggedRutaId(null);
    setDropTarget(null);
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredStationSteps.map((step) => step.ruta_id);
    if (visibleIds.length === 0) return;
    const allSelected = visibleIds.every((id) => selectedRutaIds.includes(id));
    if (allSelected) {
      setSelectedRutaIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    const next = new Set(selectedRutaIds);
    visibleIds.forEach((id) => next.add(id));
    setSelectedRutaIds(Array.from(next));
  };

  const handleCompleteSelected = async () => {
    if (selectedSteps.length === 0) return;
    const confirmed = window.confirm(
      `Se finalizarán ${selectedSteps.length} pasos seleccionados. ¿Querés continuar?`
    );
    if (!confirmed) return;

    setIsBulkCompleting(true);
    let successCount = 0;

    for (const step of selectedSteps) {
      const result = await completeStep(step.ruta_id, step.orden_item_id);
      if (result.success) successCount += 1;
    }

    await refreshStations();
    setSelectedRutaIds([]);
    setIsBulkCompleting(false);

    if (successCount < selectedSteps.length) {
      alert(`Se completaron ${successCount} de ${selectedSteps.length} pasos.`);
    }
  };

  const handleMoveSelectedToMesa = async () => {
    if (selectedSteps.length === 0) return;
    const candidates = selectedSteps.filter((step) => !isInMyMesa(step));
    if (candidates.length === 0) return;

    setIsMovingStep(true);
    let blocked = 0;
    const blockedOwners = new Set<string>();
    for (const step of candidates) {
      setMesaOwnerForRuta(step.ruta_id, profile?.id || null, profile?.full_name || 'Usuario desconocido');
      const result = await takeStepToMyMesa(step);
      if (!result.success || result.status === 'error') {
        setMesaOwnerForRuta(step.ruta_id, step.mesa_owner_user_id, step.mesa_owner_name);
        continue;
      }
      if (result.status === 'taken_by_other') {
        blocked += 1;
        blockedOwners.add(result.ownerName || 'Usuario desconocido');
        setMesaOwnerForRuta(step.ruta_id, result.ownerUserId, result.ownerName || 'Usuario desconocido');
        continue;
      }
      setMesaOwnerForRuta(step.ruta_id, profile?.id || null, profile?.full_name || 'Usuario desconocido');
    }
    setIsMovingStep(false);
    if (blocked > 0) {
      alert(`No se pudieron asignar ${blocked} tareas porque ya están tomadas por: ${Array.from(blockedOwners).join(', ')}.`);
    }
  };

  const handleMoveSelectedToPendientes = async () => {
    if (selectedSteps.length === 0) return;
    const candidates = selectedSteps.filter((step) => isInMyMesa(step));
    if (candidates.length === 0) return;

    setIsMovingStep(true);
    for (const step of candidates) {
      setMesaOwnerForRuta(step.ruta_id, null, null);
      const result = await releaseStepFromMyMesa(step);
      if (!result.success || result.status !== 'released') {
        setMesaOwnerForRuta(step.ruta_id, step.mesa_owner_user_id, step.mesa_owner_name);
      }
    }
    setIsMovingStep(false);
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
  const displayedStations = deliverySort === 'none'
    ? stations
    : [...stations].sort((a, b) => {
      const earliestA = sortStepsByDelivery(a.pasos)[0];
      const earliestB = sortStepsByDelivery(b.pasos)[0];
      const dateA = parseDeliveryDate(earliestA?.fecha_estimada_entrega);
      const dateB = parseDeliveryDate(earliestB?.fecha_estimada_entrega);

      if (dateA === null && dateB === null) return 0;
      if (dateA === null) return 1;
      if (dateB === null) return -1;
      return deliverySort === 'asc' ? dateA - dateB : dateB - dateA;
    });
  const selectedStation = selectedStationId
    ? displayedStations.find((s) => s.estacion_id === selectedStationId)
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
            onChange={handleStationChange}
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
          {isMovingStep && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Moviendo tarea...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleToggleDeliverySort} variant={deliverySort === 'none' ? 'outline' : 'primary'} size="sm">
            {deliverySort === 'none' ? (
              <ArrowUpDown className="w-4 h-4 mr-2" />
            ) : (
              <CalendarClock className="w-4 h-4 mr-2" />
            )}
            {deliverySort === 'none' && 'Ordenar por Entrega'}
            {deliverySort === 'asc' && 'Entrega: Próximas'}
            {deliverySort === 'desc' && 'Entrega: Lejanas'}
          </Button>
        </div>
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
              {displayedStations.map((station) => (
                <StationCard
                  key={station.estacion_id}
                  estacion_id={station.estacion_id}
                  estacion_nombre={station.estacion_nombre}
                  estacion_descripcion={station.estacion_descripcion}
                  pasos_mesa_trabajo={station.pasos.filter((step) => isInMyMesa(step)).length}
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
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900 mb-1">
                      {selectedStation.estacion_nombre}
                    </h2>
                    {selectedStation.estacion_descripcion && (
                      <p className="text-slate-600">{selectedStation.estacion_descripcion}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-semibold text-slate-900">
                      {selectedStation.total_pasos_activos}
                    </div>
                    <div className="text-sm text-slate-500">
                      {selectedStation.total_pasos_activos === 1 ? 'paso activo' : 'pasos activos'}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleViewAllStations}>
                    ← Ver todas las estaciones
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSelectAllVisible}>
                    {filteredStationSteps.every((step) => selectedRutaIds.includes(step.ruta_id)) && filteredStationSteps.length > 0 ? (
                      <CheckSquare className="w-4 h-4 mr-2" />
                    ) : (
                      <Square className="w-4 h-4 mr-2" />
                    )}
                    Seleccionar todos
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">Total activos</p>
                  <p className="text-xl font-semibold text-slate-900">{metrics.total}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                  <p className="text-xs text-amber-700">Mi mesa de trabajo</p>
                  <p className="text-xl font-semibold text-amber-900">{metrics.mesaTrabajo}</p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-3">
                  <p className="text-xs text-sky-700">Pendientes</p>
                  <p className="text-xl font-semibold text-sky-900">{metrics.pendientes}</p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-3">
                  <p className="text-xs text-orange-700">Urgentes</p>
                  <p className="text-xl font-semibold text-orange-900">{metrics.urgentes}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Mostrando</p>
                  <p className="text-xl font-semibold text-slate-900">{metrics.mostrando}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <span className="text-xs font-medium text-slate-500 mr-1">Filtros:</span>
                <Button
                  size="sm"
                  variant={statusFilter === 'all' ? 'primary' : 'outline'}
                  onClick={() => setStatusFilter('all')}
                >
                  Todos
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'pendiente' ? 'primary' : 'outline'}
                  onClick={() => setStatusFilter('pendiente')}
                >
                  Pendientes
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'mesa' ? 'primary' : 'outline'}
                  onClick={() => setStatusFilter('mesa')}
                >
                  Mi mesa
                </Button>
                <Button
                  size="sm"
                  variant={onlyUrgent ? 'primary' : 'outline'}
                  onClick={() => setOnlyUrgent((prev) => !prev)}
                >
                  Solo urgentes
                </Button>
              </div>

              {selectedRutaIds.length > 0 && (
                <div className="sticky top-2 z-20 rounded-xl border border-slate-300 bg-slate-900 px-4 py-3 text-white shadow-lg">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <span className="font-semibold">{selectedRutaIds.length}</span>{' '}
                      {selectedRutaIds.length === 1 ? 'paso seleccionado' : 'pasos seleccionados'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMoveSelectedToMesa}
                        className="border-amber-500 text-amber-200 hover:bg-amber-700/30"
                        disabled={selectedSteps.every((step) => isInMyMesa(step))}
                      >
                        Enviar a mi mesa
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMoveSelectedToPendientes}
                        className="border-sky-500 text-sky-200 hover:bg-sky-700/30"
                        disabled={selectedSteps.every((step) => !isInMyMesa(step))}
                      >
                        Quitar de mi mesa
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearSelection}
                        className="border-slate-500 text-slate-100 hover:bg-slate-800"
                      >
                        Limpiar selección
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCompleteSelected}
                        disabled={isBulkCompleting}
                        className="bg-emerald-500 text-white hover:bg-emerald-600"
                      >
                        {isBulkCompleting ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        Finalizar seleccionados
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {filteredStationSteps.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Sin resultados"
                  description="No hay pasos que coincidan con los filtros activos"
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4 flex flex-col">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
                        Mi mesa de trabajo
                      </h3>
                      <span className="text-sm text-slate-500">
                        {filteredStationSteps.filter((paso) => isInMyMesa(paso)).length}{' '}
                        {filteredStationSteps.filter((paso) => isInMyMesa(paso)).length === 1 ? 'paso' : 'pasos'}
                      </span>
                    </div>
                    <div
                      className={`space-y-3 rounded-xl border border-dashed p-2 transition-colors min-h-[420px] flex-1 ${
                        dropTarget === 'mesa' ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200'
                      }`}
                      onDragEnterCapture={(event) => {
                        event.preventDefault();
                        setDropTarget('mesa');
                      }}
                      onDragOverCapture={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setDropTarget('mesa');
                      }}
                      onDropCapture={async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        await handleDropToMesa();
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDropTarget('mesa');
                      }}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={async (event) => {
                        event.preventDefault();
                        await handleDropToMesa();
                      }}
                    >
                      {renderGroupedSteps(sortStepsByDelivery(filteredStationSteps.filter((paso) => isInMyMesa(paso))))}
                      {filteredStationSteps.filter((paso) => isInMyMesa(paso)).length === 0 && (
                          <div className="text-center py-8 text-slate-500">
                            Arrastrá tareas acá para trabajar en ellas
                          </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 flex flex-col">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-sky-500 rounded-full"></span>
                        Pendientes compartidas
                      </h3>
                      <span className="text-sm text-slate-500">
                        {filteredStationSteps.filter((paso) => paso.estado_paso === 'pendiente').length}{' '}
                        {filteredStationSteps.filter((paso) => paso.estado_paso === 'pendiente').length === 1 ? 'paso' : 'pasos'}
                      </span>
                    </div>
                    <div
                      className={`space-y-3 rounded-xl border border-dashed p-2 transition-colors min-h-[420px] flex-1 ${
                        dropTarget === 'pendientes' ? 'border-sky-400 bg-sky-50/40' : 'border-slate-200'
                      }`}
                      onDragEnterCapture={(event) => {
                        event.preventDefault();
                        setDropTarget('pendientes');
                      }}
                      onDragOverCapture={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setDropTarget('pendientes');
                      }}
                      onDropCapture={async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        await handleDropToPendientes();
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDropTarget('pendientes');
                      }}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={async (event) => {
                        event.preventDefault();
                        await handleDropToPendientes();
                      }}
                    >
                      {renderGroupedSteps(sortStepsByDelivery(filteredStationSteps.filter((paso) => paso.estado_paso === 'pendiente')))}
                      {filteredStationSteps.filter((paso) => paso.estado_paso === 'pendiente').length === 0 && (
                          <div className="text-center py-8 text-slate-500">
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
            fecha_estimada_entrega: selectedStep.fecha_estimada_entrega,
            estado: 'en_proceso' as EstadoOrdenItem,
            producto_categoria: null,
            total_pasos: 0,
            pasos_completados: 0,
            pasos_en_proceso: 0,
            pasos_pendientes: 0,
            progreso_porcentaje: 0,
            paso_relevante: null,
          }}
        />
      )}
    </div>
  );
}
