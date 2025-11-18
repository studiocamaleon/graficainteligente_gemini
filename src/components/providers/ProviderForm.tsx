import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import { SearchableSelect } from '../ui/SearchableSelect';
import { CreateBankModal } from './CreateBankModal';
import { useLocations } from '../../hooks/useLocations';
import { useBanks } from '../../hooks/useBanks';
import { useAuth } from '../../hooks/useAuth';
import type { Provider, ProviderFormData, DocumentType, AccountType, BankIdentifierType } from '../../types/database';

interface ProviderFormProps {
  provider?: Provider | null;
  onSubmit: (data: ProviderFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'DNI', label: 'DNI' },
  { value: 'CUIT', label: 'CUIT' },
  { value: 'CUIL', label: 'CUIL' },
];

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'Caja de Ahorro', label: 'Caja de Ahorro' },
  { value: 'Cuenta Corriente', label: 'Cuenta Corriente' },
];

const BANK_IDENTIFIER_TYPES: { value: BankIdentifierType; label: string }[] = [
  { value: 'CBU', label: 'CBU' },
  { value: 'CVU', label: 'CVU' },
  { value: 'Alias', label: 'Alias' },
];

export function ProviderForm({ provider, onSubmit, onCancel, isLoading }: ProviderFormProps) {
  const { profile } = useAuth();
  const { countries, provinces, cities, fetchProvinces, fetchCities, getArgentinaId } = useLocations();
  const { banks, loading: banksLoading, refetch: refetchBanks } = useBanks('');

  const [formData, setFormData] = useState<ProviderFormData>({
    nombre_fantasia: provider?.nombre_fantasia || '',
    razon_social: provider?.razon_social || '',
    tipo_documento: provider?.tipo_documento || 'CUIT',
    numero_documento: provider?.numero_documento || '',
    whatsapp: provider?.whatsapp || '',
    email: provider?.email || '',
    domicilio: provider?.domicilio || '',
    country_id: provider?.country_id || '',
    province_id: provider?.province_id || '',
    city_id: provider?.city_id || '',
    codigo_postal: provider?.codigo_postal || '',
    banco: provider?.banco || '',
    tipo_cuenta: provider?.tipo_cuenta || '',
    tipo_identificador_bancario: provider?.tipo_identificador_bancario || '',
    identificador_bancario: provider?.identificador_bancario || '',
    acepta_transferencias: provider?.acepta_transferencias || false,
    acepta_cheques: provider?.acepta_cheques || false,
    acepta_tarjetas_credito: provider?.acepta_tarjetas_credito || false,
    acepta_otros: provider?.acepta_otros || false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bankSearch, setBankSearch] = useState('');
  const [showCreateBankModal, setShowCreateBankModal] = useState(false);

  const isSuperAdmin = profile?.role === 'super_admin';

  const handleBankCreated = (bankName: string) => {
    setFormData({ ...formData, banco: bankName });
    refetchBanks();
  };

  useEffect(() => {
    if (countries.length > 0 && !provider && !formData.country_id) {
      const argentinaId = getArgentinaId();
      if (argentinaId) {
        setFormData(prev => ({ ...prev, country_id: argentinaId }));
      }
    }
  }, [countries, provider, formData.country_id, getArgentinaId]);

  useEffect(() => {
    if (formData.country_id) {
      fetchProvinces(formData.country_id);
    }
  }, [formData.country_id, fetchProvinces]);

  useEffect(() => {
    if (formData.province_id) {
      fetchCities(formData.province_id);
    }
  }, [formData.province_id, fetchCities]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre_fantasia.trim()) {
      newErrors.nombre_fantasia = 'El nombre de fantasía es requerido';
    }

    if (!formData.razon_social.trim()) {
      newErrors.razon_social = 'La razón social es requerida';
    }

    if (!formData.numero_documento.trim()) {
      newErrors.numero_documento = 'El número de documento es requerido';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }

    if (formData.whatsapp && !/^549\d{10}$/.test(formData.whatsapp)) {
      newErrors.whatsapp = 'El formato debe ser 549XXXXXXXXX (10 dígitos)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);
  };

  const formatWhatsApp = (value: string) => {
    const digits = value.replace(/\D/g, '');

    if (digits.startsWith('549')) {
      return digits.slice(0, 13);
    }

    if (digits.startsWith('9')) {
      return '54' + digits.slice(0, 11);
    }

    return '549' + digits.slice(0, 10);
  };

  const handleWhatsAppChange = (value: string) => {
    const formatted = formatWhatsApp(value);
    setFormData({ ...formData, whatsapp: formatted });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {provider ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div>
            <h3 className="text-lg font-medium text-slate-900 mb-4">Información Fiscal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nombre de Fantasía"
                required
                value={formData.nombre_fantasia}
                onChange={(e) => setFormData({ ...formData, nombre_fantasia: e.target.value })}
                error={errors.nombre_fantasia}
              />

              <Input
                label="Razón Social"
                required
                value={formData.razon_social}
                onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                error={errors.razon_social}
              />

              <Select
                label="Tipo de Documento"
                required
                value={formData.tipo_documento}
                onChange={(e) => setFormData({ ...formData, tipo_documento: e.target.value as DocumentType })}
                options={DOCUMENT_TYPES}
              />

              <Input
                label="Número de Documento"
                required
                value={formData.numero_documento}
                onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })}
                error={errors.numero_documento}
                placeholder="20-12345678-9"
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-slate-900 mb-4">Contacto</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="WhatsApp"
                value={formData.whatsapp}
                onChange={(e) => handleWhatsAppChange(e.target.value)}
                error={errors.whatsapp}
                placeholder="549XXXXXXXXX"
                helperText="Formato: 549 + código de área + número"
              />

              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={errors.email}
                placeholder="proveedor@ejemplo.com"
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-slate-900 mb-4">Ubicación</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Domicilio"
                  value={formData.domicilio}
                  onChange={(e) => setFormData({ ...formData, domicilio: e.target.value })}
                  placeholder="Calle y número"
                />
              </div>

              <Select
                label="País"
                value={formData.country_id}
                onChange={(value) => setFormData({
                  ...formData,
                  country_id: value,
                  province_id: '',
                  city_id: ''
                })}
                options={countries.map(c => ({ value: c.id, label: c.name }))}
                placeholder="Seleccione un país"
              />

              <Select
                label="Provincia"
                value={formData.province_id}
                onChange={(value) => setFormData({
                  ...formData,
                  province_id: value,
                  city_id: ''
                })}
                options={provinces.map(p => ({ value: p.id, label: p.name }))}
                placeholder="Seleccione una provincia"
                disabled={!formData.country_id}
              />

              <Select
                label="Ciudad"
                value={formData.city_id}
                onChange={(value) => setFormData({ ...formData, city_id: value })}
                options={cities.map(c => ({ value: c.id, label: c.name }))}
                placeholder="Seleccione una ciudad"
                disabled={!formData.province_id}
              />

              <Input
                label="Código Postal"
                value={formData.codigo_postal}
                onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
                placeholder="1234"
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-slate-900 mb-4">Datos Bancarios</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SearchableSelect
                label="Banco"
                value={formData.banco}
                onChange={(value) => setFormData({ ...formData, banco: value })}
                options={banks.map((bank) => ({ value: bank.name, label: bank.name }))}
                placeholder="Seleccionar banco"
                onSearch={setBankSearch}
                loading={banksLoading}
                allowCreate={isSuperAdmin}
                onCreateNew={() => setShowCreateBankModal(true)}
                createLabel="Crear nuevo banco"
              />

              <Select
                label="Tipo de Cuenta"
                value={formData.tipo_cuenta}
                onChange={(e) => setFormData({ ...formData, tipo_cuenta: e.target.value as AccountType })}
                options={ACCOUNT_TYPES}
              />

              <Select
                label="Tipo de Identificador"
                value={formData.tipo_identificador_bancario}
                onChange={(e) => setFormData({ ...formData, tipo_identificador_bancario: e.target.value as BankIdentifierType })}
                options={BANK_IDENTIFIER_TYPES}
              />

              <Input
                label={formData.tipo_identificador_bancario === 'Alias' ? 'Alias' : formData.tipo_identificador_bancario || 'Identificador Bancario'}
                value={formData.identificador_bancario}
                onChange={(e) => setFormData({ ...formData, identificador_bancario: e.target.value })}
                placeholder={
                  formData.tipo_identificador_bancario === 'CBU' ? '22 dígitos' :
                  formData.tipo_identificador_bancario === 'CVU' ? '22 dígitos' :
                  formData.tipo_identificador_bancario === 'Alias' ? 'alias.del.proveedor' :
                  'Ingrese el identificador'
                }
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-slate-900 mb-4">Formas de Pago Aceptadas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Switch
                label="Transferencias Bancarias"
                checked={formData.acepta_transferencias}
                onChange={(checked) => setFormData({ ...formData, acepta_transferencias: checked })}
              />

              <Switch
                label="Cheques"
                checked={formData.acepta_cheques}
                onChange={(checked) => setFormData({ ...formData, acepta_cheques: checked })}
              />

              <Switch
                label="Tarjetas de Crédito"
                checked={formData.acepta_tarjetas_credito}
                onChange={(checked) => setFormData({ ...formData, acepta_tarjetas_credito: checked })}
              />

              <Switch
                label="Otros Medios"
                checked={formData.acepta_otros}
                onChange={(checked) => setFormData({ ...formData, acepta_otros: checked })}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                provider ? 'Actualizar Proveedor' : 'Crear Proveedor'
              )}
            </Button>
          </div>
        </form>
      </div>

      {showCreateBankModal && (
        <CreateBankModal
          onClose={() => setShowCreateBankModal(false)}
          onSuccess={handleBankCreated}
        />
      )}
    </div>
  );
}
