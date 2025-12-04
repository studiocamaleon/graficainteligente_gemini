import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  User,
  FileText,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Sparkles,
  Shield,
  Clock,
} from 'lucide-react';
import { useClienteRegistro } from '../../hooks/useClienteRegistro';
import { supabase } from '../../lib/supabase';

interface CompanyInfo {
  id: string;
  name: string;
  logo_url: string | null;
}

export function ClienteRegistro() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { registrarCliente, validarDocumento, validarWhatsApp, validarEmail, loading } = useClienteRegistro();

  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [whatsappEnviado, setWhatsappEnviado] = useState(false);

  const [formData, setFormData] = useState({
    nombre_fantasia: '',
    razon_social: '',
    tipo_documento: 'DNI' as 'DNI' | 'CUIT' | 'CUIL',
    numero_documento: '',
    whatsapp: '',
    email: '',
    domicilio: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (companyId) {
      loadCompanyInfo();
    }
  }, [companyId]);

  const loadCompanyInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .eq('id', companyId)
        .single();

      if (error) throw error;

      setCompany(data);
    } catch (error) {
      console.error('Error cargando empresa:', error);
      setShowError(true);
      setErrorMessage('Empresa no encontrada');
    } finally {
      setLoadingCompany(false);
    }
  };

  const validateField = (name: string, value: string) => {
    let error = '';

    switch (name) {
      case 'nombre_fantasia':
      case 'razon_social':
        if (!value.trim()) {
          error = 'Este campo es obligatorio';
        }
        break;
      case 'numero_documento':
        const docValidation = validarDocumento(formData.tipo_documento, value);
        if (!docValidation.valido) {
          error = docValidation.error || '';
        }
        break;
      case 'whatsapp':
        if (!validarWhatsApp(value)) {
          error = 'Número de WhatsApp inválido';
        }
        break;
      case 'email':
        if (value && !validarEmail(value)) {
          error = 'Email inválido';
        }
        break;
    }

    setErrors(prev => ({ ...prev, [name]: error }));
    return !error;
  };

  const formatWhatsApp = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.startsWith('549')) {
      return cleaned;
    }
    if (cleaned.startsWith('54')) {
      return '549' + cleaned.substring(2);
    }
    if (cleaned.startsWith('15')) {
      return '549' + cleaned.substring(2);
    }
    if (cleaned.startsWith('0')) {
      return '549' + cleaned.substring(1);
    }
    if (cleaned.length > 0) {
      return '549' + cleaned;
    }
    return cleaned;
  };

  const handleChange = (name: string, value: string) => {
    const finalValue = name === 'whatsapp' ? formatWhatsApp(value) : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
    if (touched[name]) {
      validateField(name, finalValue);
    }
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, formData[name as keyof typeof formData]);
  };

  const canProceedToStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!(formData.nombre_fantasia && formData.razon_social);
      case 1:
        return !!(
          formData.tipo_documento &&
          formData.numero_documento &&
          !errors.numero_documento
        );
      case 2:
        return !!(formData.whatsapp && !errors.whatsapp);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceedToStep(currentStep) && currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!companyId) return;

    const allValid = Object.keys(formData).every(key => {
      if (key === 'email' || key === 'domicilio') return true;
      return validateField(key, formData[key as keyof typeof formData]);
    });

    if (!allValid) return;

    const result = await registrarCliente({
      company_id: companyId,
      ...formData,
    });

    if (result.success) {
      setWhatsappEnviado(result.whatsapp_enviado || false);
      setShowSuccess(true);
    } else {
      setShowError(true);
      setErrorMessage(result.error || 'Error al registrar');
    }
  };

  if (loadingCompany) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Empresa no encontrada</h1>
          <p className="text-gray-600">El enlace de registro no es válido.</p>
        </motion.div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full"
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto mb-6" />
            </motion.div>

            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              ¡Registro Exitoso!
            </h1>

            <p className="text-lg text-gray-600 mb-6">
              Tu solicitud ha sido recibida y está siendo revisada por nuestro equipo.
            </p>

            {whatsappEnviado && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6"
              >
                <Phone className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-green-700 font-medium">
                  Hemos enviado una confirmación a tu WhatsApp
                </p>
              </motion.div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
              <Clock className="h-8 w-8 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">¿Qué sigue?</h3>
              <ul className="text-sm text-gray-600 space-y-2 text-left">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">1.</span>
                  <span>Revisaremos tu información</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">2.</span>
                  <span>Te enviaremos una confirmación cuando tu cuenta sea aprobada</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">3.</span>
                  <span>Podrás comenzar a realizar pedidos</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
              Volver al inicio
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (showError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full"
        >
          <div className="text-center">
            <XCircle className="h-20 w-20 text-red-500 mx-auto mb-6" />

            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Error al Registrar
            </h1>

            <p className="text-lg text-gray-600 mb-8">
              {errorMessage}
            </p>

            <button
              onClick={() => {
                setShowError(false);
                setErrorMessage('');
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
              Intentar nuevamente
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const steps = [
    {
      title: 'Datos Básicos',
      icon: Building2,
      fields: (
        <>
          <FormField
            label="Nombre Comercial"
            name="nombre_fantasia"
            value={formData.nombre_fantasia}
            onChange={(e) => handleChange('nombre_fantasia', e.target.value)}
            onBlur={() => handleBlur('nombre_fantasia')}
            error={touched.nombre_fantasia ? errors.nombre_fantasia : undefined}
            icon={Building2}
            placeholder="Ej: Imprenta Central"
            required
          />
          <FormField
            label="Razón Social"
            name="razon_social"
            value={formData.razon_social}
            onChange={(e) => handleChange('razon_social', e.target.value)}
            onBlur={() => handleBlur('razon_social')}
            error={touched.razon_social ? errors.razon_social : undefined}
            icon={FileText}
            placeholder="Ej: Imprenta Central S.A."
            required
          />
        </>
      ),
    },
    {
      title: 'Documento',
      icon: FileText,
      fields: (
        <>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Tipo de Documento
              <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['DNI', 'CUIT', 'CUIL'] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => {
                    handleChange('tipo_documento', tipo);
                    if (formData.numero_documento) {
                      validateField('numero_documento', formData.numero_documento);
                    }
                  }}
                  className={`py-3 px-4 rounded-xl font-semibold transition-all ${
                    formData.tipo_documento === tipo
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tipo}
                </button>
              ))}
            </div>
          </div>
          <FormField
            label="Número de Documento"
            name="numero_documento"
            value={formData.numero_documento}
            onChange={(e) => handleChange('numero_documento', e.target.value)}
            onBlur={() => handleBlur('numero_documento')}
            error={touched.numero_documento ? errors.numero_documento : undefined}
            icon={FileText}
            placeholder={
              formData.tipo_documento === 'DNI'
                ? '12345678'
                : '20-12345678-9'
            }
            required
          />
        </>
      ),
    },
    {
      title: 'Contacto',
      icon: Phone,
      fields: (
        <>
          <FormField
            label="WhatsApp"
            name="whatsapp"
            type="tel"
            value={formData.whatsapp}
            onChange={(e) => handleChange('whatsapp', e.target.value)}
            onBlur={() => handleBlur('whatsapp')}
            error={touched.whatsapp ? errors.whatsapp : undefined}
            icon={Phone}
            placeholder="11 1234-5678"
            helperText="Se guardará en formato internacional: 549XXXXXXXXX"
            required
          />
          <FormField
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            error={touched.email ? errors.email : undefined}
            icon={Mail}
            placeholder="correo@ejemplo.com"
          />
        </>
      ),
    },
    {
      title: 'Dirección',
      icon: MapPin,
      fields: (
        <FormField
          label="Domicilio"
          name="domicilio"
          value={formData.domicilio}
          onChange={(e) => handleChange('domicilio', e.target.value)}
          icon={MapPin}
          placeholder="Av. Siempre Viva 123"
        />
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {company.logo_url && (
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-16 mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Registro de Cliente
          </h1>
          <p className="text-gray-600 flex items-center justify-center gap-2">
            <Building2 className="h-5 w-5" />
            {company.name}
          </p>
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <div key={index} className="flex-1 flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                      index <= currentStep
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    <StepIcon className="h-5 w-5" />
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                        index < currentStep
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-600'
                          : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-600 font-medium">
            {steps.map((step, index) => (
              <div key={index} className="flex-1 text-center">
                {step.title}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Form Card */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white rounded-3xl shadow-2xl p-8 mb-6"
        >
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {currentStepData.title}
              </h2>
            </div>
          </div>

          <div className="space-y-6">{currentStepData.fields}</div>

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-8">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 py-4 px-6 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-5 w-5" />
                Anterior
              </button>
            )}
            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceedToStep(currentStep)}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  canProceedToStep(currentStep)
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-lg'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Siguiente
                <Sparkles className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !canProceedToStep(currentStep)}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  loading || !canProceedToStep(currentStep)
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-lg'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Registrar
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>

        {/* Security Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-sm text-gray-500 flex items-center justify-center gap-2"
        >
          <Shield className="h-4 w-4" />
          Tus datos están protegidos y solo se usarán para procesar tu registro
        </motion.div>
      </div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  error?: string;
  icon: React.ElementType;
  placeholder?: string;
  type?: string;
  required?: boolean;
  helperText?: string;
}

function FormField({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  icon: Icon,
  placeholder,
  type = 'text',
  required = false,
  helperText,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-600" />
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
            error
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
          }`}
        />
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-1 text-sm text-red-600 flex items-center gap-1"
            >
              <XCircle className="h-4 w-4" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        {!error && helperText && (
          <p className="mt-1 text-xs text-gray-500">{helperText}</p>
        )}
      </div>
    </div>
  );
}
