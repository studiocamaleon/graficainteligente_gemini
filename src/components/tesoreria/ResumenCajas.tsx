import { Banknote, Landmark, Wallet } from 'lucide-react';
import { CajaSummaryCard } from './CajaSummaryCard';
import type { ResumenCajaPorTipo } from '../../types/medios-cobro';

interface ResumenCajasProps {
  resumenPorTipo: ResumenCajaPorTipo[];
  totalSaldo: number;
  onCajaClick?: (cajaId: string) => void;
}

const TIPO_LABELS = {
  efectivo: 'Efectivo',
  banco: 'Bancos',
  pasarela: 'Pasarelas de Pago',
};

const TIPO_ICONS = {
  efectivo: Banknote,
  banco: Landmark,
  pasarela: Wallet,
};

const TIPO_COLORS = {
  efectivo: 'bg-green-50 text-green-700 border-green-200',
  banco: 'bg-blue-50 text-blue-700 border-blue-200',
  pasarela: 'bg-purple-50 text-purple-700 border-purple-200',
};

export function ResumenCajas({ resumenPorTipo, totalSaldo, onCajaClick }: ResumenCajasProps) {
  return (
    <div className="space-y-6">
      {/* Total General */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <p className="text-sm font-medium text-blue-100 mb-1">Saldo Total Disponible</p>
        <p className="text-4xl font-bold">
          ${totalSaldo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-blue-100 mt-2">
          {resumenPorTipo.reduce((sum, r) => sum + r.cantidad_cajas, 0)} cajas activas
        </p>
      </div>

      {/* Por Tipo */}
      {resumenPorTipo.map((resumen) => {
        const Icon = TIPO_ICONS[resumen.tipo];
        const colorClass = TIPO_COLORS[resumen.tipo];

        return (
          <div key={resumen.tipo}>
            <div className={`flex items-center justify-between p-3 rounded-lg border ${colorClass} mb-3`}>
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5" />
                <h3 className="font-semibold">{TIPO_LABELS[resumen.tipo]}</h3>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">
                  ${resumen.total_saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs opacity-75">{resumen.cantidad_cajas} {resumen.cantidad_cajas === 1 ? 'caja' : 'cajas'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resumen.cajas.map((caja) => (
                <CajaSummaryCard
                  key={caja.id}
                  caja={caja}
                  onClick={() => onCajaClick?.(caja.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {resumenPorTipo.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No hay cajas configuradas</p>
          <p className="text-sm mt-1">Las cajas se crean automáticamente al configurar medios de cobro</p>
        </div>
      )}
    </div>
  );
}
