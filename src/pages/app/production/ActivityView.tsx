import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Users, RefreshCw } from 'lucide-react';
import { Tabs } from '../../../components/ui/Tabs';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useActividadUsuarios } from '../../../hooks/useActividadUsuarios';
import { useRendimientoOperadores } from '../../../hooks/useRendimientoOperadores';
import { useTeamMembers } from '../../../hooks/useTeamMembers';
import { useEstaciones } from '../../../hooks/useEstaciones';
import { ActividadRow } from '../../../components/activity/ActividadRow';
import { ActividadFilters } from '../../../components/activity/ActividadFilters';
import { OperadorCard } from '../../../components/activity/OperadorCard';
import { ResumenEquipoKPIs } from '../../../components/activity/ResumenEquipoKPIs';
import { DateRangeSelector } from '../../../components/productivity/DateRangeSelector';
import type { FiltrosActividad } from '../../../types/database';

type TabId = 'historial' | 'rendimiento';

export function ActivityView() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('historial');
  const [dateRange, setDateRange] = useState<{
    desde: Date | null;
    hasta: Date | null;
  }>({
    desde: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    hasta: new Date(),
  });

  const [filtros, setFiltros] = useState<Partial<FiltrosActividad>>({
    fecha_desde: dateRange.desde,
    fecha_hasta: dateRange.hasta,
    responsables: [],
    estaciones: [],
    estados: [],
    tipo_etapa: null,
  });

  const {
    actividades,
    loading: loadingActividades,
    error: errorActividades,
    total,
    refresh: refreshActividades,
  } = useActividadUsuarios(filtros);

  const {
    metricas,
    resumenEquipo,
    loading: loadingRendimiento,
    error: errorRendimiento,
    refresh: refreshRendimiento,
  } = useRendimientoOperadores({
    fecha_desde: dateRange.desde,
    fecha_hasta: dateRange.hasta,
  });

  const { members } = useTeamMembers();
  const { estaciones } = useEstaciones();

  const usuarios = useMemo(
    () =>
      members
        .filter((m) => m.is_active)
        .map((m) => ({ id: m.id, nombre: m.full_name })),
    [members]
  );

  const estacionesOptions = useMemo(
    () =>
      estaciones
        .filter((e) => e.is_active)
        .map((e) => ({ id: e.id, nombre: e.nombre })),
    [estaciones]
  );

  const handleDateRangeChange = (desde: Date | null, hasta: Date | null) => {
    setDateRange({ desde, hasta });
    setFiltros((prev) => ({ ...prev, fecha_desde: desde, fecha_hasta: hasta }));
  };

  const handleRefresh = () => {
    if (activeTab === 'historial') {
      refreshActividades();
    } else {
      refreshRendimiento();
    }
  };

  const handleClickOrden = (ordenId: string) => {
    navigate(`/app/orders/${ordenId}`);
  };

  const topPerformer = metricas.length > 0 ? metricas[0] : null;

  const tabs = [
    {
      id: 'historial' as TabId,
      label: 'Historial de Actividad',
      icon: Activity,
      count: total,
    },
    {
      id: 'rendimiento' as TabId,
      label: 'Rendimiento de Operadores',
      icon: Users,
      count: metricas.length,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <DateRangeSelector
          desde={dateRange.desde}
          hasta={dateRange.hasta}
          onChange={handleDateRangeChange}
        />

        <Button variant="secondary" icon={RefreshCw} onClick={handleRefresh}>
          Actualizar
        </Button>
      </div>

      {resumenEquipo && (
        <ResumenEquipoKPIs resumen={resumenEquipo} loading={loadingRendimiento} />
      )}

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as TabId)}
      />

      <div className="mt-6">
        {activeTab === 'historial' && (
          <div className="space-y-4">
            <ActividadFilters
              filtros={filtros}
              onFiltrosChange={setFiltros}
              usuarios={usuarios}
              estaciones={estacionesOptions}
            />

            {loadingActividades && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-600">Cargando actividad...</p>
              </div>
            )}

            {errorActividades && (
              <div className="text-center py-12">
                <p className="text-red-600">{errorActividades}</p>
              </div>
            )}

            {!loadingActividades && !errorActividades && actividades.length === 0 && (
              <EmptyState
                icon={Activity}
                title="No hay actividad registrada"
                description="No se encontró actividad en el período seleccionado"
              />
            )}

            {!loadingActividades &&
              !errorActividades &&
              actividades.length > 0 && (
                <div className="space-y-3">
                  {actividades.map((actividad) => (
                    <ActividadRow
                      key={actividad.ruta_id}
                      actividad={actividad}
                      onClickOrden={handleClickOrden}
                    />
                  ))}

                  {total > actividades.length && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-600">
                        Mostrando {actividades.length} de {total} registros
                      </p>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        {activeTab === 'rendimiento' && (
          <div className="space-y-6">
            {loadingRendimiento && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-600">
                  Cargando métricas de rendimiento...
                </p>
              </div>
            )}

            {errorRendimiento && (
              <div className="text-center py-12">
                <p className="text-red-600">{errorRendimiento}</p>
              </div>
            )}

            {!loadingRendimiento && !errorRendimiento && metricas.length === 0 && (
              <EmptyState
                icon={Users}
                title="No hay métricas de rendimiento"
                description="No se encontraron operadores con actividad en el período seleccionado"
              />
            )}

            {!loadingRendimiento && !errorRendimiento && metricas.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {metricas.map((metrica, index) => (
                  <OperadorCard
                    key={metrica.responsable_id}
                    metricas={metrica}
                    isTopPerformer={index === 0 && topPerformer !== null}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
