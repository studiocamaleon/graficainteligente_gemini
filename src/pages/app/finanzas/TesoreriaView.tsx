import { useState } from 'react';
import { RefreshCw, Wallet, TrendingUp, TrendingDown, DollarSign, CreditCard, LineChart } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { ResumenCajas } from '../../../components/tesoreria/ResumenCajas';
import { IngresosPanel } from '../../../components/tesoreria/IngresosPanel';
import { EgresosPanel } from '../../../components/tesoreria/EgresosPanel';
import { RecurringExpensesPanel } from '../../../components/tesoreria/RecurringExpensesPanel';
import { ChequesPanel } from '../../../components/tesoreria/ChequesPanel';
import { DineroPorCobrarPanel } from '../../../components/tesoreria/DineroPorCobrarPanel';
import { TarjetasPanel } from '../../../components/tesoreria/TarjetasPanel';
import { CashflowDashboard } from '../../../components/finanzas/CashflowDashboard';
import { useCajas } from '../../../hooks/useCajas';

export default function TesoreriaView() {
  const { resumenPorTipo, totalSaldo, refetch } = useCajas();
  const [activeTab, setActiveTab] = useState('cashflow');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 500);
  };

  const tabs = [
    { id: 'cashflow', label: 'Proyección (Cashflow)', icon: LineChart },
    { id: 'cajas', label: 'Cajas y Saldos', icon: Wallet },
    { id: 'cheques', label: 'Cartera Cheques', icon: DollarSign },
    { id: 'tarjetas', label: 'Tarjetas Corp.', icon: CreditCard },
    { id: 'ingresos', label: 'Ingresos', icon: TrendingUp },
    { id: 'egresos', label: 'Egresos', icon: TrendingDown },
    { id: 'recurrentes', label: 'Gastos Fijos', icon: RefreshCw },
    { id: 'por-cobrar', label: 'Por Cobrar', icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {/* Action Button */}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'cashflow' && <CashflowDashboard />}

        {activeTab === 'cajas' && (
          <ResumenCajas
            resumenPorTipo={resumenPorTipo}
            totalSaldo={totalSaldo}
            onCajaClick={(cajaId) => {
              // TODO: Abrir modal con detalle de movimientos de la caja
              console.log('Ver detalle de caja:', cajaId);
            }}
          />
        )}

        {activeTab === 'cheques' && <ChequesPanel />}

        {activeTab === 'tarjetas' && <TarjetasPanel />}

        {activeTab === 'ingresos' && <IngresosPanel onIngresoRegistrado={refetch} />}

        {activeTab === 'egresos' && <EgresosPanel onEgresoRegistrado={refetch} />}

        {activeTab === 'recurrentes' && <RecurringExpensesPanel />}

        {activeTab === 'por-cobrar' && <DineroPorCobrarPanel />}
      </div>

      {/* Última actualización */}
      <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200">
        Última actualización: {new Date().toLocaleString('es-AR')}
      </div>
    </div>
  );
}
