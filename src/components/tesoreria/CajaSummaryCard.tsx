import { Wallet, Landmark, CreditCard, Banknote, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../ui/Card';
import type { Caja, CajaConMediosCobro } from '../../types/medios-cobro';

interface CajaSummaryCardProps {
  caja: CajaConMediosCobro;
  onClick?: () => void;
}

const TIPO_ICONS = {
  efectivo: Banknote,
  banco: Landmark,
  pasarela: Wallet,
};

export function CajaSummaryCard({ caja, onClick }: CajaSummaryCardProps) {
  const Icon = TIPO_ICONS[caja.tipo];
  const saldo = Number(caja.saldo_actual);
  const ingresosHoy = caja.ingresos_hoy || 0;
  const egresosHoy = caja.egresos_hoy || 0;

  return (
    <Card
      hover
      padding="md"
      onClick={onClick}
      className="cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-4 h-4 text-gray-600" />
            <h3 className="font-medium text-gray-900">{caja.nombre}</h3>
          </div>
          <p className="text-xs text-gray-500">{caja.identificador || `Tipo: ${caja.tipo}`}</p>
        </div>
        {caja.es_principal && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            Principal
          </span>
        )}
      </div>

      <div className="mb-3">
        <p className="text-2xl font-bold text-gray-900">
          ${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-gray-500">{caja.moneda}</p>
      </div>

      {(ingresosHoy > 0 || egresosHoy > 0) && (
        <div className="flex items-center justify-between text-xs pt-3 border-t border-gray-100">
          {ingresosHoy > 0 && (
            <div className="flex items-center gap-1 text-green-600">
              <TrendingUp className="w-3 h-3" />
              <span>+${ingresosHoy.toLocaleString('es-AR')}</span>
            </div>
          )}
          {egresosHoy > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <TrendingDown className="w-3 h-3" />
              <span>-${egresosHoy.toLocaleString('es-AR')}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
