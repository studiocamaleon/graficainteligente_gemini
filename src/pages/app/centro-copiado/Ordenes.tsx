import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Eye, Calendar, DollarSign, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Table } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Pagination } from '../../../components/ui/Pagination';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useCentroCopiadoOrdenes } from '../../../hooks/useCentroCopiadoOrdenes';
import type { EstadoOrdenCopiado } from '../../../types/database';

export function Ordenes() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoOrdenCopiado | ''>('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 25;
  const [pagosPorOrden, setPagosPorOrden] = useState<Record<string, { totalPagado: number }>>({});

  const { ordenes, totalCount, loading } = useCentroCopiadoOrdenes({
    searchTerm,
    estado: estadoFiltro || null,
    page,
    itemsPerPage,
  });

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

  usePageHeader('Gestiona las órdenes de copiado independientes o vinculadas a órdenes de trabajo', headerAction);

  const getEstadoPagoBadge = (orden: any) => {
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
        <Card>
          <div className="p-6">
            <Table
              columns={[
                {
                  key: 'numero_orden',
                  header: 'Número de Orden',
                  render: (orden) => (
                    <span className="font-semibold text-blue-600">{orden.numero_orden}</span>
                  ),
                },
                {
                  key: 'cliente',
                  header: 'Cliente',
                  render: (orden) => (
                    <div>
                      <div className="font-medium">{orden.cliente?.nombre_fantasia || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{orden.cliente?.numero_documento}</div>
                    </div>
                  ),
                },
                {
                  key: 'items',
                  header: 'Items',
                  render: (orden) => (
                    <Badge variant="secondary">{orden.items_count || 0}</Badge>
                  ),
                },
                {
                  key: 'estado',
                  header: 'Estado',
                  render: (orden) => getEstadoBadge(orden.estado),
                },
                {
                  key: 'fecha_solicitud',
                  header: 'Fecha Solicitud',
                  render: (orden) => (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {formatearFecha(orden.fecha_solicitud)}
                    </div>
                  ),
                },
                {
                  key: 'fecha_entrega',
                  header: 'Fecha Entrega',
                  render: (orden) => (
                    <div className="text-sm text-gray-600">
                      {orden.fecha_entrega_estimada
                        ? formatearFecha(orden.fecha_entrega_estimada)
                        : '-'}
                    </div>
                  ),
                },
                {
                  key: 'total',
                  header: 'Total',
                  render: (orden) => (
                    <div className="flex items-center gap-1 font-semibold text-green-600">
                      <DollarSign className="w-4 h-4" />
                      {Number(orden.total).toFixed(2)}
                    </div>
                  ),
                },
                {
                  key: 'estado_pago',
                  header: 'Estado Pago',
                  render: (orden) => getEstadoPagoBadge(orden),
                },
                {
                  key: 'acciones',
                  header: 'Acciones',
                  render: (orden) => (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/app/centro-copiado/ordenes/${orden.id}`)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  ),
                },
              ]}
              data={ordenes}
              keyExtractor={(orden) => orden.id}
            />
          </div>
        </Card>

        {totalCount > itemsPerPage && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(totalCount / itemsPerPage)}
            onPageChange={setPage}
          />
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Buscar por número de orden u observaciones..."
              />
            </div>

            <div>
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
          </div>
        </div>
      </Card>

      {renderContent()}
    </div>
  );
}
