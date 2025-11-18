import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { validateIPv4, formatIPValidationMessage, getPublicIP } from '../../lib/ipUtils';
import { useIPRestrictions } from '../../hooks/useIPRestrictions';

interface AddIPRestrictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export function AddIPRestrictionModal({
  isOpen,
  onClose,
  userId,
  userName,
}: AddIPRestrictionModalProps) {
  const { createRestriction, restrictions } = useIPRestrictions(userId);
  const [loading, setLoading] = useState(false);
  const [loadingCurrentIP, setLoadingCurrentIP] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ipError, setIpError] = useState<string>('');

  const [formData, setFormData] = useState({
    ipAddress: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        ipAddress: '',
        description: '',
        isActive: true,
      });
      setError(null);
      setIpError('');
    }
  }, [isOpen]);

  const handleIPChange = (value: string) => {
    setFormData({ ...formData, ipAddress: value });

    if (value) {
      const validationMessage = formatIPValidationMessage(value);
      setIpError(validationMessage);
    } else {
      setIpError('');
    }
  };

  const handleUseCurrentIP = async () => {
    setLoadingCurrentIP(true);
    setError(null);

    try {
      const currentIP = await getPublicIP();

      if (!currentIP) {
        setError('No se pudo obtener tu IP actual. Por favor, ingrésala manualmente.');
        return;
      }

      setFormData({ ...formData, ipAddress: currentIP });
      setIpError('');
    } catch (err) {
      setError('Error al obtener tu IP actual');
    } finally {
      setLoadingCurrentIP(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.ipAddress) {
      setError('La dirección IP es obligatoria');
      return;
    }

    if (!validateIPv4(formData.ipAddress)) {
      setError('Por favor, ingresa una dirección IP válida (formato: XXX.XXX.XXX.XXX)');
      return;
    }

    const isDuplicate = restrictions.some(
      (r) => r.ip_address === formData.ipAddress
    );

    if (isDuplicate) {
      setError('Esta dirección IP ya está configurada para este usuario');
      return;
    }

    setLoading(true);

    try {
      await createRestriction(
        userId,
        formData.ipAddress,
        formData.description,
        formData.isActive
      );

      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al agregar la restricción de IP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar Restricción de IP"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <Globe className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Configurando restricción para:</p>
              <p className="font-semibold">{userName}</p>
              <p className="mt-2 text-blue-700">
                Una vez configurada, este usuario solo podrá acceder desde las IPs autorizadas.
              </p>
            </div>
          </div>
        </div>

        <div>
          <Input
            label="Dirección IP"
            value={formData.ipAddress}
            onChange={(e) => handleIPChange(e.target.value)}
            placeholder="Ej: 200.45.123.45"
            required
            error={ipError}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleUseCurrentIP}
            disabled={loadingCurrentIP}
            className="mt-2 text-sm"
          >
            {loadingCurrentIP ? 'Obteniendo...' : 'Usar mi IP actual'}
          </Button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ej: Oficina Principal, Home Office, Sucursal Norte..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Agrega una descripción para identificar fácilmente esta ubicación
          </p>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700">
              Activar restricción inmediatamente
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {formData.isActive ? 'La IP estará activa al guardar' : 'Guardará como inactiva'}
            </p>
          </div>
          <Switch
            checked={formData.isActive}
            onChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !!ipError}
          >
            {loading ? 'Agregando...' : 'Agregar IP'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
