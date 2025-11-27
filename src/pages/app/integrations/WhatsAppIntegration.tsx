import { MessageSquare, QrCode, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useEvolutionIntegration } from '../../../hooks/useEvolutionIntegration';
import { useToast } from '../../../contexts/ToastContext';

export function WhatsAppIntegration() {
  usePageHeader('Integración con WhatsApp');
  const { showSuccess, showError } = useToast();
  const {
    config,
    formData,
    qrData,
    isLoading,
    isSaving,
    error,
    timeLeft,
    pollingAttempts,
    saveConfig,
    generateQR,
    clearQR,
    updateFormData,
    setError,
    checkConnectionState,
  } = useEvolutionIntegration();

  const handleSaveConfig = async () => {
    const success = await saveConfig();
    if (success) {
      showSuccess('Configuración guardada correctamente');
    } else if (error) {
      showError(error);
    }
  };

  const handleGenerateQR = async () => {
    setError(null);
    const success = await generateQR();
    if (success) {
      showSuccess('QR generado. Escanéalo con WhatsApp.');
    } else if (error) {
      showError(error);
    }
  };

  const handleManualCheck = async () => {
    console.log('[Manual Check] 🕵️ User triggered manual connection check');
    showSuccess('Verificando conexión...');
    const state = await checkConnectionState();
    if (state === 'open') {
      showSuccess('¡WhatsApp conectado correctamente!');
    } else {
      showError(`Estado actual: ${state}`);
    }
  };

  const getConnectionBadge = () => {
    const state = config.connectionState || 'disconnected';

    switch (state) {
      case 'open':
        return (
          <Badge variant="success" className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Conectado
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="warning" className="flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Conectando...
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="error" className="flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" className="flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Desconectado
          </Badge>
        );
    }
  };

  const formatLastConnected = () => {
    if (!config.lastConnectedAt) return null;

    const date = new Date(config.lastConnectedAt);
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  };

  const canGenerateQR =
    config.hasConfig &&
    config.hasApiKey &&
    formData.instanceId.trim() !== '' &&
    config.connectionState !== 'connecting' &&
    !qrData;

  return (
    <div className="space-y-6">
      {/* Card de Configuración */}
      <Card
        title="Configuración de Evolution API"
        icon={MessageSquare}
        description="Configura tu instancia de Evolution API para conectar WhatsApp"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL Base
            </label>
            <Input
              type="text"
              value={formData.baseUrl}
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL fija de Evolution API
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instance ID <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.instanceId}
              onChange={(e) => updateFormData('instanceId', e.target.value)}
              placeholder="mi-instancia-whatsapp"
              disabled={isSaving}
            />
            <p className="text-xs text-gray-500 mt-1">
              ID único de tu instancia en Evolution API
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              value={formData.apiKey}
              onChange={(e) => updateFormData('apiKey', e.target.value)}
              placeholder={config.hasApiKey ? '••••••••••••' : 'Tu API Key de Evolution'}
              disabled={isSaving}
            />
            <p className="text-xs text-gray-500 mt-1">
              {config.hasApiKey
                ? 'API Key configurada. Deja en blanco para mantener la actual.'
                : 'API Key para autenticación con Evolution API'}
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveConfig}
              disabled={isSaving || !formData.instanceId.trim()}
              className="min-w-[140px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar configuración'
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Card de Conexión */}
      <Card
        title="Conexión de WhatsApp"
        icon={QrCode}
        description="Genera un código QR para conectar tu cuenta de WhatsApp"
      >
        <div className="space-y-6">
          {/* Estado de Conexión */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                Estado de Conexión
              </p>
              {formatLastConnected() && (
                <p className="text-xs text-gray-500">
                  Última conexión: {formatLastConnected()}
                </p>
              )}
            </div>
            {getConnectionBadge()}
          </div>

          {/* Mensaje de éxito */}
          {config.connectionState === 'open' && (
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">
                  WhatsApp conectado correctamente
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Tu WhatsApp está listo para enviar y recibir mensajes.
                </p>
              </div>
            </div>
          )}

          {/* Botón Generar QR */}
          {!qrData && config.connectionState !== 'open' && (
            <div>
              <Button
                onClick={handleGenerateQR}
                disabled={!canGenerateQR || isLoading}
                variant="primary"
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generando QR...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    Generar Código QR
                  </>
                )}
              </Button>

              {!config.hasConfig && (
                <div className="flex items-start gap-2 mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800">
                    Primero configura tu Instance ID y API Key arriba
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Área de QR */}
          {qrData && (
            <div className="space-y-4">
              <div className="bg-white border-2 border-gray-200 rounded-lg p-6 flex flex-col items-center">
                <img
                  src={qrData.base64}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 mb-4"
                />

                {qrData.pairingCode && (
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-600 mb-1">
                      Código de emparejamiento:
                    </p>
                    <p className="text-2xl font-mono font-bold text-blue-600">
                      {qrData.pairingCode}
                    </p>
                  </div>
                )}

                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Escanea el QR con WhatsApp
                  </p>
                  <p className="text-xs text-gray-500">
                    WhatsApp {'>'} Ajustes {'>'} Dispositivos vinculados {'>'} Vincular dispositivo
                  </p>
                </div>
              </div>

              {/* Contador */}
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <span className="text-sm text-blue-900">
                      Esperando conexión...
                    </span>
                  </div>
                  <p className="text-xs text-blue-600">
                    Intentos de verificación: {pollingAttempts}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-700">Tiempo restante</p>
                  <p className="text-lg font-bold text-blue-900">{timeLeft}s</p>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 transition-all duration-1000"
                  style={{ width: `${(timeLeft / 120) * 100}%` }}
                />
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3">
                <Button
                  onClick={handleManualCheck}
                  variant="outline"
                  className="flex-1"
                >
                  🔄 Verificar manualmente
                </Button>
                <Button
                  onClick={clearQR}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Mensaje de QR expirado */}
          {timeLeft === 0 && !qrData && config.connectionState === 'connecting' && (
            <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-900">
                  El código QR ha expirado
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  Haz clic en "Generar Código QR" para crear uno nuevo.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Card de Información */}
      <Card
        title="¿Cómo funciona?"
        icon={AlertCircle}
      >
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              1
            </div>
            <p>
              Ingresa tu <strong>Instance ID</strong> y <strong>API Key</strong> de Evolution API en la configuración.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              2
            </div>
            <p>
              Haz clic en <strong>"Generar Código QR"</strong> para obtener el código de vinculación.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              3
            </div>
            <p>
              Abre WhatsApp en tu teléfono, ve a <strong>Ajustes → Dispositivos vinculados → Vincular dispositivo</strong> y escanea el QR.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              4
            </div>
            <p>
              Una vez conectado, podrás enviar y recibir mensajes de WhatsApp desde el sistema.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
