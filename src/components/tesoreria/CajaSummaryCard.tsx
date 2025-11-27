import { Wallet, Landmark, Banknote, TrendingUp, TrendingDown } from 'lucide-react';
import type { CajaConMediosCobro } from '../../types/medios-cobro';

interface CajaSummaryCardProps {
  caja: CajaConMediosCobro;
  onClick?: () => void;
}

const TIPO_ICONS = {
  efectivo: Banknote,
  banco: Landmark,
  pasarela: Wallet,
};

const TIPO_COLORS = {
  efectivo: 'bg-green-50 border-green-200',
  banco: 'bg-blue-50 border-blue-200',
  pasarela: 'bg-purple-50 border-purple-200',
};

export function CajaSummaryCard({ caja, onClick }: CajaSummaryCardProps) {
  const Icon = TIPO_ICONS[caja.tipo];
  const saldo = Number(caja.saldo_actual);
  const ingresosHoy = caja.ingresos_hoy || 0;
  const egresosHoy = caja.egresos_hoy || 0;
  const colorClass = TIPO_COLORS[caja.tipo];

  return (
    <div
      onClick={onClick}
      className={`${colorClass} border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] bg-white`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon className="w-4 h-4 text-gray-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 text-sm truncate">{caja.nombre}</h3>
            {caja.identificador && (
              <p className="text-xs text-gray-500 truncate">{caja.identificador}</p>
            )}
          </div>
        </div>
        {caja.es_principal && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2">
            Principal
          </span>
        )}
      </div>

      {/* Saldo */}
      <div className="mb-3">
        <p className="text-xl font-bold text-gray-900">
          ${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-gray-500 font-medium">{caja.moneda}</p>
      </div>

      {/* Movimientos del día */}
      {(ingresosHoy > 0 || egresosHoy > 0) && (
        <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
          {ingresosHoy > 0 && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="font-medium">+${ingresosHoy.toLocaleString('es-AR')}</span>
            </div>
          )}
          {egresosHoy > 0 && (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <TrendingDown className="w-3.5 h-3.5" />
              <span className="font-medium">-${egresosHoy.toLocaleString('es-AR')}</span>
            </div>
          )}
        </div>
      )}

      {/* Sin movimientos hoy */}
      {ingresosHoy === 0 && egresosHoy === 0 && (
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">Sin movimientos hoy</p>
        </div>
      )}
    </div>
  );
}
