import { useState } from 'react';
import { Search, Filter, Users } from 'lucide-react';
import { useCuentasCorrientes } from '../../../hooks/useCuentasCorrientes';
import { ClienteCard } from '../../../components/finanzas/ClienteCard';
import { EstadoCuentaModal } from '../../../components/finanzas/EstadoCuentaModal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import type { Client } from '../../../types/database';

export default function CuentasCorrientesView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<'al_dia' | 'proximo_vencer' | 'vencido' | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Client | null>(null);
  const [isEstadoCuentaOpen, setIsEstadoCuentaOpen] = useState(false);

  const { clientes, loading } = useCuentasCorrientes({
    searchTerm,
    estadoCC: estadoFilter,
  });

  const handleVerEstadoCuenta = (cliente: any) => {
    setSelectedCliente(cliente);
    setIsEstadoCuentaOpen(true);
  };

  const handleNuevaLiquidacion = (cliente: any) => {
    console.log('Nueva liquidación para:', cliente);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <Input
            type="text"
            placeholder="Buscar por nombre, razón social o documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-64 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
            <Filter className="w-5 h-5 text-gray-400" />
          </div>
          <Select
            value={estadoFilter || ''}
            onChange={(e) => setEstadoFilter((e.target.value as any) || null)}
            className="pl-10"
          >
            <option value="">Todos los estados</option>
            <option value="al_dia">Al día</option>
            <option value="proximo_vencer">Próximo a vencer</option>
            <option value="vencido">Vencido</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 h-48 rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : clientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay clientes con cuenta corriente"
          description={
            searchTerm || estadoFilter
              ? 'No se encontraron clientes con los filtros aplicados'
              : 'Aún no hay clientes con cuenta corriente habilitada'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientes.map((cliente) => (
              <ClienteCard
                key={cliente.id}
                cliente={cliente}
                onVerEstadoCuenta={() => handleVerEstadoCuenta(cliente)}
                onNuevaLiquidacion={() => handleNuevaLiquidacion(cliente)}
              />
            ))}
          </div>

          <div className="text-center text-sm text-gray-600">
            Mostrando {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'} con cuenta corriente
          </div>
        </>
      )}

      <EstadoCuentaModal
        isOpen={isEstadoCuentaOpen}
        onClose={() => setIsEstadoCuentaOpen(false)}
        cliente={selectedCliente}
      />
    </div>
  );
}
