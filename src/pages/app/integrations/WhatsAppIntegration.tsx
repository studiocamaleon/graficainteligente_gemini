import { useState, useEffect, useRef } from 'react';
import { MessageSquare, QrCode, CheckCircle2, XCircle, Loader2, AlertCircle, Send } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { usePageHeader } from '../../../hooks/usePageHeader';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../contexts/ToastContext';
import { connectWhatsApp, getConnectionStatus, sendMessage } from '../../../lib/whatsappApi';

const MAX_POLLING_TIME = 120; // 120 segundos
const POLLING_INTERVAL = 2000; // 2 segundos

export function WhatsAppIntegration() {
  usePageHeader('Integración con WhatsApp');
  const { profile } = useAuth();
  const { showSuccess, showError } = useToast();

  // Estado de conexión
  const [isConnected, setIsConnected] = useState(false);
  const [connectedNumber, setConnectedNumber] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // Estado de QR
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [timeLeft, setTimeLeft] = useState(MAX_POLLING_TIME);
  const [pollingActive, setPollingActive] = useState(false);

  // Estado de envío de prueba
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Referencias para polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const companyId = profile?.company_id;

  // Verificar estado inicial
  useEffect(() => {
    if (companyId) {
      checkStatus();
    }
  }, [companyId]);

  // Cleanup de polling al desmontar
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const checkStatus = async () => {
    if (!companyId) return;

    try {
      setIsCheckingStatus(true);
      const status = await getConnectionStatus(companyId);
      setIsConnected(status.connected);
      setConnectedNumber(status.number);
    } catch (error) {
      console.error('Error al verificar estado:', error);
      showError('Error al verificar el estado de conexión');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const startPolling = () => {
    if (!companyId) return;

    setPollingActive(true);
    let elapsedTime = 0;

    // Actualizar contador cada segundo
    timeoutRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopPolling();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Verificar estado cada 2 segundos
    pollingIntervalRef.current = setInterval(async () => {
      elapsedTime += POLLING_INTERVAL / 1000;

      try {
        const status = await getConnectionStatus(companyId);

        if (status.connected) {
          // ¡Conexión exitosa!
          setIsConnected(true);
          setConnectedNumber(status.number);
          setShowQRModal(false);
          setQrCode(null);
          stopPolling();
          showSuccess('¡WhatsApp conectado correctamente!');
        }
      } catch (error) {
        console.error('Error en polling:', error);
      }

      // Timeout después de 120 segundos
      if (elapsedTime >= MAX_POLLING_TIME) {
        stopPolling();
        setShowQRModal(false);
        setQrCode(null);
        showError('No se detectó la conexión. Intentá de nuevo.');
      }
    }, POLLING_INTERVAL);
  };

  const stopPolling = () => {
    setPollingActive(false);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearInterval(timeoutRef.current);
      timeoutRef.current = null;
    }
    setTimeLeft(MAX_POLLING_TIME);
  };

  const handleConnectWhatsApp = async () => {
    if (!companyId) {
      showError('No se pudo obtener el ID de la empresa');
      return;
    }

    try {
      setIsGeneratingQR(true);
      const response = await connectWhatsApp(companyId);
      setQrCode(response.qr);
      setShowQRModal(true);
      setTimeLeft(MAX_POLLING_TIME);

      // Iniciar polling
      startPolling();
    } catch (error) {
      console.error('Error al generar QR:', error);
      showError('Error al generar el código QR');
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handleCloseQRModal = () => {
    stopPolling();
    setShowQRModal(false);
    setQrCode(null);
  };

  const handleSendTest = async () => {
    if (!companyId) {
      showError('No se pudo obtener el ID de la empresa');
      return;
    }

    if (!testPhone.trim() || !testMessage.trim()) {
      showError('Por favor completá todos los campos');
      return;
    }

    try {
      setIsSendingTest(true);
      const response = await sendMessage(companyId, testPhone, testMessage);

      if (response.success) {
        showSuccess('Mensaje enviado correctamente');
        setTestMessage(''); // Limpiar solo el mensaje
      } else {
        showError('Error al enviar el mensaje');
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      showError('Error al enviar el mensaje de prueba');
    } finally {
      setIsSendingTest(false);
    }
  };

  const getConnectionBadge = () => {
    if (isCheckingStatus) {
      return (
        <Badge variant="neutral" className="flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Verificando...
        </Badge>
      );
    }

    if (isConnected) {
      return (
        <Badge variant="success" className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Conectado
        </Badge>
      );
    }

    return (
      <Badge variant="neutral" className="flex items-center gap-1.5">
        <XCircle className="w-3.5 h-3.5" />
        No conectado
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Card de Estado de Conexión */}
      <Card
        title="Estado de Conexión"
        icon={MessageSquare}
        description="Estado actual de tu conexión con WhatsApp"
      >
        <div className="space-y-6">
          {/* Estado actual */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                Estado de WhatsApp
              </p>
              {isConnected && connectedNumber && (
                <p className="text-xs text-gray-500">
                  Número conectado: {connectedNumber}
                </p>
              )}
            </div>
            {getConnectionBadge()}
          </div>

          {/* Mensaje de estado */}
          {isConnected ? (
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
          ) : (
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  WhatsApp no conectado
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Hacé clic en "Conectar WhatsApp" para vincular tu cuenta.
                </p>
              </div>
            </div>
          )}

          {/* Botón de conexión */}
          {!isConnected && (
            <div className="flex gap-3">
              <Button
                onClick={handleConnectWhatsApp}
                disabled={isGeneratingQR || !companyId}
                variant="primary"
                className="flex-1"
              >
                {isGeneratingQR ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generando código QR...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    Conectar WhatsApp
                  </>
                )}
              </Button>
              <Button
                onClick={checkStatus}
                disabled={isCheckingStatus}
                variant="outline"
              >
                {isCheckingStatus ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  '🔄'
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Card de Envío de Prueba */}
      {isConnected && (
        <Card
          title="Enviar Mensaje de Prueba"
          icon={Send}
          description="Enviá un mensaje de prueba para verificar la conexión"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de destino (con código de país)
              </label>
              <Input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="5491112345678"
                disabled={isSendingTest}
              />
              <p className="text-xs text-gray-500 mt-1">
                Ejemplo: 5491112345678 (Argentina)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mensaje
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Hola, este es un mensaje de prueba..."
                disabled={isSendingTest}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSendTest}
                disabled={isSendingTest || !testPhone.trim() || !testMessage.trim()}
                variant="primary"
              >
                {isSendingTest ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar mensaje de prueba
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Card de Información */}
      <Card title="¿Cómo funciona?" icon={AlertCircle}>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              1
            </div>
            <p>
              Hacé clic en <strong>"Conectar WhatsApp"</strong> para generar el código QR.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              2
            </div>
            <p>
              Abrí WhatsApp en tu teléfono, ve a <strong>Ajustes → Dispositivos vinculados → Vincular dispositivo</strong>.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              3
            </div>
            <p>
              Escaneá el código QR que aparece en pantalla. El sistema detectará automáticamente la conexión.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              4
            </div>
            <p>
              Una vez conectado, podés enviar mensajes de prueba para verificar que todo funciona correctamente.
            </p>
          </div>
        </div>
      </Card>

      {/* Modal de QR */}
      <Modal
        isOpen={showQRModal}
        onClose={handleCloseQRModal}
        title="Escaneá este código con tu WhatsApp"
      >
        <div className="space-y-4">
          {qrCode ? (
            <>
              <div className="bg-white border-2 border-gray-200 rounded-lg p-6 flex flex-col items-center">
                <img
                  src={qrCode}
                  alt="Código QR de WhatsApp"
                  className="w-64 h-64 mb-4"
                />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Escanea el QR con WhatsApp
                  </p>
                  <p className="text-xs text-gray-500">
                    WhatsApp {'>'} Ajustes {'>'} Dispositivos vinculados {'>'} Vincular dispositivo
                  </p>
                </div>
              </div>

              {/* Contador de tiempo */}
              {pollingActive && (
                <>
                  <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                        <span className="text-sm text-blue-900">
                          Esperando conexión...
                        </span>
                      </div>
                      <p className="text-xs text-blue-600">
                        El sistema verificará automáticamente cuando escanees el código
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
                      style={{ width: `${(timeLeft / MAX_POLLING_TIME) * 100}%` }}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button onClick={handleCloseQRModal} variant="outline">
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
