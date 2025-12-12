import { useEffect, useState } from 'react';
import { UserCircle, Calendar, Phone } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { useClients } from '../../hooks/useClients';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import type { CanalVenta } from '../../types/presupuestos';

interface PresupuestoGeneralSectionProps {
  clienteId: string;
  vendedorId: string;
  canalVenta: CanalVenta;
  fechaValidez: string;
  notasInternas: string;
  onClienteChange: (id: string) => void;
  onVendedorChange: (id: string) => void;
  onCanalVentaChange: (canal: CanalVenta) => void;
  onFechaValidezChange: (fecha: string) => void;
  onNotasInternasChange: (notas: string) => void;
  errors?: Record<string, string>;
}

export function PresupuestoGeneralSection({
  clienteId,
  vendedorId,
  canalVenta,
  fechaValidez,
  notasInternas,
  onClienteChange,
  onVendedorChange,
  onCanalVentaChange,
  onFechaValidezChange,
  onNotasInternasChange,
  errors = {},
}: PresupuestoGeneralSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { clients } = useClients({ searchTerm, itemsPerPage: 1000 });
  const { members: teamMembers } = useTeamMembers();

  // Obtener vendedores (admin, super_admin, vendedor)
  const vendedores = (teamMembers || []).filter((member) =>
    ['vendedor', 'admin', 'super_admin'].includes(member.role)
  );

  const clienteOptions = (clients || []).map((client) => ({
    value: client.id,
    label: client.nombre_fantasia || client.razon_social,
    subtitle: client.nombre_fantasia ? client.razon_social : undefined,
  }));

  const vendedorOptions = [
    { value: '', label: 'Seleccionar vendedor' },
    ...vendedores.map((v) => ({
      value: v.id,
      label: v.full_name,
    })),
  ];

  const canalOptions = [
    { value: '', label: 'Seleccionar canal' },
    { value: 'Web', label: '🌐 Web' },
    { value: 'WhatsApp', label: '💬 WhatsApp' },
    { value: 'Mostrador', label: '🏪 Mostrador' },
    { value: 'App Mobile', label: '📱 App Mobile' },
  ];

  // Cliente seleccionado
  const clienteSeleccionado = clients.find((c) => c.id === clienteId);

  // Calcular fecha mínima (hoy)
  const today = new Date().toISOString().split('T')[0];

  // Calcular fecha default (15 días desde hoy)
  const defaultFechaValidez = () => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    // Si no hay fecha validez, establecer default
    if (!fechaValidez) {
      onFechaValidezChange(defaultFechaValidez());
    }
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Información General
        </h2>
        <p className="text-sm text-gray-500">
          Completa los datos básicos para iniciar el presupuesto.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Columna Izquierda: Cliente y Vendedor (8 columnas) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">

          {/* Fila 1: Cliente */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <UserCircle className="w-4 h-4 text-blue-600" />
              Cliente *
            </label>
            <SearchableSelect
              options={clienteOptions}
              value={clienteId}
              onChange={onClienteChange}
              placeholder="Buscar cliente..." // Updated placeholder
              loading={false}
              onSearch={setSearchTerm}
              error={errors.clienteId}
            />
            {errors.clienteId && (
              <p className="mt-1 text-sm text-red-600">{errors.clienteId}</p>
            )}

            {/* Info del cliente seleccionado - Compacta e integrada */}
            {clienteSeleccionado && (
              <div className="mt-4 flex flex-wrap gap-4 pt-4 border-t border-gray-100">
                {clienteSeleccionado.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
                    <UserCircle className="w-4 h-4 text-gray-400" />
                    <span>{clienteSeleccionado.email}</span>
                  </div>
                )}
                {clienteSeleccionado.whatsapp && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-green-50 px-3 py-1.5 rounded-full">
                    <Phone className="w-4 h-4 text-green-500" />
                    <span>{clienteSeleccionado.whatsapp}</span>
                  </div>
                )}
                {clienteSeleccionado.domicilio && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
                    <span className="text-gray-400">📍</span>
                    <span>{clienteSeleccionado.domicilio}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fila 2: Detalles Operativos (Grid interno) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vendedor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Vendedor / Responsable *
              </label>
              <div className="relative">
                <Select
                  value={vendedorId}
                  onChange={(value) => onVendedorChange(value)}
                  options={vendedorOptions}
                />
                {/* Icon decoration could go here if Select supported icons natively in prop */}
              </div>
              {errors.vendedorId && (
                <p className="mt-1 text-sm text-red-600">{errors.vendedorId}</p>
              )}
            </div>

            {/* Canal de venta */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Canal de Venta *
              </label>
              <Select
                value={canalVenta}
                onChange={(value) => onCanalVentaChange(value as CanalVenta)}
                options={canalOptions}
              />
              {errors.canalVenta && (
                <p className="mt-1 text-sm text-red-600">{errors.canalVenta}</p>
              )}
            </div>

            {/* Fecha de validez */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Válido hasta *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="date"
                  value={fechaValidez}
                  onChange={(e) => onFechaValidezChange(e.target.value)}
                  min={today}
                  className="pl-9"
                />
              </div>
              {errors.fechaValidez && (
                <p className="mt-1 text-sm text-red-600">{errors.fechaValidez}</p>
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Notas Internas (4 columnas) */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-yellow-50/50 p-5 rounded-xl border border-yellow-100 h-full flex flex-col">
            <label className="block text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
              <span>📝</span>
              Notas Internas
            </label>
            <p className="text-xs text-yellow-700 mb-3 opacity-80">
              Información visible solo para el equipo. No se mostrará al cliente.
            </p>
            <textarea
              value={notasInternas}
              onChange={(e) => onNotasInternasChange(e.target.value)}
              placeholder="Ej: Cliente pide entrega urgente, revisar stock de papel..."
              className="flex-1 w-full px-3 py-2 border border-yellow-200 bg-white/50 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none text-sm placeholder:text-yellow-700/40"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
