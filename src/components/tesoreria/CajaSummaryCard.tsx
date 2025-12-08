
import { useNavigate } from 'react-router-dom';
import { Wallet, DollarSign, TrendingUp, TrendingDown, ClipboardCheck, ArrowRightLeft, Banknote, Landmark, History } from 'lucide-react';
import type { CajaConMediosCobro } from '../../types/medios-cobro';
import { Button } from '../ui/Button';

interface CajaSummaryCardProps {
  caja: CajaConMediosCobro;
  onClick?: () => void;
  onClickArqueo?: (caja: CajaConMediosCobro) => void;
  onTransferir?: (caja: CajaConMediosCobro) => void;
  onHistory?: (caja: CajaConMediosCobro) => void;
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

export function CajaSummaryCard({ caja, onClickArqueo, onTransferir, onHistory }: CajaSummaryCardProps) {
  const navigate = useNavigate(); // Added useNavigate
  const Icon = TIPO_ICONS[caja.tipo]; // This line is kept from original, but the new JSX doesn't use it directly for the main icon.
  const saldo = Number(caja.saldo_actual);
  const ingresosHoy = caja.ingresos_hoy || 0;
  const egresosHoy = caja.egresos_hoy || 0;
  const colorClass = TIPO_COLORS[caja.tipo]; // This line is kept from original, but the new JSX doesn't use it.

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p - 2.5 rounded - lg ${caja.es_principal ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'} `}>
            {caja.es_principal ? <Wallet className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{caja.nombre}</h3>
            <p className="text-sm text-gray-500 capitalize">{caja.tipo.replace('_', ' ')}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {onTransferir && (
            <Button
              size="sm"
              variant="outline"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
              onClick={(e) => {
                e.stopPropagation();
                onTransferir(caja);
              }}
              title="Transferir Fondos"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </Button>
          )}

          {onClickArqueo && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                onClickArqueo(caja);
              }}
            >
              <ClipboardCheck className="w-4 h-4" />
              Arqueo
            </Button>
          )}

          {onHistory && (
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-500 hover:text-gray-700 p-2"
              onClick={(e) => {
                e.stopPropagation();
                onHistory(caja);
              }}
              title="Ver Historial"
            >
              <History className="w-5 h-5" />
            </Button>
          )}
        </div>
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
