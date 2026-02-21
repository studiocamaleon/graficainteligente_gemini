import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Plus, Eye, Edit2, Power, Check, X as XIcon, CheckCircle2, XCircle, Link as LinkIcon, QrCode, Download, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import QRCode from 'qrcode';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/Button';
import { usePageHeader } from '../../hooks/usePageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { Select } from '../../components/ui/Select';
import { Table } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ClientForm, ClientFormData } from '../../components/clients/ClientForm';
import { ClienteStatusBadge } from '../../components/clients/ClienteStatusBadge';
import { AprobarClienteModal } from '../../components/clients/AprobarClienteModal';
import { RechazarClienteModal } from '../../components/clients/RechazarClienteModal';
import { DetalleClienteModal } from '../../components/clients/DetalleClienteModal';
import { useClients } from '../../hooks/useClients';
import { useClient } from '../../hooks/useClient';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import type { Client } from '../../types/database';
import type { ClientWithCommercialMetrics } from '../../hooks/useClients';
import { EntityKpiStrip } from '../../components/shared/enterprise/EntityKpiStrip';
import { EntityToolbar } from '../../components/shared/enterprise/EntityToolbar';
import { AdvancedFiltersPanel } from '../../components/shared/enterprise/AdvancedFiltersPanel';

export function Clients() {
  type SortByOption =
    | 'created_at_desc'
    | 'ltv_desc'
    | 'name_asc'
    | 'recency_desc'
    | 'frequency_90d_desc'
    | 'ticket_promedio_desc';
  type SortDirection = 'asc' | 'desc';
  type SortableColumnKey =
    | 'nombre_fantasia'
    | 'razon_social'
    | 'ltv_total'
    | 'recencia'
    | 'ordenes_90d'
    | 'ticket_promedio'
    | 'canal_preferido'
    | 'riesgo_comercial'
    | 'documento'
    | 'status_aprobacion'
    | 'cuenta_corriente'
    | 'estado';

  interface SortCriterion {
    key: SortableColumnKey;
    direction: SortDirection;
  }

  const { profile } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager', 'operador_diseno'].includes(profile.role);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statusAprobacionFilter, setStatusAprobacionFilter] = useState<string>('all');
  const [cuentaCorrienteFilter, setCuentaCorrienteFilter] = useState<string>('all');
  const [riesgoComercialFilter, setRiesgoComercialFilter] = useState<string>('all');
  const [sinCompraFilter, setSinCompraFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortByOption>('created_at_desc');
  const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAprobarModalOpen, setIsAprobarModalOpen] = useState(false);
  const [isRechazarModalOpen, setIsRechazarModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithCommercialMetrics | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadingQR, setDownloadingQR] = useState(false);

  const handleOpenCreateModal = useCallback(() => {
    setSelectedClient(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const headerAction = useMemo(
    () =>
      canEdit ? (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          Nuevo Cliente
        </Button>
      ) : undefined,
    [canEdit, handleOpenCreateModal]
  );

  usePageHeader('Gestión de Clientes', headerAction);

  // Manejar parámetros de la URL (ej: /app/clients?filter=pending)
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'pending') {
      setStatusAprobacionFilter('pending');
      setStatusFilter('all');
      // Limpiar el parámetro después de aplicarlo
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const isActiveFilter = statusFilter === 'all' ? null : statusFilter === 'active';
  const hasCuentaCorrienteFilter = cuentaCorrienteFilter === 'all' ? null : cuentaCorrienteFilter === 'yes';
  const statusAprobacionFilterValue = statusAprobacionFilter === 'all' ? null : (statusAprobacionFilter as 'pending' | 'approved' | 'rejected');
  const riesgoComercialFilterValue = riesgoComercialFilter === 'all' ? null : (riesgoComercialFilter as 'alto' | 'medio' | 'bajo');
  const sinCompraDiasMin = sinCompraFilter === 'gt_60' ? 60 : null;

  const { clients, totalCount, avgLtv, totalLtv, loading, refetch } = useClients({
    searchTerm: debouncedSearch,
    isActive: isActiveFilter,
    hasCuentaCorriente: hasCuentaCorrienteFilter,
    statusAprobacion: statusAprobacionFilterValue,
    riesgoComercial: riesgoComercialFilterValue,
    sinCompraDiasMin,
    sortBy,
    sortCriteria,
    page: currentPage,
    itemsPerPage,
  });

  // Obtener conteo de clientes pendientes (sin filtros)
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!profile?.company_id) return;

    const fetchPendingCount = async () => {
      const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('status_aprobacion', 'pending');

      setPendingCount(count || 0);
    };

    fetchPendingCount();
  }, [profile?.company_id, clients]); // Refetch cuando cambie clients para mantener actualizado

  const { createClient, updateClient, toggleClientStatus, loading: mutationLoading } = useClient();
  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmAction,
  } = useConfirmDialog();

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const activeAdvancedFiltersCount = useMemo(() => {
    let count = 0;
    if (statusAprobacionFilter !== 'all') count += 1;
    if (cuentaCorrienteFilter !== 'all') count += 1;
    if (sortCriteria.length > 0) count += 1;
    if (riesgoComercialFilter !== 'all') count += 1;
    if (sinCompraFilter !== 'all') count += 1;
    return count;
  }, [cuentaCorrienteFilter, riesgoComercialFilter, sinCompraFilter, sortCriteria.length, statusAprobacionFilter]);

  const resetAdvancedFilters = () => {
    setStatusAprobacionFilter('all');
    setCuentaCorrienteFilter('all');
    setSortBy('created_at_desc');
    setSortCriteria([]);
    setRiesgoComercialFilter('all');
    setSinCompraFilter('all');
    setCurrentPage(1);
  };

  const mapSortByToCriteria = useCallback((value: SortByOption): SortCriterion[] => {
    switch (value) {
      case 'ltv_desc':
        return [{ key: 'ltv_total', direction: 'desc' }];
      case 'name_asc':
        return [{ key: 'nombre_fantasia', direction: 'asc' }];
      case 'recency_desc':
        return [{ key: 'recencia', direction: 'desc' }];
      case 'frequency_90d_desc':
        return [{ key: 'ordenes_90d', direction: 'desc' }];
      case 'ticket_promedio_desc':
        return [{ key: 'ticket_promedio', direction: 'desc' }];
      default:
        return [];
    }
  }, []);

  const applySortByPreset = useCallback((value: SortByOption) => {
    setSortBy(value);
    setSortCriteria(mapSortByToCriteria(value));
  }, [mapSortByToCriteria]);

  const mapCriteriaToSortBy = useCallback((criteria: SortCriterion[]): SortByOption => {
    if (criteria.length !== 1) return 'created_at_desc';
    const [criterion] = criteria;
    if (criterion.key === 'ltv_total' && criterion.direction === 'desc') return 'ltv_desc';
    if (criterion.key === 'nombre_fantasia' && criterion.direction === 'asc') return 'name_asc';
    if (criterion.key === 'recencia' && criterion.direction === 'desc') return 'recency_desc';
    if (criterion.key === 'ordenes_90d' && criterion.direction === 'desc') return 'frequency_90d_desc';
    if (criterion.key === 'ticket_promedio' && criterion.direction === 'desc') return 'ticket_promedio_desc';
    return 'created_at_desc';
  }, []);

  const handleColumnSort = useCallback((key: SortableColumnKey, isMultiSort: boolean) => {
    setSortCriteria((prev) => {
      const index = prev.findIndex((c) => c.key === key);
      const current = index >= 0 ? prev[index] : null;
      const nextDirection: SortDirection | null =
        current?.direction === 'asc' ? 'desc' : current?.direction === 'desc' ? null : 'asc';
      let nextCriteria: SortCriterion[] = prev;

      if (!isMultiSort) {
        nextCriteria = nextDirection ? [{ key, direction: nextDirection }] : [];
        setSortBy(mapCriteriaToSortBy(nextCriteria));
        return nextCriteria;
      }

      if (index === -1 && nextDirection) {
        nextCriteria = [...prev, { key, direction: nextDirection }];
        setSortBy(mapCriteriaToSortBy(nextCriteria));
        return nextCriteria;
      }

      if (index >= 0 && !nextDirection) {
        nextCriteria = prev.filter((c) => c.key !== key);
        setSortBy(mapCriteriaToSortBy(nextCriteria));
        return nextCriteria;
      }

      nextCriteria = prev.map((c) => (c.key === key ? { ...c, direction: nextDirection as SortDirection } : c));
      setSortBy(mapCriteriaToSortBy(nextCriteria));
      return nextCriteria;
    });
    setCurrentPage(1);
  }, [mapCriteriaToSortBy]);

  const renderSortableHeader = useCallback((label: string, key: SortableColumnKey) => {
    const index = sortCriteria.findIndex((c) => c.key === key);
    const criterion = index >= 0 ? sortCriteria[index] : null;

    return (
      <button
        type="button"
        onClick={(event) => handleColumnSort(key, event.shiftKey)}
        className="group inline-flex items-center gap-1.5 hover:text-slate-900"
        title="Click para ordenar. Shift+Click para multi-orden."
      >
        <span>{label}</span>
        {criterion ? (
          criterion.direction === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-slate-700" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-slate-700" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
        )}
        {sortCriteria.length > 1 && index >= 0 && (
          <span className="rounded bg-slate-200 px-1 text-[10px] font-bold text-slate-700">{index + 1}</span>
        )}
      </button>
    );
  }, [handleColumnSort, sortCriteria]);

  const riskDistribution = useMemo(() => {
    const total = clients.length;
    if (total === 0) {
      return { bajo: 0, medio: 0, alto: 0 };
    }

    const counts = clients.reduce(
      (acc, client) => {
        const risk = client.riesgo_comercial || 'bajo';
        if (risk === 'alto') acc.alto += 1;
        else if (risk === 'medio') acc.medio += 1;
        else acc.bajo += 1;
        return acc;
      },
      { bajo: 0, medio: 0, alto: 0 }
    );

    return {
      bajo: Math.round((counts.bajo / total) * 100),
      medio: Math.round((counts.medio / total) * 100),
      alto: Math.round((counts.alto / total) * 100),
    };
  }, [clients]);

  const kpiItems = useMemo(
    () => [
      { id: 'total', label: 'Total clientes', value: totalCount.toLocaleString('es-AR') },
      { id: 'pending', label: 'Pendientes', value: pendingCount.toLocaleString('es-AR') },
      { id: 'avg_ltv', label: 'LTV promedio', value: `$${avgLtv.toLocaleString('es-AR')}` },
      { id: 'total_ltv', label: 'Total vendido', value: `$${totalLtv.toLocaleString('es-AR')}` },
      {
        id: 'risk_mix',
        label: 'Riesgo clientes',
        value: `B ${riskDistribution.bajo}% · M ${riskDistribution.medio}% · A ${riskDistribution.alto}%`,
        hint: 'Sobre clientes visibles con filtros activos',
      },
    ],
    [avgLtv, pendingCount, totalCount, totalLtv, riskDistribution]
  );

  const handleEdit = (client: ClientWithCommercialMetrics) => {
    setSelectedClient(client);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleViewDetails = (client: ClientWithCommercialMetrics) => {
    setSelectedClient(client);
    setIsDetailModalOpen(true);
  };

  const handleToggleStatus = async (client: Client) => {
    if (!canEdit) return;

    const action = client.is_active ? 'desactivar' : 'activar';
    confirmAction({
      title: `Confirmar ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: `¿Está seguro que desea ${action} al cliente "${client.nombre_fantasia}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: client.is_active ? 'warning' : 'info',
      onConfirm: async () => {
        const success = await toggleClientStatus(client.id, client.is_active);
        if (success) {
          refetch();
        }
      },
    });
  };

  const handleSubmit = async (data: ClientFormData) => {
    try {
      if (modalMode === 'create') {
        const newClient = await createClient(data);
        if (newClient) {
          setIsModalOpen(false);
          refetch();
        }
      } else if (selectedClient) {
        const updated = await updateClient(selectedClient.id, data);
        if (updated) {
          setIsModalOpen(false);
          refetch();
        }
      }
    } catch (error) {
      console.error('Error submitting client:', error);
    }
  };

  const handleAprobar = (client: Client) => {
    setSelectedClient(client);
    setIsAprobarModalOpen(true);
  };

  const handleRechazar = (client: Client) => {
    setSelectedClient(client);
    setIsRechazarModalOpen(true);
  };

  const handleAprobacionSuccess = () => {
    showToast('Operación realizada exitosamente', 'success');
    refetch();
  };

  const handleCopyAutoRegistroLink = async () => {
    if (!profile?.company_id) {
      showToast('Error: No se pudo obtener el ID de la empresa', 'error');
      return;
    }

    const link = `${window.location.origin}/registro/${profile.company_id}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      showToast('Link copiado al portapapeles', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Error al copiar el link:', error);
      showToast('Error al copiar el link', 'error');
    }
  };

  const handleDownloadQR = async () => {
    if (!profile?.company_id) {
      showToast('Error: No se pudo obtener el ID de la empresa', 'error');
      return;
    }

    const link = `${window.location.origin}/registro/${profile.company_id}`;
    setDownloadingQR(true);

    try {
      // Generar QR en formato SVG
      const svgString = await QRCode.toString(link, {
        type: 'svg',
        width: 500,
        margin: 2,
        color: {
          dark: '#1e293b', // Color oscuro
          light: '#ffffff', // Color blanco
        },
      });

      // Crear un blob con el SVG
      const blob = new Blob([svgString], { type: 'image/svg+xml' });

      // Crear un link temporal para descargar
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qr-autoregistro-clientes.svg';
      document.body.appendChild(a);
      a.click();

      // Limpiar
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Código QR descargado exitosamente', 'success');
    } catch (error) {
      console.error('Error al generar el código QR:', error);
      showToast('Error al generar el código QR', 'error');
    } finally {
      setDownloadingQR(false);
    }
  };

  const columns = [
    {
      key: 'nombre_fantasia',
      header: renderSortableHeader('Nombre de Fantasía', 'nombre_fantasia'),
      render: (client: Client) => (
        <div className="font-medium text-gray-900">{client.nombre_fantasia}</div>
      ),
    },
    {
      key: 'razon_social',
      header: renderSortableHeader('Razón Social', 'razon_social'),
      render: (client: Client) => (
        <div className="text-sm text-gray-600">{client.razon_social}</div>
      ),
      showFrom: 'md',
    },
    {
      key: 'ltv_total',
      header: renderSortableHeader('LTV', 'ltv_total'),
      render: (client: ClientWithCommercialMetrics) => (
        <div className="text-sm font-semibold text-emerald-700">
          ${Number(client.ltv_total || 0).toLocaleString('es-AR')}
        </div>
      ),
      width: '140px',
    },
    {
      key: 'recencia',
      header: renderSortableHeader('Recencia', 'recencia'),
      render: (client: ClientWithCommercialMetrics) => (
        <div className="text-sm text-gray-700">
          {client.dias_sin_comprar === null ? 'Sin compras' : `${client.dias_sin_comprar} días`}
        </div>
      ),
      width: '120px',
    },
    {
      key: 'ordenes_90d',
      header: renderSortableHeader('Órdenes 90d', 'ordenes_90d'),
      render: (client: ClientWithCommercialMetrics) => (
        <div className="text-sm font-medium text-blue-700">{client.ordenes_90d || 0}</div>
      ),
      width: '110px',
    },
    {
      key: 'ticket_promedio',
      header: renderSortableHeader('Ticket Prom.', 'ticket_promedio'),
      render: (client: ClientWithCommercialMetrics) => (
        <div className="text-sm text-gray-700">
          ${Number(client.ticket_promedio || 0).toLocaleString('es-AR')}
        </div>
      ),
      width: '130px',
    },
    {
      key: 'canal_preferido',
      header: renderSortableHeader('Canal', 'canal_preferido'),
      render: (client: ClientWithCommercialMetrics) => (
        <div className="text-sm text-gray-700">{client.canal_preferido || '-'}</div>
      ),
      width: '140px',
      showFrom: '2xl',
    },
    {
      key: 'mix',
      header: 'Mix OT/CC',
      render: (client: ClientWithCommercialMetrics) => (
        <div className="text-xs text-gray-700">
          {Number(client.mix_ot_pct || 0).toFixed(0)}% OT / {Number(client.mix_copiado_pct || 0).toFixed(0)}% CC
        </div>
      ),
      width: '130px',
      showFrom: '2xl',
    },
    {
      key: 'riesgo_comercial',
      header: renderSortableHeader('Riesgo', 'riesgo_comercial'),
      render: (client: ClientWithCommercialMetrics) => {
        const riesgo = client.riesgo_comercial || 'bajo';
        const variant: 'danger' | 'warning' | 'success' =
          riesgo === 'alto' ? 'danger' : riesgo === 'medio' ? 'warning' : 'success';
        const label = riesgo.charAt(0).toUpperCase() + riesgo.slice(1);
        return <Badge variant={variant} size="sm">{label}</Badge>;
      },
      width: '100px',
    },
    {
      key: 'documento',
      header: renderSortableHeader('CUIT/DNI', 'documento'),
      render: (client: Client) => (
        <div className="text-sm">
          <span className="text-gray-500">{client.tipo_documento}:</span>{' '}
          <span className="font-mono text-gray-900">{client.numero_documento}</span>
        </div>
      ),
      showFrom: 'md',
    },
    {
      key: 'status_aprobacion',
      header: renderSortableHeader('Estado Registro', 'status_aprobacion'),
      render: (client: Client) => (
        <ClienteStatusBadge status={client.status_aprobacion || 'approved'} />
      ),
      width: '150px',
    },
    {
      key: 'cuenta_corriente',
      header: renderSortableHeader('C/C', 'cuenta_corriente'),
      render: (client: Client) => (
        <div className="flex justify-center">
          {client.tiene_cuenta_corriente ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : (
            <XIcon className="w-5 h-5 text-gray-400" />
          )}
        </div>
      ),
      width: '80px',
    },
    {
      key: 'estado',
      header: renderSortableHeader('Estado', 'estado'),
      render: (client: Client) => (
        <Badge variant={client.is_active ? 'primary' : 'default'} size="sm">
          {client.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
      width: '100px',
      showFrom: 'md',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (client: Client) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleViewDetails(client)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>

          {canEdit && client.status_aprobacion === 'pending' && (
            <>
              <button
                onClick={() => handleAprobar(client)}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Aprobar"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleRechazar(client)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Rechazar"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}

          {canEdit && (
            <>
              <button
                onClick={() => handleEdit(client)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleToggleStatus(client)}
                className={`p-2 rounded-lg transition-colors ${
                  client.is_active
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-green-600 hover:bg-green-50'
                }`}
                title={client.is_active ? 'Desactivar' : 'Activar'}
                disabled={mutationLoading}
              >
                <Power className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
      width: '200px',
    },
  ];

  return (
    <div className="space-y-4">
      <EntityKpiStrip items={kpiItems} />

      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <Users className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="font-semibold text-amber-900">
                  {pendingCount} {pendingCount === 1 ? 'cliente pendiente' : 'clientes pendientes'} de aprobación
                </p>
                <p className="text-sm text-amber-700">Revisa y aprueba los nuevos registros</p>
              </div>
            </div>
            <div className="sm:ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusAprobacionFilter('pending');
                  setCurrentPage(1);
                }}
                className="border-amber-400 text-amber-700 hover:bg-amber-100"
              >
                Ver pendientes
              </Button>
            </div>
          </div>
        </div>
      )}

      <EntityToolbar
        primaryControls={
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
            <SearchInput
              value={searchTerm}
              onChange={(value) => {
                setSearchTerm(value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por nombre, razón social, documento o teléfono..."
            />
            <Select
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              options={[
                { value: 'all', label: 'Todos los estados' },
                { value: 'active', label: 'Solo activos' },
                { value: 'inactive', label: 'Solo inactivos' },
              ]}
            />
          </div>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAutoRegistroLink}
              className="border-slate-300 bg-slate-50 hover:border-slate-400"
            >
              {copiedLink ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  Link copiado
                </>
              ) : (
                <>
                  <LinkIcon className="h-4 w-4 text-slate-600" />
                  Link autoregistro
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadQR}
              disabled={downloadingQR}
              className="border-slate-300 bg-slate-50 hover:border-slate-400"
            >
              {downloadingQR ? (
                <>
                  <Download className="h-4 w-4 animate-pulse text-slate-600" />
                  Generando...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 text-slate-600" />
                  Descargar QR
                </>
              )}
            </Button>
          </>
        }
      />

      <AdvancedFiltersPanel
        storageKey="clients-filters-collapsed"
        activeFiltersCount={activeAdvancedFiltersCount}
        onReset={resetAdvancedFilters}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            value={statusAprobacionFilter}
            onChange={(value) => {
              setStatusAprobacionFilter(value);
              setCurrentPage(1);
            }}
            options={[
              { value: 'all', label: 'Aprobación: todas' },
              { value: 'pending', label: 'Pendientes' },
              { value: 'approved', label: 'Aprobados' },
              { value: 'rejected', label: 'Rechazados' },
            ]}
          />
          <Select
            value={cuentaCorrienteFilter}
            onChange={(value) => {
              setCuentaCorrienteFilter(value);
              setCurrentPage(1);
            }}
            options={[
              { value: 'all', label: 'Cuenta corriente: todas' },
              { value: 'yes', label: 'Con cuenta corriente' },
              { value: 'no', label: 'Sin cuenta corriente' },
            ]}
          />
          <Select
            value={riesgoComercialFilter}
            onChange={(value) => {
              setRiesgoComercialFilter(value);
              setCurrentPage(1);
            }}
            options={[
              { value: 'all', label: 'Riesgo: todos' },
              { value: 'alto', label: 'Riesgo alto' },
              { value: 'medio', label: 'Riesgo medio' },
              { value: 'bajo', label: 'Riesgo bajo' },
            ]}
          />
          <Select
            value={sinCompraFilter}
            onChange={(value) => {
              setSinCompraFilter(value);
              setCurrentPage(1);
            }}
            options={[
              { value: 'all', label: 'Recencia: todas' },
              { value: 'gt_60', label: 'Sin compra > 60 días' },
            ]}
          />
            <Select
              value={sortBy}
              onChange={(value) => {
                applySortByPreset(value as SortByOption);
                setCurrentPage(1);
              }}
            options={[
              { value: 'created_at_desc', label: 'Orden: más recientes' },
              { value: 'ltv_desc', label: 'Orden: mayor LTV' },
              { value: 'recency_desc', label: 'Orden: más días sin compra' },
              { value: 'frequency_90d_desc', label: 'Orden: más órdenes (90d)' },
              { value: 'ticket_promedio_desc', label: 'Orden: mayor ticket promedio' },
              { value: 'name_asc', label: 'Orden: nombre A-Z' },
            ]}
          />
        </div>
      </AdvancedFiltersPanel>

      <Card className="border-slate-200 shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
          Mostrando <span className="font-semibold text-slate-800">{clients.length}</span> de{' '}
          <span className="font-semibold text-slate-800">{totalCount}</span> clientes
        </div>
        <Table
          columns={columns}
          data={clients}
          keyExtractor={(client) => client.id}
          emptyMessage="No se encontraron clientes"
          isLoading={loading}
          compact
        />
        {totalCount > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
            }}
          />
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}
        size="lg"
      >
        <ClientForm
          client={selectedClient || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <DetalleClienteModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        cliente={selectedClient}
      />

      {selectedClient && (
        <>
          <AprobarClienteModal
            isOpen={isAprobarModalOpen}
            onClose={() => setIsAprobarModalOpen(false)}
            cliente={selectedClient}
            onSuccess={handleAprobacionSuccess}
          />

          <RechazarClienteModal
            isOpen={isRechazarModalOpen}
            onClose={() => setIsRechazarModalOpen(false)}
            cliente={selectedClient}
            onSuccess={handleAprobacionSuccess}
          />
        </>
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
