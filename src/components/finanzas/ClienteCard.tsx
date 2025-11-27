import { AlertCircle, CheckCircle, Clock, DollarSign, Calendar } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { ClienteConSaldo } from '../../types/database';
import { calcularProximoCierre, getDescripcionAcuerdo } from '../../utils/liquidacionHelpers';

interface ClienteCardProps {
  cliente: ClienteConSaldo;
  onVerEstadoCuenta: () => void;
  onNuevaLiquidacion: () => void;
}

export function ClienteCard({ cliente, onVerEstadoCuenta, onNuevaLiquidacion }: ClienteCardProps) {
  const getBadgeColor = () => {
    switch (cliente.estado_cc) {
      case 'al_dia':
        return 'bg-green-100 text-green-800';
      case 'proximo_vencer':
        return 'bg-yellow-100 text-yellow-800';
      case 'vencido':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (cliente.estado_cc) {
      case 'al_dia':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'proximo_vencer':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'vencido':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getEstadoTexto = () => {
    switch (cliente.estado_cc) {
      case 'al_dia':
        return 'Al día';
      case 'proximo_vencer':
        return 'Próximo a vencer';
      case 'vencido':
        return 'Vencido';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{cliente.nombre_fantasia}</h3>
          <p className="text-sm text-gray-600">{cliente.razon_social}</p>
          <p className="text-sm text-gray-500">{cliente.numero_documento}</p>
        </div>
        <Badge className={getBadgeColor()}>
          <span className="flex items-center gap-1">
            {getIcon()}
            {getEstadoTexto()}
          </span>
        </Badge>
      </div>

      <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
        <DollarSign className="w-5 h-5 text-gray-600" />
        <div className="flex-1">
          <p className="text-xs text-gray-600">Saldo Actual</p>
          <p className={`text-xl font-bold ${cliente.saldo_actual > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ${cliente.saldo_actual.toFixed(2)}
          </p>
        </div>
        {cliente.acuerdo_pago && (
          <div className="text-right">
            <p className="text-xs text-gray-600">Acuerdo</p>
            <p className="text-sm font-medium text-gray-900">{cliente.acuerdo_pago}</p>
          </div>
        )}
      </div>

      {cliente.acuerdo_pago && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <div className="flex-1">
              <p className="text-xs text-blue-600 font-medium">
                Próximo cierre: {calcularProximoCierre(cliente as any)}
              </p>
              <p className="text-xs text-blue-500">
                {getDescripcionAcuerdo(cliente as any)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onVerEstadoCuenta}
          className="flex-1"
        >
          Ver Estado
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onNuevaLiquidacion}
          className="flex-1"
        >
          Nueva Liquidación
        </Button>
      </div>
    </Card>
  );
}
