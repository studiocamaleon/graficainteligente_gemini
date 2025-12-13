import { useState } from 'react';
import { MessageSquare, Globe, Store, User, Smartphone, Truck } from 'lucide-react';
import { SearchableSelect } from '../ui/SearchableSelect';
import { DatePicker } from '../ui/DatePicker';
import { Tooltip } from '../ui/Tooltip';

import { useClients } from '../../hooks/useClients';
import type { CanalVenta, Client } from '../../types/database';

interface OrdenGeneralSectionProps {
  clienteId: string;
  setClienteId: (id: string) => void;
  selectedClient?: Client;
  canalVenta: CanalVenta;
  setCanalVenta: (canal: CanalVenta) => void;
  fechaEntrega: string;
  setFechaEntrega: (fecha: string) => void;
  requiereDespacho?: boolean;
  setRequiereDespacho?: (requiere: boolean) => void;
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
  selectedClient,
  canalVenta,
  setCanalVenta,
  fechaEntrega,
  setFechaEntrega,
  requiereDespacho = false,
  setRequiereDespacho,
  notasInternas,
  setNotasInternas,
  requiereFactura,
  setRequiereFactura,
  usuarioLogueado,
  errors = {},
}: OrdenGeneralSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { clients, loading } = useClients({ searchTerm, itemsPerPage: 50 });

  const canalesVenta: { value: CanalVenta; label: string; icon: any }[] = [
    { value: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare },
    { value: 'Web', label: 'Web', icon: Globe },
    { value: 'Mostrador', label: 'Mostrador', icon: Store },
    { value: 'App Mobile', label: 'App Mobile', icon: Smartphone },
  ];

  const clientesOptions = clients.map(c => ({
    value: c.id,
    label: c.nombre_fantasia || c.razon_social,
    subtitle: c.nombre_fantasia ? c.razon_social : undefined,
  }));

  // Ensure selected client is always in options (for display purposes)
  if (selectedClient && !clientesOptions.find(o => o.value === selectedClient.id)) {
    clientesOptions.unshift({
      value: selectedClient.id,
      label: selectedClient.nombre_fantasia || selectedClient.razon_social,
      subtitle: selectedClient.nombre_fantasia ? selectedClient.razon_social : undefined,
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-900">Datos Generales</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <SearchableSelect
            label="Cliente"
            value={clienteId}
            onChange={(value) => setClienteId(value)}
            options={clientesOptions}
            placeholder="Buscar cliente por nombre..."
            loading={loading}
            disabled={loading}
            required
            error={errors.cliente}
            emptyMessage="No se encontraron clientes"
            onSearch={setSearchTerm}
          />
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
                      ${isSelected
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

        <DatePicker
          label="Fecha Estimada de Entrega"
          value={fechaEntrega}
          onChange={(date) => setFechaEntrega(date || '')}
          minDate={new Date()}
          error={errors.fechaEntrega}
          placeholder="Seleccionar fecha de entrega"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Entrega
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRequiereDespacho && setRequiereDespacho(false)}
              className={`
                flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all gap-2
                ${!requiereDespacho
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }
              `}
            >
              <Store className="w-5 h-5" />
              <span className="text-sm font-medium">Retiro en Local</span>
            </button>
            <button
              type="button"
              onClick={() => setRequiereDespacho && setRequiereDespacho(true)}
              className={`
                flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all gap-2
                ${requiereDespacho
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }
              `}
            >
              <Truck className="w-5 h-5" />
              <span className="text-sm font-medium">Envío a Domicilio</span>
            </button>
          </div>
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
