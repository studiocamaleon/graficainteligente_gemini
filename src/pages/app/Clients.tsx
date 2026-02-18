import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Plus, Eye, Edit2, Power, Check, X as XIcon, CheckCircle2, XCircle, Link as LinkIcon, Copy, QrCode, Download } from 'lucide-react';
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

export function Clients() {
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
  const [sortBy, setSortBy] = useState<
    'created_at_desc' | 'ltv_desc' | 'name_asc' | 'recency_desc' | 'frequency_90d_desc' | 'ticket_promedio_desc'
  >('created_at_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAprobarModalOpen, setIsAprobarModalOpen] = useState(false);
  const [isRechazarModalOpen, setIsRechazarModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
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

  const handleCreate = () => {
    setSelectedClient(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleViewDetails = (client: Client) => {
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
      header: 'Nombre de Fantasía',
      render: (client: Client) => (
        <div className="font-medium text-gray-900">{client.nombre_fantasia}</div>
      ),
    },
    {
      key: 'razon_social',
      header: 'Razón Social',
      render: (client: Client) => (
        <div className="text-sm text-gray-600">{client.razon_social}</div>
      ),
    },
    {
      key: 'ltv_total',
      header: 'LTV',
      render: (client: ClientWithCommercialMetrics) => (
        <div className="text-sm font-semibold text-emerald-700">
          ${Number(client.ltv_total || 0).toLocaleString('es-AR')}
        </div>
      ),
      width: '140px',
    },
    {
      key: 'recencia',
      header: 'Recencia',
      render: (client: ClientWithCommercialMetrics) => (
        <div className="text-sm text-gray-700">
          {client.dias_sin_comprar === null ? 'Sin compras' : `${client.dias_sin_comprar} días`}
        </div>
      ),
      width: '120px',
    },
    {
      key: 'ordenes_90d',
      header: 'Órdenes 90d',
      render: (client: ClientWithCommercialMetrics) => (
        <div className="text-sm font-medium text-blue-700">{client.ordenes_90d || 0}</div>
      ),
      width: '110px',
    },
    {
      key: 'ticket_promedio',
      header: 'Ticket Prom.',
      render: (client: ClientWithCommercialMetrics) => (
        <div className="text-sm text-gray-700">
          ${Number(client.ticket_promedio || 0).toLocaleString('es-AR')}
        </div>
      ),
      width: '130px',
    },
    {
      key: 'canal_preferido',
      header: 'Canal',
      render: (client: ClientWithCommercialMetrics) => (
        <div className="text-sm text-gray-700">{client.canal_preferido || '-'}</div>
      ),
      width: '140px',
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
    },
    {
      key: 'riesgo_comercial',
      header: 'Riesgo',
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
      header: 'CUIT/DNI',
      render: (client: Client) => (
        <div className="text-sm">
          <span className="text-gray-500">{client.tipo_documento}:</span>{' '}
          <span className="font-mono text-gray-900">{client.numero_documento}</span>
        </div>
      ),
    },
    {
      key: 'status_aprobacion',
      header: 'Estado Registro',
      render: (client: Client) => (
        <ClienteStatusBadge status={client.status_aprobacion || 'approved'} />
      ),
      width: '150px',
    },
    {
      key: 'cuenta_corriente',
      header: 'C/C',
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
      header: 'Estado',
      render: (client: Client) => (
        <Badge variant={client.is_active ? 'primary' : 'secondary'} size="sm">
          {client.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
      width: '100px',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (client: Client) => (
        <div className="flex items-center gap-2">
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
    <div>
      <Card padding="none">
        <div className="p-6 border-b border-gray-200 space-y-4">
          {pendingCount > 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 flex items-center gap-3">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <Users className="h-5 w-5 text-yellow-700" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-yellow-900">
                  {pendingCount} {pendingCount === 1 ? 'cliente pendiente' : 'clientes pendientes'} de aprobación
                </p>
                <p className="text-sm text-yellow-700">
                  Revisa y aprueba los nuevos registros
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusAprobacionFilter('pending')}
                className="border-yellow-400 text-yellow-700 hover:bg-yellow-100"
              >
                Ver pendientes
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <SearchInput
                onChange={setSearchTerm}
                placeholder="Buscar por nombre, razón social o documento..."
              />
            </div>

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

          <div className="flex flex-wrap items-center gap-4">
            <Select
              value={statusAprobacionFilter}
              onChange={(value) => {
                setStatusAprobacionFilter(value);
                setCurrentPage(1);
              }}
              options={[
                { value: 'all', label: 'Todas las aprobaciones' },
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
                { value: 'all', label: 'Todas las cuentas' },
                { value: 'yes', label: 'Con cuenta corriente' },
                { value: 'no', label: 'Sin cuenta corriente' },
              ]}
            />

            <Select
              value={sortBy}
              onChange={(value) => {
                setSortBy(value as 'created_at_desc' | 'ltv_desc' | 'name_asc' | 'recency_desc' | 'frequency_90d_desc' | 'ticket_promedio_desc');
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

            <div className="text-sm text-gray-600">
              Total: <span className="font-semibold">{totalCount}</span> clientes
            </div>

            <div className="text-sm text-gray-600">
              LTV Promedio: <span className="font-semibold text-emerald-700">${avgLtv.toLocaleString('es-AR')}</span>
            </div>

            <div className="text-sm text-gray-600">
              Total Vendido: <span className="font-semibold text-emerald-700">${totalLtv.toLocaleString('es-AR')}</span>
            </div>

            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAutoRegistroLink}
                className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300 hover:border-blue-400"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-600" />
                    <span className="text-green-700">Link copiado</span>
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4 mr-2 text-blue-600" />
                    <span className="text-blue-700">Link Autoregistro</span>
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadQR}
                disabled={downloadingQR}
                className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-300 hover:border-violet-400"
              >
                {downloadingQR ? (
                  <>
                    <Download className="w-4 h-4 mr-2 text-violet-600 animate-pulse" />
                    <span className="text-violet-700">Generando...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2 text-violet-600" />
                    <span className="text-violet-700">Descargar QR</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <Table
          columns={columns}
          data={clients}
          keyExtractor={(client) => client.id}
          emptyMessage="No se encontraron clientes"
          isLoading={loading}
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
