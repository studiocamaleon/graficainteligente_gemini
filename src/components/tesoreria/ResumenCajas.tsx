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
  efectivo: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: 'text-green-600',
  },
  banco: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: 'text-blue-600',
  },
  pasarela: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    icon: 'text-purple-600',
  },
};

export function ResumenCajas({ resumenPorTipo, totalSaldo, onCajaClick }: ResumenCajasProps) {
  const totalCajas = resumenPorTipo.reduce((sum, r) => sum + r.cantidad_cajas, 0);

  return (
    <div className="space-y-6">
      {/* Total General - Diseño Moderno */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-300 mb-1">Saldo Total Disponible</p>
            <p className="text-3xl font-bold text-white">
              ${totalSaldo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <p className="text-2xl font-bold text-white">{totalCajas}</p>
              <p className="text-xs text-slate-300">{totalCajas === 1 ? 'caja' : 'cajas'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen por Tipo - Compacto */}
      {resumenPorTipo.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {resumenPorTipo.map((resumen) => {
            const Icon = TIPO_ICONS[resumen.tipo];
            const colors = TIPO_COLORS[resumen.tipo];

            return (
              <div
                key={resumen.tipo}
                className={`${colors.bg} ${colors.border} border rounded-lg p-4 transition-all hover:shadow-md`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`${colors.bg} p-2 rounded-lg border ${colors.border}`}>
                    <Icon className={`w-5 h-5 ${colors.icon}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold ${colors.text}`}>{TIPO_LABELS[resumen.tipo]}</h3>
                    <p className="text-xs text-gray-500">
                      {resumen.cantidad_cajas} {resumen.cantidad_cajas === 1 ? 'caja' : 'cajas'}
                    </p>
                  </div>
                </div>
                <p className={`text-2xl font-bold ${colors.text}`}>
                  ${resumen.total_saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Detalle de Cajas por Tipo */}
      {resumenPorTipo.map((resumen) => {
        const Icon = TIPO_ICONS[resumen.tipo];
        const colors = TIPO_COLORS[resumen.tipo];

        return (
          <div key={`detail-${resumen.tipo}`} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${colors.icon}`} />
              <h4 className="font-medium text-gray-700">{TIPO_LABELS[resumen.tipo]}</h4>
              <span className="text-xs text-gray-500">
                ({resumen.cantidad_cajas} {resumen.cantidad_cajas === 1 ? 'caja' : 'cajas'})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No hay cajas configuradas</p>
          <p className="text-sm mt-1">Las cajas se crean automáticamente al configurar medios de cobro</p>
        </div>
      )}
    </div>
  );
}
