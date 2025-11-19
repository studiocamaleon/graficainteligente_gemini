import { MessageSquare, Globe, Store, User, Calendar } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import { Tooltip } from '../ui/Tooltip';
import { useClients } from '../../hooks/useClients';
import { useRef } from 'react';
import type { CanalVenta } from '../../types/database';

interface OrdenGeneralSectionProps {
  clienteId: string;
  setClienteId: (id: string) => void;
  canalVenta: CanalVenta;
  setCanalVenta: (canal: CanalVenta) => void;
  fechaEntrega: string;
  setFechaEntrega: (fecha: string) => void;
  notasInternas: string;
  setNotasInternas: (notas: string) => void;
  requiereFactura: boolean;
  setRequiereFactura: (requiere: boolean) => void;
  usuarioLogueado: string;
  errors?: Record<string, string>;
}

export function OrdenGeneralSection({
  clienteId,
  setClienteId,
  canalVenta,
  setCanalVenta,
  fechaEntrega,
  setFechaEntrega,
  notasInternas,
  setNotasInternas,
  requiereFactura,
  setRequiereFactura,
  usuarioLogueado,
  errors = {},
}: OrdenGeneralSectionProps) {
  const { clients, loading } = useClients();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const canalesVenta: { value: CanalVenta; label: string; icon: any }[] = [
    { value: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare },
    { value: 'Web', label: 'Web', icon: Globe },
    { value: 'Mostrador', label: 'Mostrador', icon: Store },
  ];

  const clientesOptions = [
    { value: '', label: 'Seleccione un cliente' },
    ...clients.map(c => ({
      value: c.id,
      label: `${c.nombre_fantasia} (${c.numero_documento})`,
    }))
  ];

  const minFecha = new Date().toISOString().split('T')[0];

  const handleDateContainerClick = () => {
    dateInputRef.current?.showPicker();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-900">Datos Generales</h3>
        <div className="flex items-center space-x-3">
          <Switch
            checked={requiereFactura}
            onChange={setRequiereFactura}
            label="Requiere factura"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cliente <span className="text-red-500">*</span>
          </label>
          <Select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            options={clientesOptions}
            disabled={loading}
            className={errors.cliente ? 'border-red-500' : ''}
          />
          {errors.cliente && (
            <p className="mt-1 text-sm text-red-600">{errors.cliente}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Canal de Venta <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-3">
            {canalesVenta.map(canal => {
              const Icon = canal.icon;
              const isSelected = canalVenta === canal.value;

              return (
                <Tooltip key={canal.value} content={canal.label} position="top">
                  <button
                    type="button"
                    onClick={() => setCanalVenta(canal.value)}
                    className={`
                      flex items-center justify-center p-4 rounded-lg border-2 transition-all
                      ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="w-6 h-6" />
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Creado por
          </label>
          <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
            <User className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-700">{usuarioLogueado}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fecha Estimada de Entrega
          </label>
          <div
            onClick={handleDateContainerClick}
            className={`
              relative flex items-center cursor-pointer rounded-lg border transition-colors
              ${errors.fechaEntrega ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'}
            `}
          >
            <input
              ref={dateInputRef}
              type="date"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
              min={minFecha}
              className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
            <Calendar className="absolute right-3 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
          {errors.fechaEntrega && (
            <p className="mt-1 text-sm text-red-600">{errors.fechaEntrega}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notas Internas
        </label>
        <textarea
          value={notasInternas}
          onChange={(e) => setNotasInternas(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Agrega notas internas sobre esta orden..."
        />
      </div>
    </div>
  );
}
