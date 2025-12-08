
import { useVencimientos } from '../../../hooks/useVencimientos';
import { VencimientosList } from '../../../components/tesoreria/VencimientosList';
import { PageHeader } from '../../../components/ui/PageHeader';
import { DollarSign, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../../utils/stringUtils';
import { Button } from '../../../components/ui/Button';

export default function CuentasPorPagarPage() {
    const { vencimientos, loading, refreshVencimientos } = useVencimientos();

    const totalVencido = vencimientos
        .filter(v => v.estado === 'vencido')
        .reduce((acc, curr) => acc + curr.monto, 0);

    const totalHoy = vencimientos
        .filter(v => v.estado === 'hoy')
        .reduce((acc, curr) => acc + curr.monto, 0);

    const totalProximo = vencimientos
        .filter(v => v.estado === 'proximo')
        .reduce((acc, curr) => acc + curr.monto, 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Cuentas por Pagar"
                description="Gestión de vencimientos, gastos recurrentes y obligaciones pendientes."
                actions={
                    <Button variant="outline" onClick={refreshVencimientos} title="Actualizar">
                        <RefreshCw size={18} />
                    </Button>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Vencido (Exigible)</p>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(totalVencido)}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-full">
                        <AlertCircle className="text-red-500" size={24} />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Vence Hoy</p>
                        <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalHoy)}</p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-full">
                        <Calendar className="text-yellow-500" size={24} />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Próximos 30 días</p>
                        <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalProximo)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-full">
                        <DollarSign className="text-blue-500" size={24} />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Detalle de Vencimientos</h3>
                {loading ? (
                    <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-gray-400" /></div>
                ) : (
                    <VencimientosList vencimientos={vencimientos} onRefresh={refreshVencimientos} />
                )}
            </div>
        </div>
    );
}
