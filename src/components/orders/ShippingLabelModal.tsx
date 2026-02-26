import { useEffect, useMemo, useState } from 'react';
import { MapPin, Package, FileDown } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  generateShippingLabelsPDF,
  type ShippingLabelCompanyData,
  type ShippingLabelOrderData,
} from '../../utils/pdfGenerators/shippingLabelPDF';

interface ShippingLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyData: ShippingLabelCompanyData;
  orderData: {
    numeroOrden: string;
    clienteNombre: string;
    requiereDespacho: boolean;
  };
  defaultAddress?: string | null;
  onExport?: (payload: { domicilio: string; cantidadBultos: number }) => void;
}

export function ShippingLabelModal({
  isOpen,
  onClose,
  companyData,
  orderData,
  defaultAddress,
  onExport,
}: ShippingLabelModalProps) {
  const [domicilio, setDomicilio] = useState('');
  const [cantidadBultos, setCantidadBultos] = useState('1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDomicilio((defaultAddress || '').trim());
    setCantidadBultos('1');
    setError(null);
  }, [isOpen, defaultAddress]);

  const parsedBultos = useMemo(() => Math.floor(Number(cantidadBultos)), [cantidadBultos]);

  const handleExport = async () => {
    const domicilioSanitized = domicilio.trim();

    if (!domicilioSanitized) {
      setError('El domicilio es obligatorio.');
      return;
    }

    if (!Number.isFinite(parsedBultos) || parsedBultos < 1) {
      setError('La cantidad de bultos debe ser un entero mayor o igual a 1.');
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const orderPayload: ShippingLabelOrderData = {
        numeroOrden: orderData.numeroOrden,
        clienteNombre: orderData.clienteNombre,
        domicilio: domicilioSanitized,
        cantidadBultos: parsedBultos,
      };

      await generateShippingLabelsPDF({
        company: companyData,
        order: orderPayload,
      });

      onExport?.({ domicilio: domicilioSanitized, cantidadBultos: parsedBultos });
    } catch (err) {
      console.error('Error generando etiquetas de envio:', err);
      setError('No se pudo generar el PDF de etiquetas.');
      return;
    } finally {
      setIsGenerating(false);
    }

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generar etiqueta de envío" size="md">
      <div className="space-y-5">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Se generará un PDF de etiqueta térmica <strong>100x150 mm</strong> (1 página por bulto) para la orden <strong>{orderData.numeroOrden}</strong>.
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Domicilio de entrega</label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={domicilio}
              onChange={(e) => setDomicilio(e.target.value)}
              placeholder="Ingresar domicilio completo"
              className="pl-10"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cantidad de bultos</label>
          <div className="relative">
            <Package className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="number"
              min={1}
              step={1}
              value={cantidadBultos}
              onChange={(e) => setCantidadBultos(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button onClick={() => void handleExport()} disabled={isGenerating} className="gap-2">
            <FileDown className="h-4 w-4" />
            {isGenerating ? 'Generando...' : 'Exportar PDF'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
