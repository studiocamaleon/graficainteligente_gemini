import { useState, useEffect } from 'react';
import { Building2, Phone, Mail, Globe, MapPin, FileText, Settings as SettingsIcon, AlertCircle, CheckCircle, Clock, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { ImageUpload } from '../ui/ImageUpload';
import { useCompany } from '../../hooks/useCompany';
import { useCompanyLogo } from '../../hooks/useCompanyLogo';
import { useBusinessHours } from '../../hooks/useBusinessHours';
import { DayScheduleEditor } from './DayScheduleEditor';
import { BulkScheduleApplicator } from './BulkScheduleApplicator';
import type { CompanyFormData, DocumentType, TaxCondition } from '../../types/database';

interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'general' | 'contact' | 'location' | 'fiscal' | 'settings' | 'hours';

const TAX_CONDITIONS: TaxCondition[] = [
  'Responsable Inscripto',
  'Monotributo',
  'Exento',
  'Consumidor Final',
  'Responsable No Inscripto',
];

const DOCUMENT_TYPES: DocumentType[] = ['DNI', 'CUIT', 'CUIL'];

const CURRENCIES = [
  { value: 'ARS', label: 'Peso Argentino (ARS)' },
  { value: 'USD', label: 'Dólar Estadounidense (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

const TIMEZONES = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'America/Argentina/Cordoba', label: 'Córdoba (GMT-3)' },
  { value: 'America/Argentina/Mendoza', label: 'Mendoza (GMT-3)' },
];

export function CompanyProfileModal({ isOpen, onClose }: CompanyProfileModalProps) {
  const {
    company,
    canEdit,
    isLoading,
    countries,
    provinces,
    cities,
    fetchProvinces,
    fetchCities,
    getInitialFormData,
    handleUpdate,
  } = useCompany();

  const {
    uploadLogo,
    deleteLogo,
    getLogoUrl,
    isUploading,
    isDeleting,
  } = useCompanyLogo();

  const {
    schedules,
    loading: loadingHours,
    error: hoursError,
    updateSchedule,
    toggleDayStatus,
    applyToMultipleDays,
    saveBusinessHours,
  } = useBusinessHours();

  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [formData, setFormData] = useState<CompanyFormData>(getInitialFormData());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showBulkApplicator, setShowBulkApplicator] = useState(false);
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (company) {
      setFormData(getInitialFormData());
    }
  }, [company]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleInputChange = (field: keyof CompanyFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCountryChange = async (countryId: string) => {
    setFormData((prev) => ({ ...prev, country_id: countryId, province_id: '', city_id: '' }));
    if (countryId) {
      await fetchProvinces(countryId);
    }
  };

  const handleProvinceChange = async (provinceId: string) => {
    setFormData((prev) => ({ ...prev, province_id: provinceId, city_id: '' }));
    if (provinceId) {
      await fetchCities(provinceId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.name.trim()) {
      setError('El nombre de la empresa es requerido');
      return;
    }

    if (formData.contact_email && !isValidEmail(formData.contact_email)) {
      setError('El email de contacto no es válido');
      return;
    }

    setIsSaving(true);

    try {
      const updateData: Partial<CompanyFormData> = {
        name: formData.name.trim(),
        contact_phone: formData.contact_phone.trim() || '',
        contact_email: formData.contact_email.trim() || '',
        website: formData.website.trim() || '',
        business_hours: formData.business_hours?.trim() || '',
        google_review_url: formData.google_review_url?.trim() || '',
        address: formData.address.trim() || '',
        country_id: formData.country_id || '',
        province_id: formData.province_id || '',
        city_id: formData.city_id || '',
        postal_code: formData.postal_code.trim() || '',
        legal_name: formData.legal_name.trim() || '',
        tax_id_type: formData.tax_id_type || '',
        tax_id_number: formData.tax_id_number.trim() || '',
        tax_condition: formData.tax_condition || '',
        timezone: formData.timezone,
        currency: formData.currency,
        language: formData.language,
        description: formData.description.trim() || '',
        industry: formData.industry.trim() || '',
      };

      await handleUpdate(updateData);
      setSuccess('Perfil de empresa actualizado correctamente');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el perfil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setError(null);
      setSuccess(null);
      setFormData(getInitialFormData());
      onClose();
    }
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSaveHours = async () => {
    console.group('🔍 DEBUG: handleSaveHours - CompanyProfileModal');
    console.log('Iniciando guardado de horarios desde el modal...');
    console.log('Schedules actuales:', schedules);
    console.log('Schedules abiertos:', schedules.filter(s => s.is_open));

    console.log('\nDetalle de schedules abiertos:');
    schedules.filter(s => s.is_open).forEach(s => {
      console.group(`${s.day_name}`);
      console.log('opening_time_1:', JSON.stringify(s.opening_time_1), `(length: ${s.opening_time_1.length})`);
      console.log('closing_time_1:', JSON.stringify(s.closing_time_1), `(length: ${s.closing_time_1.length})`);
      if (s.opening_time_2 || s.closing_time_2) {
        console.log('opening_time_2:', JSON.stringify(s.opening_time_2), `(length: ${s.opening_time_2.length})`);
        console.log('closing_time_2:', JSON.stringify(s.closing_time_2), `(length: ${s.closing_time_2.length})`);
      }
      console.groupEnd();
    });

    setSavingHours(true);
    setError(null);
    setSuccess(null);

    console.log('\n🚀 Llamando a saveBusinessHours()...');
    const result = await saveBusinessHours();

    console.log('Resultado:', result);
    if (result.success) {
      console.log('✅ Guardado exitoso');
      setSuccess('Horarios de atención guardados correctamente');
    } else {
      console.error('❌ Error al guardar:', result.error);
      setError(result.error || 'Error al guardar horarios');
    }

    setSavingHours(false);
    console.groupEnd();
  };

  if (!canEdit) {
    return null;
  }

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Building2 },
    { id: 'contact' as const, label: 'Contacto', icon: Phone },
    { id: 'location' as const, label: 'Ubicación', icon: MapPin },
    { id: 'fiscal' as const, label: 'Fiscal', icon: FileText },
    { id: 'settings' as const, label: 'Configuración', icon: SettingsIcon },
    { id: 'hours' as const, label: 'Horarios', icon: Clock },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Perfil de Empresa">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-gray-200">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-900">{company?.name}</h3>
            <p className="text-sm text-gray-600">{company?.slug}</p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4 inline-block mr-2" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm"
            >
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-h-[400px] overflow-y-auto pr-2">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la Empresa <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Ingresa el nombre de la empresa"
                    disabled={isSaving}
                    required
                  />
                </div>

                <ImageUpload
                  currentImageUrl={getLogoUrl()}
                  onUpload={async (file) => {
                    const result = await uploadLogo(file);
                    if (result.success) {
                      setSuccess('Logo actualizado correctamente');
                      window.location.reload();
                    } else {
                      setError(result.error || 'Error al subir el logo');
                    }
                  }}
                  onDelete={async () => {
                    const result = await deleteLogo();
                    if (result.success) {
                      setSuccess('Logo eliminado correctamente');
                      window.location.reload();
                    } else {
                      setError(result.error || 'Error al eliminar el logo');
                    }
                  }}
                  isUploading={isUploading}
                  isDeleting={isDeleting}
                  disabled={isSaving}
                  label="Logo de la Empresa"
                  helperText="Sube el logo de tu empresa. Se mostrará en el sidebar y como favicon. Máximo 2MB."
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe tu empresa..."
                    disabled={isSaving}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-50 disabled:cursor-not-allowed resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Industria / Sector
                  </label>
                  <Input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => handleInputChange('industry', e.target.value)}
                    placeholder="Ej: Imprenta Digital, Diseño Gráfico"
                    disabled={isSaving}
                  />
                </div>
              </motion.div>
            )}

            {activeTab === 'contact' && (
              <motion.div
                key="contact"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Teléfono
                  </label>
                  <Input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                    placeholder="+54 11 1234-5678"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email de Contacto
                  </label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    placeholder="contacto@empresa.com"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Globe className="w-4 h-4 inline mr-1" />
                    Sitio Web
                  </label>
                  <Input
                    type="url"
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    placeholder="https://www.empresa.com"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Horarios de Atención
                  </label>
                  <textarea
                    value={formData.business_hours || ''}
                    onChange={(e) => handleInputChange('business_hours', e.target.value)}
                    placeholder="Lunes a Viernes: 9:00 - 18:00&#10;Sábados: 9:00 - 13:00"
                    disabled={isSaving}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Este horario se incluirá en notificaciones de WhatsApp de órdenes finalizadas
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Globe className="w-4 h-4 inline mr-1" />
                    Link de Reseñas de Google
                  </label>
                  <Input
                    type="url"
                    value={formData.google_review_url || ''}
                    onChange={(e) => handleInputChange('google_review_url', e.target.value)}
                    placeholder="https://g.page/r/CXmfpqhdwyC4EAE/review"
                    disabled={isSaving}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Este link se enviará en notificaciones de WhatsApp para solicitar reseñas
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'location' && (
              <motion.div
                key="location"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <Input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Calle, número, piso, depto"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    País
                  </label>
                  <SearchableSelect
                    value={formData.country_id}
                    onChange={handleCountryChange}
                    options={countries.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Selecciona un país"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provincia
                  </label>
                  <SearchableSelect
                    value={formData.province_id}
                    onChange={handleProvinceChange}
                    options={provinces.map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="Selecciona una provincia"
                    disabled={isSaving || !formData.country_id}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ciudad
                  </label>
                  <SearchableSelect
                    value={formData.city_id}
                    onChange={(value) => handleInputChange('city_id', value)}
                    options={cities.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Selecciona una ciudad"
                    disabled={isSaving || !formData.province_id}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código Postal
                  </label>
                  <Input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => handleInputChange('postal_code', e.target.value)}
                    placeholder="1234"
                    disabled={isSaving}
                  />
                </div>
              </motion.div>
            )}

            {activeTab === 'fiscal' && (
              <motion.div
                key="fiscal"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Razón Social
                  </label>
                  <Input
                    type="text"
                    value={formData.legal_name}
                    onChange={(e) => handleInputChange('legal_name', e.target.value)}
                    placeholder="Razón social completa"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Documento
                  </label>
                  <Select
                    value={formData.tax_id_type}
                    onChange={(value) => handleInputChange('tax_id_type', value as DocumentType)}
                    options={DOCUMENT_TYPES.map((type) => ({ value: type, label: type }))}
                    placeholder="Selecciona un tipo"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Documento Fiscal
                  </label>
                  <Input
                    type="text"
                    value={formData.tax_id_number}
                    onChange={(e) => handleInputChange('tax_id_number', e.target.value)}
                    placeholder="20-12345678-9"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condición ante IVA
                  </label>
                  <Select
                    value={formData.tax_condition}
                    onChange={(value) => handleInputChange('tax_condition', value as TaxCondition)}
                    options={TAX_CONDITIONS.map((condition) => ({ value: condition, label: condition }))}
                    placeholder="Selecciona una condición"
                    disabled={isSaving}
                  />
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zona Horaria
                  </label>
                  <Select
                    value={formData.timezone}
                    onChange={(value) => handleInputChange('timezone', value)}
                    options={TIMEZONES}
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Moneda
                  </label>
                  <Select
                    value={formData.currency}
                    onChange={(value) => handleInputChange('currency', value)}
                    options={CURRENCIES}
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Idioma
                  </label>
                  <Select
                    value={formData.language}
                    onChange={(value) => handleInputChange('language', value)}
                    options={[
                      { value: 'es', label: 'Español' },
                      { value: 'en', label: 'English' },
                      { value: 'pt', label: 'Português' },
                    ]}
                    disabled={isSaving}
                  />
                </div>
              </motion.div>
            )}

            {activeTab === 'hours' && (
              <motion.div
                key="hours"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    Horarios de Atención
                  </h3>
                  <p className="text-xs text-gray-600">
                    Configure los días y horarios en que su empresa atiende al público.
                    Puede agregar hasta dos rangos horarios por día (ej: mañana y tarde).
                  </p>
                </div>

                {loadingHours ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-600 mt-2">Cargando horarios...</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {schedules.map((schedule) => (
                        <DayScheduleEditor
                          key={schedule.day_of_week}
                          schedule={schedule}
                          onChange={updateSchedule}
                          onToggle={toggleDayStatus}
                          disabled={savingHours}
                        />
                      ))}
                    </div>

                    <div className="pt-4 border-t flex flex-col sm:flex-row gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowBulkApplicator(true)}
                        disabled={savingHours}
                        className="flex-1"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Aplicar a varios días
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveHours}
                        disabled={savingHours}
                        className="flex-1"
                      >
                        {savingHours ? 'Guardando...' : 'Guardar Horarios'}
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>

      <BulkScheduleApplicator
        isOpen={showBulkApplicator}
        onClose={() => setShowBulkApplicator(false)}
        schedules={schedules}
        onApply={applyToMultipleDays}
      />
    </Modal>
  );
}
