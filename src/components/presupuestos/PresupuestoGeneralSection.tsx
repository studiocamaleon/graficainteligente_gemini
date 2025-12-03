import { useEffect } from 'react';
import { User, UserCircle, Calendar, Phone } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SearchableSelect } from '../ui/SearchableSelect';
import { DatePicker } from '../ui/DatePicker';
import { useClients } from '../../hooks/useClients';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import type { CanalVenta } from '../../types/presupuestos';

interface PresupuestoGeneralSectionProps {
  clienteId: string;
  vendedorId: string;
  canalVenta: CanalVenta;
  fechaEntregaEstimada: string;
  fechaValidez: string;
  notasInternas: string;
  onClienteChange: (id: string) => void;
  onVendedorChange: (id: string) => void;
  onCanalVentaChange: (canal: CanalVenta) => void;
  onFechaEntregaEstimadaChange: (fecha: string) => void;
  onFechaValidezChange: (fecha: string) => void;
  onNotasInternasChange: (notas: string) => void;
  errors?: Record<string, string>;
}

export function PresupuestoGeneralSection({
  clienteId,
  vendedorId,
  canalVenta,
  fechaEntregaEstimada,
  fechaValidez,
  notasInternas,
  onClienteChange,
  onVendedorChange,
  onCanalVentaChange,
  onFechaEntregaEstimadaChange,
  onFechaValidezChange,
  onNotasInternasChange,
  errors = {},
}: PresupuestoGeneralSectionProps) {
  const { clients } = useClients();
  const { members: teamMembers } = useTeamMembers();

  // Obtener vendedores (admin, super_admin, vendedor)
  const vendedores = (teamMembers || []).filter((member) =>
    ['vendedor', 'admin', 'super_admin'].includes(member.role)
  );

  const clienteOptions = (clients || []).map((client) => ({
    value: client.id,
    label: client.razon_social,
    subtitle: client.email || client.whatsapp || undefined,
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Información General
        </h2>
        <p className="text-sm text-gray-600">
          Datos básicos del presupuesto
        </p>
      </div>

      {/* Cliente */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cliente *
        </label>
        <SearchableSelect
          options={clienteOptions}
          value={clienteId}
          onChange={onClienteChange}
          placeholder="Buscar cliente..."
          error={errors.clienteId}
          icon={User}
        />
        {errors.clienteId && (
          <p className="mt-1 text-sm text-red-600">{errors.clienteId}</p>
        )}

        {/* Info del cliente seleccionado */}
        {clienteSeleccionado && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="space-y-2">
              {clienteSeleccionado.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <UserCircle className="w-4 h-4" />
                  <span>{clienteSeleccionado.email}</span>
                </div>
              )}
              {clienteSeleccionado.whatsapp && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>{clienteSeleccionado.whatsapp}</span>
                </div>
              )}
              {clienteSeleccionado.domicilio && (
                <div className="text-sm text-gray-600">
                  {clienteSeleccionado.domicilio}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vendedor y Canal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vendedor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vendedor *
          </label>
          <Select
            value={vendedorId}
            onChange={(value) => onVendedorChange(value)}
            options={vendedorOptions}
          />
          {errors.vendedorId && (
            <p className="mt-1 text-sm text-red-600">{errors.vendedorId}</p>
          )}
        </div>

        {/* Canal de venta */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
      </div>

      {/* Fecha de entrega estimada */}
      <div>
        <DatePicker
          label="Fecha de Entrega Estimada"
          value={fechaEntregaEstimada}
          onChange={(date) => onFechaEntregaEstimadaChange(date || '')}
          minDate={new Date()}
          error={errors.fechaEntregaEstimada}
          placeholder="Seleccionar fecha de entrega"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Fecha estimada en que se completará el trabajo
        </p>
      </div>

      {/* Fecha de validez */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Fecha de Validez *
        </label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="date"
            value={fechaValidez}
            onChange={(e) => onFechaValidezChange(e.target.value)}
            min={today}
            className="pl-10"
          />
        </div>
        {errors.fechaValidez && (
          <p className="mt-1 text-sm text-red-600">{errors.fechaValidez}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          El presupuesto será válido hasta esta fecha
        </p>
      </div>

      {/* Notas internas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notas Internas
        </label>
        <textarea
          value={notasInternas}
          onChange={(e) => onNotasInternasChange(e.target.value)}
          placeholder="Notas que solo verás tú y tu equipo (no aparecerán en el presupuesto del cliente)..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          {notasInternas.length} caracteres
        </p>
      </div>
    </div>
  );
}
