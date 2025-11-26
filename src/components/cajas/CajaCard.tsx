import { Wallet, Building2, Globe, Edit2, Trash2, TrendingUp, TrendingDown, Star } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { CajaConMediosCobro } from '../../types/medios-cobro';

interface CajaCardProps {
  caja: CajaConMediosCobro;
  onEdit?: (caja: CajaConMediosCobro) => void;
  onDelete?: (id: string) => void;
  onClick?: (caja: CajaConMediosCobro) => void;
}

const TIPO_ICONS = {
  efectivo: Wallet,
  banco: Building2,
  virtual: Globe,
};

const TIPO_COLORS = {
  efectivo: 'bg-green-100 text-green-800',
  banco: 'bg-blue-100 text-blue-800',
  virtual: 'bg-purple-100 text-purple-800',
};

export function CajaCard({ caja, onEdit, onDelete, onClick }: CajaCardProps) {
  const Icon = TIPO_ICONS[caja.tipo as keyof typeof TIPO_ICONS] || Wallet;
  const colorClass = TIPO_COLORS[caja.tipo as keyof typeof TIPO_COLORS] || 'bg-gray-100 text-gray-800';

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: caja.moneda || 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div
      className={`bg-white rounded-lg border-2 ${
        onClick ? 'cursor-pointer hover:border-blue-500' : 'border-gray-200'
      } hover:shadow-lg transition-all duration-200 p-6`}
      onClick={() => onClick?.(caja)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${colorClass}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{caja.nombre}</h3>
              {caja.es_principal && (
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              )}
            </div>
            <p className="text-sm text-gray-500 capitalize">{caja.tipo}</p>
          </div>
        </div>

        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(caja)}
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(caja.id)}
                title="Eliminar"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Saldo */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-1">Saldo Actual</p>
        <p className="text-2xl font-bold text-gray-900">
          {formatMoney(caja.saldo_actual)}
        </p>
      </div>

      {/* Movimientos del día */}
      {(caja.ingresos_hoy !== undefined || caja.egresos_hoy !== undefined) && (
        <div className="grid grid-cols-2 gap-4 mb-4 pt-4 border-t border-gray-200">
          <div>
            <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span>Ingresos hoy</span>
            </div>
            <p className="font-semibold text-green-600">
              {formatMoney(caja.ingresos_hoy || 0)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span>Egresos hoy</span>
            </div>
            <p className="font-semibold text-red-600">
              {formatMoney(caja.egresos_hoy || 0)}
            </p>
          </div>
        </div>
      )}

      {/* Medios de cobro asociados */}
      {caja.medios_cobro && caja.medios_cobro.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-2">Medios de cobro asociados:</p>
          <div className="flex flex-wrap gap-2">
            {caja.medios_cobro.map((medio) => (
              <Badge key={medio.id} variant="secondary" size="sm">
                {medio.nombre}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notas */}
      {caja.notas && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 italic">{caja.notas}</p>
        </div>
      )}

      {/* Estado */}
      {!caja.is_active && (
        <div className="mt-4">
          <Badge variant="secondary">Inactiva</Badge>
        </div>
      )}
    </div>
  );
}
