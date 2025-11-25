import { useState } from 'react';
import { X, Download, Calendar } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useEstadoCuenta } from '../../hooks/useCuentasCorrientes';
import { generateEstadoCuentaPDF } from '../../utils/pdfGenerators/estadoCuentaPDF';
import { useAuth } from '../../hooks/useAuth';
import type { Client } from '../../types/database';
import dayjs from 'dayjs';
import { DatePicker } from '../ui/DatePicker';

interface EstadoCuentaModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Client | null;
}

export function EstadoCuentaModal({ isOpen, onClose, cliente }: EstadoCuentaModalProps) {
  const { company } = useAuth();
  const [fechaDesde, setFechaDesde] = useState<Date | null>(dayjs().subtract(30, 'days').toDate());
  const [fechaHasta, setFechaHasta] = useState<Date | null>(dayjs().toDate());
  const [isExporting, setIsExporting] = useState(false);

  const { movimientos, loading, saldoInicial, saldoFinal, fetchEstadoCuenta } = useEstadoCuenta(
    cliente?.id || ''
  );

  const handleFiltrar = () => {
    if (!cliente) return;

    fetchEstadoCuenta(
      fechaDesde ? dayjs(fechaDesde).format('YYYY-MM-DD') : undefined,
      fechaHasta ? dayjs(fechaHasta).format('YYYY-MM-DD') : undefined
    );
  };

  const handleExportPDF = async () => {
    if (!cliente || !company) return;

    setIsExporting(true);
    try {
      await generateEstadoCuentaPDF({
        cliente,
        company,
        movimientos,
        saldoInicial,
        saldoFinal,
        fechaDesde: fechaDesde ? dayjs(fechaDesde).format('DD/MM/YYYY') : 'Inicio',
        fechaHasta: fechaHasta ? dayjs(fechaHasta).format('DD/MM/YYYY') : dayjs().format('DD/MM/YYYY'),
      });
    } catch (error) {
      console.error('Error al exportar PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!cliente) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Estado de Cuenta" size="xl">
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">{cliente.nombre_fantasia}</h3>
          <p className="text-sm text-blue-700">{cliente.razon_social}</p>
          <p className="text-sm text-blue-700">{cliente.numero_documento}</p>
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Desde
            </label>
            <DatePicker
              selected={fechaDesde}
              onChange={setFechaDesde}
              placeholder="Fecha desde"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Hasta
            </label>
            <DatePicker
              selected={fechaHasta}
              onChange={setFechaHasta}
              placeholder="Fecha hasta"
            />
          </div>

          <Button onClick={handleFiltrar} disabled={loading}>
            Filtrar
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 p-3 border-b">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Saldo Inicial</span>
              <span className={`font-bold ${saldoInicial >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${saldoInicial.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Descripción
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Debe
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Haber
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Cargando movimientos...
                    </td>
                  </tr>
                ) : movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No hay movimientos en el período seleccionado
                    </td>
                  </tr>
                ) : (
                  movimientos.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {dayjs(mov.fecha).format('DD/MM/YYYY')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            mov.tipo_movimiento === 'cargo'
                              ? 'bg-red-100 text-red-800'
                              : mov.tipo_movimiento === 'pago'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {mov.tipo_movimiento}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{mov.descripcion}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">
                        {mov.monto_debe > 0 ? `$${mov.monto_debe.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                        {mov.monto_haber > 0 ? `$${mov.monto_haber.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                        ${mov.saldo_acumulado.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 p-3 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Saldo Final</span>
              <span className={`text-lg font-bold ${saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${saldoFinal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cerrar
          </Button>
          <Button
            variant="primary"
            onClick={handleExportPDF}
            disabled={isExporting || loading}
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Generando PDF...' : 'Exportar PDF'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
