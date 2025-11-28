import { useState } from 'react';
import { RefreshCw, Wallet, TrendingUp, DollarSign } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { ResumenCajas } from '../../../components/tesoreria/ResumenCajas';
import { IngresosPanel } from '../../../components/tesoreria/IngresosPanel';
import { DineroPorCobrarPanel } from '../../../components/tesoreria/DineroPorCobrarPanel';
import { useCajas } from '../../../hooks/useCajas';

export default function TesoreriaView() {
  const { cajas, resumenPorTipo, totalSaldo, loading, refetch } = useCajas();
  const [activeTab, setActiveTab] = useState('cajas');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 500);
  };

  const tabs = [
    { id: 'cajas', label: 'Cajas y Saldos', icon: Wallet },
    { id: 'ingresos', label: 'Ingresos', icon: TrendingUp },
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

        {activeTab === 'ingresos' && <IngresosPanel />}

        {activeTab === 'por-cobrar' && <DineroPorCobrarPanel />}
      </div>

      {/* Última actualización */}
      <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200">
        Última actualización: {new Date().toLocaleString('es-AR')}
      </div>
    </div>
  );
}
