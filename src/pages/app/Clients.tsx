import { useState, useMemo, useCallback } from 'react';
import { Users, Plus, Eye, Edit2, Power, Check, X as XIcon } from 'lucide-react';
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
import { useClients } from '../../hooks/useClients';
import { useClient } from '../../hooks/useClient';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import type { Client } from '../../types/database';

export function Clients() {
  const { profile } = useAuth();
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager'].includes(profile.role);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cuentaCorrienteFilter, setCuentaCorrienteFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

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

  const debouncedSearch = useDebounce(searchTerm, 300);

  const isActiveFilter = statusFilter === 'all' ? null : statusFilter === 'active';
  const hasCuentaCorrienteFilter = cuentaCorrienteFilter === 'all' ? null : cuentaCorrienteFilter === 'yes';

  const { clients, totalCount, loading, refetch } = useClients({
    searchTerm: debouncedSearch,
    isActive: isActiveFilter,
    hasCuentaCorriente: hasCuentaCorrienteFilter,
    page: currentPage,
    itemsPerPage,
  });

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
      width: '150px',
    },
  ];

  return (
    <div>
      <Card padding="none">
        <div className="p-6 border-b border-gray-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <SearchInput
                onChange={setSearchTerm}
                placeholder="Buscar por nombre, razón social o documento..."
              />
            </div>

            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Todos los estados' },
                { value: 'active', label: 'Solo activos' },
                { value: 'inactive', label: 'Solo inactivos' },
              ]}
            />
          </div>

          <div className="flex items-center gap-4">
            <Select
              value={cuentaCorrienteFilter}
              onChange={setCuentaCorrienteFilter}
              options={[
                { value: 'all', label: 'Todas las cuentas' },
                { value: 'yes', label: 'Con cuenta corriente' },
                { value: 'no', label: 'Sin cuenta corriente' },
              ]}
            />

            <div className="text-sm text-gray-600">
              Total: <span className="font-semibold">{totalCount}</span> clientes
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

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalles del Cliente"
        size="md"
      >
        {selectedClient && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Información Fiscal</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Nombre de Fantasía</p>
                  <p className="font-medium">{selectedClient.nombre_fantasia}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Razón Social</p>
                  <p className="font-medium">{selectedClient.razon_social}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Documento</p>
                  <p className="font-medium">
                    {selectedClient.tipo_documento}: {selectedClient.numero_documento}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <Badge variant={selectedClient.is_active ? 'primary' : 'secondary'}>
                    {selectedClient.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Contacto</h3>
              <div className="grid grid-cols-2 gap-4">
                {selectedClient.whatsapp && (
                  <div>
                    <p className="text-sm text-gray-500">WhatsApp</p>
                    <p className="font-medium">{selectedClient.whatsapp}</p>
                  </div>
                )}
                {selectedClient.email && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{selectedClient.email}</p>
                  </div>
                )}
              </div>
            </div>

            {selectedClient.domicilio && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Ubicación</h3>
                <div className="space-y-2">
                  <p className="font-medium">{selectedClient.domicilio}</p>
                  {selectedClient.codigo_postal && (
                    <p className="text-sm text-gray-600">CP: {selectedClient.codigo_postal}</p>
                  )}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Cuenta Corriente</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600">Estado:</p>
                  {selectedClient.tiene_cuenta_corriente ? (
                    <Badge variant="primary" size="sm">Habilitada</Badge>
                  ) : (
                    <Badge variant="secondary" size="sm">No tiene</Badge>
                  )}
                </div>
                {selectedClient.tiene_cuenta_corriente && selectedClient.acuerdo_pago && (
                  <div>
                    <p className="text-sm text-gray-600">Acuerdo de Pago:</p>
                    <p className="font-medium">{selectedClient.acuerdo_pago}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

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
