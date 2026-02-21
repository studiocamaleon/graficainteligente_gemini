import ReactECharts from 'echarts-for-react';
import { Activity, PieChart, UserPlus, Users } from 'lucide-react';
import { useBIClientes } from '../../../hooks/useBIClientes';
import type { BIQueryParams } from '../../../hooks/biShared';
import { BISectionCard } from '../../../components/business-intelligence-v2/BISectionCard';
import { KPICard } from '../../../components/business-intelligence-v2/KPICard';
import { BIErrorState, BILoadingState } from '../../../components/business-intelligence-v2/BIState';

interface ClientesTabProps {
  params: BIQueryParams;
}

const money = (value: number) =>
  value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ClientesTab({ params }: ClientesTabProps) {
  const clientes = useBIClientes(params);
  if (clientes.loading) return <BILoadingState label="Cargando analítica de clientes..." />;
  if (clientes.error) return <BIErrorState message={clientes.error} />;
  if (!clientes.data) return <BIErrorState message="No hay datos de clientes disponibles." />;

  const recurrenciaOption = {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        label: { formatter: '{b}: {d}%' },
        data: [
          { name: 'Recurrentes', value: clientes.data.clientes_recurrentes },
          { name: 'No recurrentes', value: Math.max(safeNumber(clientes.data.clientes_activos - clientes.data.clientes_recurrentes), 0) },
        ],
      },
    ],
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KPICard title="Clientes nuevos" value={String(clientes.data.clientes_nuevos)} subtitle="Altas en el período" hint="Clientes que hicieron su primera compra en el rango." icon={UserPlus} tone="cyan" />
        <KPICard title="Clientes activos" value={String(clientes.data.clientes_activos)} subtitle={`Recurrentes ${clientes.data.clientes_recurrentes}`} hint="Clientes con al menos una compra en el período." icon={Users} tone="indigo" />
        <KPICard title="Frecuencia compra" value={clientes.data.frecuencia_compra.toFixed(2)} subtitle="Órdenes por cliente activo" hint="Promedio de compras por cada cliente activo." icon={Activity} tone="emerald" />
        <KPICard title="Concentración top 10" value={`${clientes.data.concentracion_top10_pct.toFixed(1)}%`} subtitle={`Ticket cliente ${money(clientes.data.ticket_promedio_cliente)}`} hint="Qué porcentaje de ventas depende de tus 10 principales clientes." icon={PieChart} tone={clientes.data.concentracion_top10_pct > 60 ? 'amber' : 'emerald'} />
        <KPICard title="LTV promedio" value={`$${money(clientes.data.ltv_promedio)}`} subtitle={`Mediano $${money(clientes.data.ltv_mediano)}`} hint="Valor de vida histórico por cliente con compras." icon={Users} tone="cyan" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <BISectionCard title="Recurrencia de clientes" description="Distribución de clientes recurrentes vs no recurrentes." right={<span className="text-[11px] font-medium text-slate-500">Qué es: fidelización de la base de clientes.</span>}>
            <ReactECharts option={recurrenciaOption} style={{ height: 330 }} />
          </BISectionCard>
        </div>
        <div className="xl:col-span-6">
          <BISectionCard title="Recencia & concentración" description="Indicadores estratégicos de cartera">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Recencia media</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{clientes.data.recencia_media_dias.toFixed(1)} días</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Ticket por cliente</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">${money(clientes.data.ticket_promedio_cliente)}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
              La concentración en top 10 clientes es <strong>{clientes.data.concentracion_top10_pct.toFixed(1)}%</strong>.
              {clientes.data.concentracion_top10_pct > 60
                ? ' Riesgo alto de dependencia: conviene diversificar cartera.'
                : ' Nivel controlado de dependencia de cartera.'}
            </div>
          </BISectionCard>
        </div>
      </div>

      <BISectionCard
        title="Top clientes por LTV"
        description={`Ranking histórico por facturación acumulada (${clientes.data.clientes_con_compras_historicas} clientes con compras).`}
        right={<span className="text-[11px] font-medium text-slate-500">Qué es: clientes que más aportan en valor total histórico.</span>}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 px-3 text-right">LTV</th>
                <th className="py-2 px-3 text-right">Órdenes</th>
                <th className="py-2 pl-3 text-right">Ticket prom.</th>
              </tr>
            </thead>
            <tbody>
              {clientes.data.top_ltv_clientes.map((row) => (
                <tr key={row.cliente_id || row.cliente_nombre} className="border-b border-slate-100 last:border-b-0">
                  <td className="py-2 pr-3 font-medium text-slate-800">{row.cliente_nombre}</td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-900">${money(row.ltv_total)}</td>
                  <td className="py-2 px-3 text-right text-slate-700">{row.total_ordenes}</td>
                  <td className="py-2 pl-3 text-right text-slate-700">${money(row.ticket_promedio)}</td>
                </tr>
              ))}
              {clientes.data.top_ltv_clientes.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    Sin datos de LTV para el período seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </BISectionCard>
    </div>
  );
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
