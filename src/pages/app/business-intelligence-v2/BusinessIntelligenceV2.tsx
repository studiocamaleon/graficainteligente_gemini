import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, BarChart3, LayoutDashboard, Sparkles, Wallet } from 'lucide-react';
import dayjs from 'dayjs';
import { TabsModern } from '../../../components/ui/TabsModern';
import { DateRangePicker } from '../../../components/ui/DateRangePicker';
import type { BIQueryParams } from '../../../hooks/biShared';
import { ExecutiveTab } from './ExecutiveTab';
import { VentasTab } from './VentasTab';
import { CajaTab } from './CajaTab';
import { ClientesTab } from './ClientesTab';
import { OperacionTab } from './OperacionTab';

function getActiveTab(pathname: string): string {
  if (pathname.includes('/v2/ventas')) return 'ventas';
  if (pathname.includes('/v2/caja')) return 'caja';
  if (pathname.includes('/v2/clientes')) return 'clientes';
  if (pathname.includes('/v2/operacion')) return 'operacion';
  return 'executive';
}

export default function BusinessIntelligenceV2() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(getActiveTab(location.pathname));
  const [fechaInicio, setFechaInicio] = useState(dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [fechaFin, setFechaFin] = useState(dayjs().format('YYYY-MM-DD'));

  useEffect(() => {
    setActiveTab(getActiveTab(location.pathname));
  }, [location.pathname]);

  const tabs = useMemo(
    () => [
      { id: 'executive', label: 'Executive', icon: LayoutDashboard },
      { id: 'ventas', label: 'Ventas', icon: BarChart3 },
      { id: 'caja', label: 'Caja', icon: Wallet },
      { id: 'clientes', label: 'Clientes', icon: Activity },
      { id: 'operacion', label: 'Operación', icon: Sparkles },
    ],
    []
  );

  const commonParams: BIQueryParams = useMemo(
    () => ({
      preset: 'personalizado',
      fechaInicio: fechaInicio || dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
      fechaFin: fechaFin || dayjs().format('YYYY-MM-DD'),
    }),
    [fechaInicio, fechaFin]
  );

  return (
    <div className="space-y-6">
      <section className="relative overflow-visible rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-sky-50 to-blue-50 p-5 md:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/4 h-36 w-36 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Inteligencia empresarial</h1>
            <p className="mt-1 text-sm text-slate-600">
              Reportes inteligentes para decisiones basadas en datos.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Período</label>
              <DateRangePicker
                startDate={fechaInicio}
                endDate={fechaFin}
                onChange={(start, end) => {
                  if (!start && !end) {
                    setFechaInicio(dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
                    setFechaFin(dayjs().format('YYYY-MM-DD'));
                    return;
                  }
                  if (start && end) {
                    setFechaInicio(start);
                    setFechaFin(end);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <TabsModern
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => {
          setActiveTab(tabId);
          navigate(`/app/business-intelligence/v2/${tabId}`);
        }}
      />

      <Routes>
        <Route path="/" element={<Navigate to="/app/business-intelligence/v2/executive" replace />} />
        <Route path="executive" element={<ExecutiveTab params={commonParams} />} />
        <Route path="ventas" element={<VentasTab params={commonParams} />} />
        <Route path="caja" element={<CajaTab params={commonParams} />} />
        <Route path="clientes" element={<ClientesTab params={commonParams} />} />
        <Route path="operacion" element={<OperacionTab params={commonParams} />} />
        <Route path="*" element={<Navigate to="/app/business-intelligence/v2/executive" replace />} />
      </Routes>
    </div>
  );
}
