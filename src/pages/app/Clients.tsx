import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Plus, Eye, Edit2, Power, Check, X as XIcon, CheckCircle2, XCircle, Link as LinkIcon, Copy } from 'lucide-react';
import { Card } from '../../components/ui/Card';
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

export function Clients() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager', 'operador_diseno'].includes(profile.role);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statusAprobacionFilter, setStatusAprobacionFilter] = useState<string>('all');
  const [cuentaCorrienteFilter, setCuentaCorrienteFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAprobarModalOpen, setIsAprobarModalOpen] = useState(false);
  const [isRechazarModalOpen, setIsRechazarModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [copiedLink, setCopiedLink] = useState(false);

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

  usePageHeader('Gestiona tus clientes y contactos', headerAction);

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

  const { clients, totalCount, loading, refetch } = useClients({
    searchTerm: debouncedSearch,
    isActive: isActiveFilter,
    hasCuentaCorriente: hasCuentaCorrienteFilter,
    statusAprobacion: statusAprobacionFilterValue,
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
    const link = `${window.location.origin}/register-client`;

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

            <div className="text-sm text-gray-600">
              Total: <span className="font-semibold">{totalCount}</span> clientes
            </div>

            <div className="ml-auto">
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
