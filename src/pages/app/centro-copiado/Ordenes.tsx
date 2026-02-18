import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Eye, Calendar, DollarSign, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Switch } from '../../../components/ui/Switch';
import { supabase } from '../../../lib/supabase';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Pagination } from '../../../components/ui/Pagination';
import { usePageHeader } from '../../../hooks/usePageHeader';


import { useCentroCopiadoOrdenes } from '../../../hooks/useCentroCopiadoOrdenes';
import { useDebounce } from '../../../hooks/useDebounce';
import type { EstadoOrdenCopiado } from '../../../types/database';

export function Ordenes() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoOrdenCopiado | ''>('');
  const [mostrarSoloActivas, setMostrarSoloActivas] = useState(true);
  const [page, setPage] = useState(1);
  const itemsPerPage = 25;
  const [pagosPorOrden, setPagosPorOrden] = useState<Record<string, { totalPagado: number }>>({});
  const [selectedOrdenIds, setSelectedOrdenIds] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const estados = useMemo(() =>
    !estadoFiltro && mostrarSoloActivas ? ['pendiente', 'en_proceso'] as EstadoOrdenCopiado[] : [],
    [estadoFiltro, mostrarSoloActivas]);

  const { ordenes, totalCount, loading, fetchOrdenes } = useCentroCopiadoOrdenes({
    searchTerm: debouncedSearchTerm,
    estado: estadoFiltro || null,
    estados,
    page,
    itemsPerPage,
  });

  useEffect(() => {
    setSelectedOrdenIds((prev) => prev.filter((id) => ordenes.some((o) => o.id === id)));
  }, [ordenes]);

  useEffect(() => {
    const fetchPagos = async () => {
      if (!ordenes || ordenes.length === 0) return;

      const ordenesIndependientes = ordenes.filter(o => !o.orden_trabajo_id);
      if (ordenesIndependientes.length === 0) return;

      const { data: pagos } = await supabase
        .from('centro_copiado_ordenes_pagos')
        .select('orden_copiado_id, monto')
        .in('orden_copiado_id', ordenesIndependientes.map(o => o.id));

      if (pagos) {
        const pagosMap: Record<string, { totalPagado: number }> = {};
        pagos.forEach(pago => {
          if (!pagosMap[pago.orden_copiado_id]) {
            pagosMap[pago.orden_copiado_id] = { totalPagado: 0 };
          }
          pagosMap[pago.orden_copiado_id].totalPagado += Number(pago.monto);
        });
        setPagosPorOrden(pagosMap);
      }
    };

    fetchPagos();
  }, [ordenes]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, estadoFiltro, mostrarSoloActivas]);

  const headerAction = useMemo(
    () => (
      <Button
        variant="primary"
        onClick={() => navigate('/app/centro-copiado/ordenes/crear')}
      >
        <Plus className="w-5 h-5" />
        Nueva Orden
      </Button>
    ),
    [navigate]
  );

  usePageHeader('Órdenes de Copiado', headerAction);

  const getEstadoPagoBadge = (orden: (typeof ordenes)[number]) => {
    if (orden.orden_trabajo_id) {
      // Para órdenes asociadas a OT, mostrar badge clickeable con número de OT
      return (
        <button
          onClick={() => navigate(`/app/orders/ordenes/${orden.orden_trabajo_id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-sm font-medium transition-colors"
          title="Ver gestión de pagos en orden de trabajo"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Ver OT</span>
        </button>
      );
    }

    const pagosInfo = pagosPorOrden[orden.id];
    const totalPagado = pagosInfo?.totalPagado || 0;
    const total = Number(orden.total);

    if (totalPagado >= total) {
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Pagado
        </Badge>
      );
    } else if (totalPagado > 0) {
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Parcial
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Pendiente
        </Badge>
      );
    }
  };

  const getEstadoBadge = (estado: EstadoOrdenCopiado) => {
    const estilos = {
      pendiente: { variant: 'warning' as const, label: 'Pendiente' },
      en_proceso: { variant: 'primary' as const, label: 'En Proceso' },
      finalizada: { variant: 'success' as const, label: 'Finalizada' },
      entregada: { variant: 'secondary' as const, label: 'Entregada' },
      cancelada: { variant: 'danger' as const, label: 'Cancelada' },
    };

    const estilo = estilos[estado] || { variant: 'secondary' as const, label: estado };
    return <Badge variant={estilo.variant}>{estilo.label}</Badge>;
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isFinalizable = (estado: EstadoOrdenCopiado) => estado === 'pendiente' || estado === 'en_proceso';
  const isEntregable = (estado: EstadoOrdenCopiado) => estado === 'pendiente' || estado === 'finalizada';

  const allVisibleSelected = ordenes.length > 0 && ordenes.every((o) => selectedOrdenIds.includes(o.id));

  const toggleSelectOne = (id: string) => {
    setSelectedOrdenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedOrdenIds((prev) => prev.filter((id) => !ordenes.some((o) => o.id === id)));
      return;
    }
    const visibleIds = ordenes.map((o) => o.id);
    setSelectedOrdenIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleBulkUpdate = async (targetEstado: EstadoOrdenCopiado) => {
    if (selectedOrdenIds.length === 0 || bulkUpdating) return;

    const selectedOrdenes = ordenes.filter((o) => selectedOrdenIds.includes(o.id));
    const eligibleOrdenes = selectedOrdenes.filter((o) =>
      targetEstado === 'finalizada' ? isFinalizable(o.estado) : isEntregable(o.estado)
    );

    if (eligibleOrdenes.length === 0) {
      window.alert(`No hay órdenes seleccionadas aptas para marcar como "${targetEstado}".`);
      return;
    }

    const actionLabel = targetEstado === 'finalizada' ? 'finalizar' : 'entregar';
    const confirm = window.confirm(`¿Deseas ${actionLabel} ${eligibleOrdenes.length} orden(es) seleccionada(s)?`);
    if (!confirm) return;

    setBulkUpdating(true);
    try {
      const updates: Record<string, string> = { estado: targetEstado };
      if (targetEstado === 'entregada') {
        updates.fecha_entrega_real = new Date().toISOString();
      }

      const { error } = await supabase
        .from('centro_copiado_ordenes')
        .update(updates)
        .in('id', eligibleOrdenes.map((o) => o.id));

      if (error) throw error;

      await fetchOrdenes();
      setSelectedOrdenIds((prev) => prev.filter((id) => !eligibleOrdenes.some((o) => o.id === id)));

      const skipped = selectedOrdenes.length - eligibleOrdenes.length;
      if (skipped > 0) {
        window.alert(`Se actualizaron ${eligibleOrdenes.length} orden(es). ${skipped} no aplicaban por su estado actual.`);
      }
    } catch (err) {
      console.error('Error en acción masiva de órdenes de copiado:', err);
      window.alert('No se pudo completar la acción masiva. Intentalo nuevamente.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <Card>
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Cargando órdenes...</p>
          </div>
        </Card>
      );
    }

    if (ordenes.length === 0 && !searchTerm && !estadoFiltro) {
      return (
        <Card>
          <div className="p-12">
            <EmptyState
              icon={FileText}
              title="No hay órdenes de copiado"
              description="Comienza creando tu primera orden de copiado. Las órdenes pueden crearse de forma independiente o vincularse a una orden de trabajo principal."
              action={
                <Button variant="primary" onClick={() => navigate('/app/centro-copiado/ordenes/crear')}>
                  <Plus className="w-5 h-5" />
                  Crear Primera Orden
                </Button>
              }
            />
          </div>
        </Card>
      );
    }

    if (ordenes.length === 0) {
      return (
        <Card>
          <div className="p-12">
            <EmptyState
              icon={FileText}
              title="No se encontraron órdenes"
              description="No hay órdenes que coincidan con los filtros aplicados."
            />
          </div>
        </Card>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 w-full">
          <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        title="Seleccionar todas las visibles"
                      />
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Número de Orden
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Items
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Estado
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Fecha Solicitud
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Fecha Entrega
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Estado Pago
                    </th>
                    <th scope="col" className="relative px-3 py-2">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ordenes.map((orden) => (
                    <tr key={orden.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedOrdenIds.includes(orden.id)}
                          onChange={() => toggleSelectOne(orden.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          title={`Seleccionar ${orden.numero_orden}`}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-semibold text-blue-600 text-xs">{orden.numero_orden}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="max-w-[150px] truncate">
                          <div className="font-medium truncate text-sm" title={orden.cliente?.nombre_fantasia}>{orden.cliente?.nombre_fantasia || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{orden.cliente?.numero_documento}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge variant="secondary">{orden.items_count || 0}</Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {getEstadoBadge(orden.estado)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Calendar className="w-3 h-3" />
                          {formatearFecha(orden.fecha_solicitud)}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-600">
                          {orden.fecha_entrega_estimada
                            ? formatearFecha(orden.fecha_entrega_estimada)
                            : '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-semibold text-green-600 text-sm">
                          <DollarSign className="w-3 h-3" />
                          {Number(orden.total).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {getEstadoPagoBadge(orden)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/app/centro-copiado/ordenes/${orden.id}`)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>


        {totalCount > itemsPerPage && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(totalCount / itemsPerPage)}
            onPageChange={setPage}
            totalItems={totalCount}
            itemsPerPage={itemsPerPage}
          />
        )
        }
      </>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="px-3 py-2">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto items-center">
              <div className="w-full sm:w-64">
                <SearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Buscar por cliente, orden..."
                />
              </div>
              <div className="w-full sm:w-48">
                <Select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value as EstadoOrdenCopiado | '')}
                >
                  <option value="">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="finalizada">Finalizada</option>
                  <option value="entregada">Entregada</option>
                  <option value="cancelada">Cancelada</option>
                </Select>
              </div>

              <div className="flex items-center">
                <Switch
                  checked={mostrarSoloActivas}
                  onChange={setMostrarSoloActivas}
                  label="Ocultar terminadas"
                  disabled={!!estadoFiltro}
                />
              </div>
            </div>
          </div>

          {selectedOrdenIds.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <span className="text-sm text-gray-700">
                {selectedOrdenIds.length} seleccionada(s)
              </span>
              <Button
                variant="success"
                size="sm"
                onClick={() => handleBulkUpdate('finalizada')}
                disabled={bulkUpdating}
              >
                Finalizar seleccionadas
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleBulkUpdate('entregada')}
                disabled={bulkUpdating}
              >
                Entregar seleccionadas
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedOrdenIds([])}
                disabled={bulkUpdating}
              >
                Limpiar selección
              </Button>
            </div>
          )}
        </div>
      </Card>

      {renderContent()}
    </div>
  );
}
