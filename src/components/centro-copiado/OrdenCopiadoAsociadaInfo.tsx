import { ExternalLink, Info, DollarSign, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface OrdenCopiadoAsociadaInfoProps {
  ordenTrabajoId: string;
  ordenTrabajoNumero: string;
  totalOrdenCopiado: number;
}

export function OrdenCopiadoAsociadaInfo({
  ordenTrabajoId,
  ordenTrabajoNumero,
  totalOrdenCopiado,
}: OrdenCopiadoAsociadaInfoProps) {
  return (
    <div className="space-y-6">
      {/* Banner principal */}
      <Card className="bg-gradient-to-br from-blue-600 to-cyan-600 text-white">
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            Orden de Copiado Vinculada
          </h2>
          <p className="text-blue-100 mb-6">
            Esta orden de copiado está asociada a la Orden de Trabajo <strong>#{ordenTrabajoNumero}</strong>
          </p>
          <Link to={`/app/orders/ordenes/${ordenTrabajoId}`}>
            <Button variant="outline" size="lg" className="bg-white text-blue-600 hover:bg-blue-50 border-white">
              <ExternalLink className="w-5 h-5" />
              Ver Orden de Trabajo Principal
            </Button>
          </Link>
        </div>
      </Card>

      {/* Información de gestión de pagos */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 bg-blue-600 rounded-lg">
              <Info className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-900 mb-2">
                Gestión de Pagos Centralizada
              </h3>
              <p className="text-sm text-blue-800 mb-4">
                Los pagos para esta orden de copiado se gestionan desde la orden de trabajo principal.
                Esto permite un control centralizado de todos los cobros relacionados con la orden.
              </p>

              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">¿Qué significa esto?</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Todos los pagos recibidos se registran en la orden de trabajo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>El total de esta orden de copiado está incluido en el total consolidado</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Los pagos cubren tanto la orden de trabajo como esta orden de copiado</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>No es necesario registrar pagos separados para esta orden</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Resumen de montos */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Información Financiera</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Total de Esta Orden de Copiado</p>
                  <p className="text-xs text-gray-500 mt-0.5">Incluido en el total consolidado</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-green-600">
                ${totalOrdenCopiado.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Para ver el estado de pagos completo (incluyendo esta orden), dirígete a la orden de trabajo principal.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Acción principal */}
      <div className="flex justify-center">
        <Link to={`/app/orders/ordenes/${ordenTrabajoId}`}>
          <Button variant="primary" size="lg">
            <FileText className="w-5 h-5" />
            Ir a Orden de Trabajo #{ordenTrabajoNumero}
          </Button>
        </Link>
      </div>
    </div>
  );
}
