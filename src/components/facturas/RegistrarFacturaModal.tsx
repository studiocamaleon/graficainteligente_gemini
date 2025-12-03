import { useState } from 'react';
import { Upload, FileText, X, Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';
import type { OrdenPendienteFacturacion } from '../../hooks/useFacturas';

interface RegistrarFacturaModalProps {
  isOpen: boolean;
  onClose: () => void;
  orden: OrdenPendienteFacturacion | null;
  onSubmit: (ordenId: string, numeroFactura: string, archivo: File, observaciones?: string) => Promise<void>;
  loading?: boolean;
}

export function RegistrarFacturaModal({
  isOpen,
  onClose,
  orden,
  onSubmit,
  loading = false,
}: RegistrarFacturaModalProps) {
  const [numeroFactura, setNumeroFactura] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [extrayendo, setExtrayendo] = useState(false);
  const [numeroAutoDetectado, setNumeroAutoDetectado] = useState(false);

  const handleArchivoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Solo se permiten archivos PDF');
        setArchivo(null);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('El archivo no puede superar los 10MB');
        setArchivo(null);
        return;
      }
      setError(null);
      setArchivo(file);
      setNumeroAutoDetectado(false);

      // Intentar extraer el número de factura automáticamente
      await extraerNumeroFactura(file);
    }
  };

  const extraerNumeroFactura = async (file: File) => {
    try {
      setExtrayendo(true);
      setError(null);

      console.log('[RegistrarFactura] Extrayendo número de factura del PDF...');

      // Crear FormData con el archivo
      const formData = new FormData();
      formData.append('file', file);

      // Llamar a la Edge Function
      const { data, error: functionError } = await supabase.functions.invoke(
        'extract-invoice-number',
        {
          body: formData,
        }
      );

      if (functionError) {
        console.warn('[RegistrarFactura] Error llamando a Edge Function:', functionError);
        // No mostrar error al usuario, solo logging
        return;
      }

      console.log('[RegistrarFactura] Respuesta de Edge Function:', data);

      if (data?.success && data?.numeroFactura) {
        setNumeroFactura(data.numeroFactura);
        setNumeroAutoDetectado(true);
        console.log('[RegistrarFactura] ✅ Número de factura detectado:', data.numeroFactura);
      } else {
        console.log('[RegistrarFactura] ⚠️ No se pudo detectar el número de factura');
        setNumeroAutoDetectado(false);
      }
    } catch (err: any) {
      console.error('[RegistrarFactura] Error extrayendo número:', err);
      // No mostrar error al usuario, es una función auxiliar
    } finally {
      setExtrayendo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orden) return;

    if (!numeroFactura.trim()) {
      setError('El número de factura es requerido');
      return;
    }

    if (!archivo) {
      setError('Debe seleccionar un archivo PDF');
      return;
    }

    setError(null);

    try {
      await onSubmit(orden.id, numeroFactura.trim(), archivo, observaciones.trim() || undefined);
      handleClose();
    } catch (err) {
      setError('Error al registrar la factura');
    }
  };

  const handleClose = () => {
    setNumeroFactura('');
    setArchivo(null);
    setObservaciones('');
    setError(null);
    setExtrayendo(false);
    setNumeroAutoDetectado(false);
    onClose();
  };

  if (!orden) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Registrar Factura">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Orden {orden.numero_orden}</h4>
          <div className="space-y-1 text-sm text-blue-800">
            <p>Cliente: {orden.cliente_nombre}</p>
            <div className="flex items-center justify-between pt-2 border-t border-blue-200">
              <span>Total con IVA:</span>
              <span className="font-bold">{formatCurrency(orden.total)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>IVA incluido:</span>
              <span>{formatCurrency(orden.subtotal_iva)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Número de Factura *
          </label>
          <Input
            type="text"
            value={numeroFactura}
            onChange={(e) => {
              setNumeroFactura(e.target.value);
              setNumeroAutoDetectado(false); // Si edita manualmente, ya no es auto-detectado
            }}
            placeholder="Ej: 00002-00000300"
            disabled={loading || extrayendo}
            required
          />
          {numeroAutoDetectado && (
            <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>Número detectado automáticamente</span>
            </div>
          )}
          {!extrayendo && !numeroAutoDetectado && archivo && (
            <div className="flex items-center gap-2 mt-2 text-sm text-blue-600">
              <Info className="w-4 h-4" />
              <span>Complete el número manualmente</span>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1">
            El número se detecta automáticamente del PDF o puede ingresarlo manualmente
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Archivo PDF *
          </label>
          <div className="relative">
            <input
              type="file"
              accept=".pdf"
              onChange={handleArchivoChange}
              className="hidden"
              id="archivo-factura"
              disabled={loading || extrayendo}
            />
            <label
              htmlFor="archivo-factura"
              className={`
                flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg
                cursor-pointer transition-colors
                ${archivo ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}
                ${loading || extrayendo ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {archivo ? (
                <>
                  <FileText className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">{archivo.name}</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Haga clic para seleccionar archivo PDF</span>
                </>
              )}
            </label>
          </div>

          {extrayendo && (
            <div className="flex items-center gap-2 mt-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Leyendo número de factura del PDF...</span>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-1">
            Solo archivos PDF. Tamaño máximo: 10MB
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observaciones (Opcional)
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Notas adicionales sobre esta factura..."
            disabled={loading}
          />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !numeroFactura.trim() || !archivo}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Registrar y Notificar
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
