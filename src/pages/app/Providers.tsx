import { useState, useMemo, useCallback } from 'react';
import { Truck, Plus, Edit2, Power, CreditCard, FileText, Banknote, MoreHorizontal, Search, Filter } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/Button';
import { usePageHeader } from '../../hooks/usePageHeader';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { ProviderForm } from '../../components/providers/ProviderForm';
import { useProviders } from '../../hooks/useProviders';
import { useProvider } from '../../hooks/useProvider';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import type { Provider, ProviderFormData } from '../../types/database';

export function Providers() {
  const { profile } = useAuth();
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager'].includes(profile.role);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const handleOpenCreateForm = useCallback(() => {
    setSelectedProvider(null);
    setShowForm(true);
  }, []);

  const headerAction = useMemo(
    () =>
      canEdit ? (
        <Button variant="primary" onClick={handleOpenCreateForm}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Proveedor
        </Button>
      ) : undefined,
    [canEdit, handleOpenCreateForm]
  );

  usePageHeader('Administra tus proveedores de materiales e insumos', headerAction);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const { providers, loading, error, totalCount, totalPages, refetch } = useProviders({
    searchTerm: debouncedSearch,
    isActive: statusFilter === 'all' ? null : statusFilter === 'active',
    page,
    pageSize,
  });

  const { createProvider, updateProvider, toggleProviderStatus, loading: formLoading } = useProvider();

  const handleCreate = () => {
    setSelectedProvider(null);
    setShowForm(true);
  };

  const handleEdit = (provider: Provider) => {
    setSelectedProvider(provider);
    setShowForm(true);
  };

  const handleViewDetails = (provider: Provider) => {
    setSelectedProvider(provider);
    setShowDetails(true);
  };

  const handleSubmit = async (formData: ProviderFormData) => {
    let success = false;

    if (selectedProvider) {
      const result = await updateProvider(selectedProvider.id, formData);
      success = !!result;
    } else {
      const result = await createProvider(formData);
      success = !!result;
    }

    if (success) {
      setShowForm(false);
      setSelectedProvider(null);
      refetch();
    }
  };

  const handleToggleStatus = async (provider: Provider) => {
    const success = await toggleProviderStatus(provider.id, provider.is_active);
    if (success) {
      refetch();
    }
  };

  const getPaymentMethods = (provider: Provider) => {
    const methods = [];
    if (provider.acepta_transferencias) methods.push('Transferencias');
    if (provider.acepta_cheques) methods.push('Cheques');
    if (provider.acepta_tarjetas_credito) methods.push('Tarjetas');
    if (provider.acepta_otros) methods.push('Otros');
    return methods;
  };

  const columns = [
    {
      key: 'nombre_fantasia',
      label: 'Nombre de Fantasía',
      render: (provider: Provider) => (
        <div>
          <div className="font-medium text-slate-900">{provider.nombre_fantasia}</div>
          <div className="text-sm text-slate-500">{provider.razon_social}</div>
        </div>
      ),
    },
    {
      key: 'documento',
      label: 'Documento',
      render: (provider: Provider) => (
        <div className="text-sm">
          <div className="font-medium text-slate-700">{provider.tipo_documento}</div>
          <div className="text-slate-500">{provider.numero_documento}</div>
        </div>
      ),
    },
    {
      key: 'formas_pago',
      label: 'Formas de Pago',
      render: (provider: Provider) => {
        const methods = getPaymentMethods(provider);
        return (
          <div className="flex flex-wrap gap-1">
            {methods.length > 0 ? (
              methods.slice(0, 2).map((method) => (
                <Badge key={method} variant="info" size="sm">
                  {method}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-slate-400">Sin especificar</span>
            )}
            {methods.length > 2 && (
              <Badge variant="secondary" size="sm">
                +{methods.length - 2}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Estado',
      render: (provider: Provider) => (
        <Badge variant={provider.is_active ? 'success' : 'secondary'}>
          {provider.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (provider: Provider) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewDetails(provider)}
            title="Ver detalles"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(provider)}
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleToggleStatus(provider)}
                title={provider.is_active ? 'Desactivar' : 'Activar'}
              >
                <Power className={`w-4 h-4 ${provider.is_active ? 'text-red-500' : 'text-green-500'}`} />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                onChange={setSearchTerm}
                placeholder="Buscar por nombre, razón social o documento..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
              <Select
                label="Estado"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as typeof statusFilter)}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'active', label: 'Activos' },
                  { value: 'inactive', label: 'Inactivos' },
                ]}
              />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : providers.length === 0 ? (
            <EmptyState
              icon={Truck}
              title={searchTerm ? 'No se encontraron proveedores' : 'No hay proveedores registrados'}
              description={
                searchTerm
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Agrega proveedores para gestionar tu inventario y compras'
              }
              action={
                canEdit && !searchTerm ? (
                  <Button variant="primary" onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Proveedor
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="text-sm text-slate-600 px-4">
                Mostrando {providers.length} de {totalCount} proveedores
              </div>

              <Table
                columns={columns}
                data={providers}
                keyExtractor={(provider) => provider.id}
              />

              {totalPages > 1 && (
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              )}
            </>
          )}
        </div>
      </Card>

      {showForm && (
        <ProviderForm
          provider={selectedProvider}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setSelectedProvider(null);
          }}
          isLoading={formLoading}
        />
      )}

      {showDetails && selectedProvider && (
        <Modal
          isOpen={showDetails}
          onClose={() => {
            setShowDetails(false);
            setSelectedProvider(null);
          }}
          title="Detalles del Proveedor"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">
                {selectedProvider.nombre_fantasia}
              </h3>
              <Badge variant={selectedProvider.is_active ? 'success' : 'secondary'}>
                {selectedProvider.is_active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>

            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Información Fiscal</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Razón Social:</span>
                  <span className="font-medium text-slate-900">{selectedProvider.razon_social}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Documento:</span>
                  <span className="font-medium text-slate-900">
                    {selectedProvider.tipo_documento} {selectedProvider.numero_documento}
                  </span>
                </div>
              </div>
            </div>

            {(selectedProvider.whatsapp || selectedProvider.email) && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Contacto</h4>
                <div className="space-y-2 text-sm">
                  {selectedProvider.whatsapp && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">WhatsApp:</span>
                      <span className="font-medium text-slate-900">{selectedProvider.whatsapp}</span>
                    </div>
                  )}
                  {selectedProvider.email && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-medium text-slate-900">{selectedProvider.email}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedProvider.domicilio && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Ubicación</h4>
                <div className="text-sm text-slate-600">
                  {selectedProvider.domicilio}
                  {selectedProvider.codigo_postal && ` - CP: ${selectedProvider.codigo_postal}`}
                </div>
              </div>
            )}

            {selectedProvider.banco && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Datos Bancarios</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Banco:</span>
                    <span className="font-medium text-slate-900">{selectedProvider.banco}</span>
                  </div>
                  {selectedProvider.tipo_cuenta && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tipo de Cuenta:</span>
                      <span className="font-medium text-slate-900">{selectedProvider.tipo_cuenta}</span>
                    </div>
                  )}
                  {selectedProvider.tipo_identificador_bancario && selectedProvider.identificador_bancario && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">{selectedProvider.tipo_identificador_bancario}:</span>
                      <span className="font-medium text-slate-900">{selectedProvider.identificador_bancario}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Formas de Pago Aceptadas</h4>
              <div className="flex flex-wrap gap-2">
                {selectedProvider.acepta_transferencias && (
                  <Badge variant="info">
                    <Banknote className="w-3 h-3 mr-1" />
                    Transferencias
                  </Badge>
                )}
                {selectedProvider.acepta_cheques && (
                  <Badge variant="info">
                    <FileText className="w-3 h-3 mr-1" />
                    Cheques
                  </Badge>
                )}
                {selectedProvider.acepta_tarjetas_credito && (
                  <Badge variant="info">
                    <CreditCard className="w-3 h-3 mr-1" />
                    Tarjetas
                  </Badge>
                )}
                {selectedProvider.acepta_otros && (
                  <Badge variant="info">
                    <MoreHorizontal className="w-3 h-3 mr-1" />
                    Otros
                  </Badge>
                )}
                {!selectedProvider.acepta_transferencias &&
                  !selectedProvider.acepta_cheques &&
                  !selectedProvider.acepta_tarjetas_credito &&
                  !selectedProvider.acepta_otros && (
                    <span className="text-sm text-slate-400">Sin especificar</span>
                  )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
              {canEdit && (
                <Button variant="primary" onClick={() => {
                  setShowDetails(false);
                  handleEdit(selectedProvider);
                }}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}
              <Button variant="outline" onClick={() => {
                setShowDetails(false);
                setSelectedProvider(null);
              }}>
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
