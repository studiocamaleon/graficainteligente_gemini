import { useState, useMemo, useCallback } from 'react';
import { Plus, Edit2, Power, Eye, Trash2, Globe, Building2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { SearchInput } from '../../../components/ui/SearchInput';
import { Select } from '../../../components/ui/Select';
import { Table } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { CollapsibleFilters } from '../../../components/ui/CollapsibleFilters';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useAuth } from '../../../hooks/useAuth';
import { useDebounce } from '../../../hooks/useDebounce';
import { useCountries, useCountry } from '../../../hooks/useCountries';
import { useProvinces, useProvince } from '../../../hooks/useProvinces';
import { useCities, useCity } from '../../../hooks/useCities';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { CountryForm } from '../../../components/locations/CountryForm';
import { ProvinceForm } from '../../../components/locations/ProvinceForm';
import { CityForm } from '../../../components/locations/CityForm';
import type { Country, Province, City, CountryFormData, ProvinceFormData, CityFormData } from '../../../types/database';

type TabType = 'countries' | 'provinces' | 'cities';

export function Locations() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const canEdit = profile?.role && ['super_admin', 'admin', 'manager'].includes(profile.role);

  const [activeTab, setActiveTab] = useState<TabType>('countries');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  const [provinceCountryFilter, setProvinceCountryFilter] = useState<string>('');
  const [cityProvinceFilter, setCityProvinceFilter] = useState<string>('');

  const debouncedSearch = useDebounce(searchTerm, 300);
  const isActiveFilter = statusFilter === 'all' ? null : statusFilter === 'active';

  const { countries, totalCount: countriesTotal, loading: loadingCountries, refetch: refetchCountries } = useCountries({
    searchTerm: debouncedSearch,
    isActive: isActiveFilter,
    page: currentPage,
    itemsPerPage,
  });

  const { provinces, totalCount: provincesTotal, loading: loadingProvinces, refetch: refetchProvinces } = useProvinces({
    countryId: provinceCountryFilter || undefined,
    searchTerm: debouncedSearch,
    isActive: isActiveFilter,
    page: currentPage,
    itemsPerPage,
  });

  const { cities, totalCount: citiesTotal, loading: loadingCities, refetch: refetchCities } = useCities({
    provinceId: cityProvinceFilter || undefined,
    searchTerm: debouncedSearch,
    isActive: isActiveFilter,
    page: currentPage,
    itemsPerPage,
  });

  const { createCountry, updateCountry, toggleCountryStatus, deleteCountry, loading: mutationLoadingCountry } = useCountry();
  const { createProvince, updateProvince, toggleProvinceStatus, deleteProvince, loading: mutationLoadingProvince } = useProvince();
  const { createCity, updateCity, toggleCityStatus, deleteCity, loading: mutationLoadingCity } = useCity();
  const {
    dialogState,
    isLoading: isConfirmLoading,
    closeDialog,
    handleConfirm,
    confirmDelete,
    confirmAction,
  } = useConfirmDialog();

  const handleOpenCreateModal = useCallback(() => {
    setSelectedCountry(null);
    setSelectedProvince(null);
    setSelectedCity(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const headerAction = useMemo(
    () =>
      canEdit ? (
        <Button variant="primary" onClick={handleOpenCreateModal}>
          <Plus className="w-5 h-5" />
          {activeTab === 'countries' ? 'Crear País' : activeTab === 'provinces' ? 'Crear Provincia' : 'Crear Ciudad'}
        </Button>
      ) : undefined,
    [canEdit, activeTab, handleOpenCreateModal]
  );

  usePageHeader('Gestión de países, provincias y ciudades', headerAction);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchTerm('');
    setStatusFilter('all');
    setCurrentPage(1);
    setProvinceCountryFilter('');
    setCityProvinceFilter('');
  };

  const handleEditCountry = (country: Country) => {
    if (!canEdit || country.is_global) return;
    setSelectedCountry(country);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleEditProvince = (province: Province) => {
    if (!canEdit || province.is_global) return;
    setSelectedProvince(province);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleEditCity = (city: City) => {
    if (!canEdit || city.is_global) return;
    setSelectedCity(city);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleViewCountryDetails = (country: Country) => {
    setSelectedCountry(country);
    setIsDetailModalOpen(true);
  };

  const handleViewProvinceDetails = (province: Province) => {
    setSelectedProvince(province);
    setIsDetailModalOpen(true);
  };

  const handleViewCityDetails = (city: City) => {
    setSelectedCity(city);
    setIsDetailModalOpen(true);
  };

  const handleToggleCountryStatus = async (country: Country) => {
    if (!canEdit || (country.is_global && !isSuperAdmin)) return;

    const action = country.is_active ? 'desactivar' : 'activar';
    confirmAction({
      title: `Confirmar ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: `¿Está seguro que desea ${action} el país "${country.name}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: country.is_active ? 'warning' : 'info',
      onConfirm: async () => {
        const success = await toggleCountryStatus(country.id, country.is_active);
        if (success) {
          refetchCountries();
        }
      },
    });
  };

  const handleToggleProvinceStatus = async (province: Province) => {
    if (!canEdit || (province.is_global && !isSuperAdmin)) return;

    const action = province.is_active ? 'desactivar' : 'activar';
    confirmAction({
      title: `Confirmar ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: `¿Está seguro que desea ${action} la provincia "${province.name}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: province.is_active ? 'warning' : 'info',
      onConfirm: async () => {
        const success = await toggleProvinceStatus(province.id, province.is_active);
        if (success) {
          refetchProvinces();
        }
      },
    });
  };

  const handleToggleCityStatus = async (city: City) => {
    if (!canEdit || (city.is_global && !isSuperAdmin)) return;

    const action = city.is_active ? 'desactivar' : 'activar';
    confirmAction({
      title: `Confirmar ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: `¿Está seguro que desea ${action} la ciudad "${city.name}"?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: city.is_active ? 'warning' : 'info',
      onConfirm: async () => {
        const success = await toggleCityStatus(city.id, city.is_active);
        if (success) {
          refetchCities();
        }
      },
    });
  };

  const handleDeleteCountry = async (country: Country) => {
    if (!canEdit || country.is_global) return;

    confirmDelete(country.name, async () => {
      const success = await deleteCountry(country.id);
      if (success) {
        refetchCountries();
      }
    });
  };

  const handleDeleteProvince = async (province: Province) => {
    if (!canEdit || province.is_global) return;

    confirmDelete(province.name, async () => {
      const success = await deleteProvince(province.id);
      if (success) {
        refetchProvinces();
      }
    });
  };

  const handleDeleteCity = async (city: City) => {
    if (!canEdit || city.is_global) return;

    confirmDelete(city.name, async () => {
      const success = await deleteCity(city.id);
      if (success) {
        refetchCities();
      }
    });
  };

  const handleSubmitCountry = async (data: CountryFormData) => {
    try {
      if (modalMode === 'create') {
        const newCountry = await createCountry(data);
        if (newCountry) {
          setIsModalOpen(false);
          refetchCountries();
        }
      } else if (selectedCountry) {
        const updated = await updateCountry(selectedCountry.id, data);
        if (updated) {
          setIsModalOpen(false);
          refetchCountries();
        }
      }
    } catch (error) {
      console.error('Error submitting country:', error);
    }
  };

  const handleSubmitProvince = async (data: ProvinceFormData) => {
    try {
      if (modalMode === 'create') {
        const newProvince = await createProvince(data);
        if (newProvince) {
          setIsModalOpen(false);
          refetchProvinces();
        }
      } else if (selectedProvince) {
        const updated = await updateProvince(selectedProvince.id, data);
        if (updated) {
          setIsModalOpen(false);
          refetchProvinces();
        }
      }
    } catch (error) {
      console.error('Error submitting province:', error);
    }
  };

  const handleSubmitCity = async (data: CityFormData) => {
    try {
      if (modalMode === 'create') {
        const newCity = await createCity(data);
        if (newCity) {
          setIsModalOpen(false);
          refetchCities();
        }
      } else if (selectedCity) {
        const updated = await updateCity(selectedCity.id, data);
        if (updated) {
          setIsModalOpen(false);
          refetchCities();
        }
      }
    } catch (error) {
      console.error('Error submitting city:', error);
    }
  };

  const countryColumns = [
    {
      key: 'name',
      header: 'Nombre',
      render: (country: Country) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{country.name}</span>
          {country.is_global ? (
            <Badge variant="secondary" size="sm">
              <Globe className="w-3 h-3 mr-1" />
              Global
            </Badge>
          ) : (
            <Badge variant="primary" size="sm">
              <Building2 className="w-3 h-3 mr-1" />
              Compañía
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'iso_code',
      header: 'Código ISO',
      render: (country: Country) => (
        <span className="text-sm text-gray-600 font-mono">{country.iso_code}</span>
      ),
      width: '100px',
    },
    {
      key: 'phone_code',
      header: 'Código Telefónico',
      render: (country: Country) => (
        <span className="text-sm text-gray-600 font-mono">{country.phone_code}</span>
      ),
      width: '150px',
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (country: Country) => (
        <Badge variant={country.is_active ? 'primary' : 'secondary'} size="sm">
          {country.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
      width: '100px',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (country: Country) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewCountryDetails(country)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>

          {canEdit && !country.is_global && (
            <>
              <button
                onClick={() => handleEditCountry(country)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleToggleCountryStatus(country)}
                className={`p-2 rounded-lg transition-colors ${
                  country.is_active
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-green-600 hover:bg-green-50'
                }`}
                title={country.is_active ? 'Desactivar' : 'Activar'}
                disabled={mutationLoadingCountry}
              >
                <Power className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleDeleteCountry(country)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar"
                disabled={mutationLoadingCountry}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          {country.is_global && !isSuperAdmin && (
            <span className="text-xs text-gray-500 italic" title="Esta ubicación es global y no puede modificarse">
              No editable
            </span>
          )}
        </div>
      ),
      width: '180px',
    },
  ];

  const provinceColumns = [
    {
      key: 'name',
      header: 'Nombre',
      render: (province: Province) => {
        const country = countries.find((c) => c.id === province.country_id);
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{province.name}</span>
              {province.is_global ? (
                <Badge variant="secondary" size="sm">
                  <Globe className="w-3 h-3 mr-1" />
                  Global
                </Badge>
              ) : (
                <Badge variant="primary" size="sm">
                  <Building2 className="w-3 h-3 mr-1" />
                  Compañía
                </Badge>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{country?.name || '-'}</div>
          </div>
        );
      },
    },
    {
      key: 'code',
      header: 'Código',
      render: (province: Province) => (
        <span className="text-sm text-gray-600 font-mono">{province.code || '-'}</span>
      ),
      width: '100px',
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (province: Province) => (
        <Badge variant={province.is_active ? 'primary' : 'secondary'} size="sm">
          {province.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
      width: '100px',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (province: Province) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewProvinceDetails(province)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>

          {canEdit && !province.is_global && (
            <>
              <button
                onClick={() => handleEditProvince(province)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleToggleProvinceStatus(province)}
                className={`p-2 rounded-lg transition-colors ${
                  province.is_active
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-green-600 hover:bg-green-50'
                }`}
                title={province.is_active ? 'Desactivar' : 'Activar'}
                disabled={mutationLoadingProvince}
              >
                <Power className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleDeleteProvince(province)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar"
                disabled={mutationLoadingProvince}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          {province.is_global && !isSuperAdmin && (
            <span className="text-xs text-gray-500 italic" title="Esta ubicación es global y no puede modificarse">
              No editable
            </span>
          )}
        </div>
      ),
      width: '180px',
    },
  ];

  const cityColumns = [
    {
      key: 'name',
      header: 'Nombre',
      render: (city: City) => {
        const province = provinces.find((p) => p.id === city.province_id);
        const country = countries.find((c) => c.id === province?.country_id);
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{city.name}</span>
              {city.is_global ? (
                <Badge variant="secondary" size="sm">
                  <Globe className="w-3 h-3 mr-1" />
                  Global
                </Badge>
              ) : (
                <Badge variant="primary" size="sm">
                  <Building2 className="w-3 h-3 mr-1" />
                  Compañía
                </Badge>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {province?.name || '-'}, {country?.name || '-'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'postal_code',
      header: 'Código Postal',
      render: (city: City) => (
        <span className="text-sm text-gray-600 font-mono">{city.postal_code || '-'}</span>
      ),
      width: '120px',
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (city: City) => (
        <Badge variant={city.is_active ? 'primary' : 'secondary'} size="sm">
          {city.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
      width: '100px',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      render: (city: City) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewCityDetails(city)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>

          {canEdit && !city.is_global && (
            <>
              <button
                onClick={() => handleEditCity(city)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleToggleCityStatus(city)}
                className={`p-2 rounded-lg transition-colors ${
                  city.is_active
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-green-600 hover:bg-green-50'
                }`}
                title={city.is_active ? 'Desactivar' : 'Activar'}
                disabled={mutationLoadingCity}
              >
                <Power className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleDeleteCity(city)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar"
                disabled={mutationLoadingCity}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          {city.is_global && !isSuperAdmin && (
            <span className="text-xs text-gray-500 italic" title="Esta ubicación es global y no puede modificarse">
              No editable
            </span>
          )}
        </div>
      ),
      width: '180px',
    },
  ];

  const currentData = activeTab === 'countries' ? countries : activeTab === 'provinces' ? provinces : cities;
  const currentColumns = activeTab === 'countries' ? countryColumns : activeTab === 'provinces' ? provinceColumns : cityColumns;
  const currentTotal = activeTab === 'countries' ? countriesTotal : activeTab === 'provinces' ? provincesTotal : citiesTotal;
  const currentLoading = activeTab === 'countries' ? loadingCountries : activeTab === 'provinces' ? loadingProvinces : loadingCities;

  const totalPages = Math.ceil(currentTotal / itemsPerPage);

  const activeFiltersCount = [
    searchTerm,
    statusFilter !== 'all',
    provinceCountryFilter && activeTab === 'provinces',
    cityProvinceFilter && activeTab === 'cities',
  ].filter(Boolean).length;

  return (
    <div>
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => handleTabChange('countries')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'countries'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Países
          </button>
          <button
            onClick={() => handleTabChange('provinces')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'provinces'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Provincias
          </button>
          <button
            onClick={() => handleTabChange('cities')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'cities'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Ciudades
          </button>
        </div>
      </div>

      <Card padding="none">
        <div className="p-6 border-b border-gray-200 space-y-4">
          <CollapsibleFilters storageKey={`locations-${activeTab}-filters`} activeFiltersCount={activeFiltersCount}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeTab === 'provinces' && (
                <Select
                  value={provinceCountryFilter}
                  onChange={(value) => {
                    setProvinceCountryFilter(value);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: '', label: 'Todos los países' },
                    ...countries.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}

              {activeTab === 'cities' && (
                <Select
                  value={cityProvinceFilter}
                  onChange={(value) => {
                    setCityProvinceFilter(value);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: '', label: 'Todas las provincias' },
                    ...provinces.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              )}

              <div className={activeTab === 'countries' ? 'md:col-span-2' : ''}>
                <SearchInput
                  onChange={(value) => {
                    setSearchTerm(value);
                    setCurrentPage(1);
                  }}
                  placeholder="Buscar por nombre..."
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
          </CollapsibleFilters>

          <div className="text-sm text-gray-600">
            Total: <span className="font-semibold">{currentTotal}</span>{' '}
            {activeTab === 'countries' ? 'países' : activeTab === 'provinces' ? 'provincias' : 'ciudades'}
          </div>
        </div>

        <Table
          columns={currentColumns}
          data={currentData}
          keyExtractor={(item) => item.id}
          emptyMessage={`No se encontraron ${
            activeTab === 'countries' ? 'países' : activeTab === 'provinces' ? 'provincias' : 'ciudades'
          }`}
          isLoading={currentLoading}
          dense
        />

        {currentTotal > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={currentTotal}
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
        title={
          modalMode === 'create'
            ? activeTab === 'countries' ? 'Crear País' : activeTab === 'provinces' ? 'Crear Provincia' : 'Crear Ciudad'
            : activeTab === 'countries' ? 'Editar País' : activeTab === 'provinces' ? 'Editar Provincia' : 'Editar Ciudad'
        }
        size="md"
      >
        {activeTab === 'countries' && (
          <CountryForm
            country={selectedCountry || undefined}
            onSubmit={handleSubmitCountry}
            onCancel={() => setIsModalOpen(false)}
          />
        )}
        {activeTab === 'provinces' && (
          <ProvinceForm
            province={selectedProvince || undefined}
            onSubmit={handleSubmitProvince}
            onCancel={() => setIsModalOpen(false)}
          />
        )}
        {activeTab === 'cities' && (
          <CityForm
            city={selectedCity || undefined}
            onSubmit={handleSubmitCity}
            onCancel={() => setIsModalOpen(false)}
          />
        )}
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Detalles de ${activeTab === 'countries' ? 'País' : activeTab === 'provinces' ? 'Provincia' : 'Ciudad'}`}
        size="md"
      >
        {activeTab === 'countries' && selectedCountry && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Información General</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-lg">{selectedCountry.name}</p>
                    {selectedCountry.is_global ? (
                      <Badge variant="secondary">
                        <Globe className="w-3 h-3 mr-1" />
                        Global
                      </Badge>
                    ) : (
                      <Badge variant="primary">
                        <Building2 className="w-3 h-3 mr-1" />
                        Compañía
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Código ISO</p>
                  <p className="font-medium font-mono">{selectedCountry.iso_code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Código Telefónico</p>
                  <p className="font-medium font-mono">{selectedCountry.phone_code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <Badge variant={selectedCountry.is_active ? 'primary' : 'secondary'}>
                    {selectedCountry.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Fechas</h3>
              <div>
                <p className="text-sm text-gray-500">Creado el</p>
                <p className="font-medium">
                  {new Date(selectedCountry.created_at).toLocaleDateString('es-AR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'provinces' && selectedProvince && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Información General</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-lg">{selectedProvince.name}</p>
                    {selectedProvince.is_global ? (
                      <Badge variant="secondary">
                        <Globe className="w-3 h-3 mr-1" />
                        Global
                      </Badge>
                    ) : (
                      <Badge variant="primary">
                        <Building2 className="w-3 h-3 mr-1" />
                        Compañía
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">País</p>
                  <p className="font-medium">
                    {countries.find((c) => c.id === selectedProvince.country_id)?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Código</p>
                  <p className="font-medium font-mono">{selectedProvince.code || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <Badge variant={selectedProvince.is_active ? 'primary' : 'secondary'}>
                    {selectedProvince.is_active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Fechas</h3>
              <div>
                <p className="text-sm text-gray-500">Creada el</p>
                <p className="font-medium">
                  {new Date(selectedProvince.created_at).toLocaleDateString('es-AR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cities' && selectedCity && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Información General</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-lg">{selectedCity.name}</p>
                    {selectedCity.is_global ? (
                      <Badge variant="secondary">
                        <Globe className="w-3 h-3 mr-1" />
                        Global
                      </Badge>
                    ) : (
                      <Badge variant="primary">
                        <Building2 className="w-3 h-3 mr-1" />
                        Compañía
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Provincia</p>
                  <p className="font-medium">
                    {provinces.find((p) => p.id === selectedCity.province_id)?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">País</p>
                  <p className="font-medium">
                    {countries.find((c) => c.id === provinces.find((p) => p.id === selectedCity.province_id)?.country_id)?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Código Postal</p>
                  <p className="font-medium font-mono">{selectedCity.postal_code || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <Badge variant={selectedCity.is_active ? 'primary' : 'secondary'}>
                    {selectedCity.is_active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Fechas</h3>
              <div>
                <p className="text-sm text-gray-500">Creada el</p>
                <p className="font-medium">
                  {new Date(selectedCity.created_at).toLocaleDateString('es-AR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
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
