import { AlertCircle, CheckCircle2, Clock3, Eye, TrendingUp } from 'lucide-react';
import { DocumentationLayout } from '../../../components/documentation/DocumentationLayout';

const indicadores = [
  {
    title: 'Ingresos y egresos del día',
    description: 'Compará rápido cuánto entró y cuánto salió para detectar presión de caja en el momento.',
  },
  {
    title: 'Órdenes activas y atrasadas',
    description: 'Medí carga operativa y desvíos. Si suben las atrasadas, priorizá capacidad y coordinación.',
  },
  {
    title: 'Pendientes de entrega y cobro',
    description: 'Ayuda a decidir qué cerrar primero para liberar facturación y mejorar liquidez.',
  },
  {
    title: 'Productividad diaria',
    description: 'Controlá ejecución del equipo y detectá cuellos de botella temprano.',
  },
];

const rutina = [
  {
    tramo: 'Mañana (inicio)',
    acciones: [
      'Revisá atrasos de producción y entregas del día.',
      'Confirmá cobranzas vencidas y tareas críticas de caja.',
      'Definí 3 prioridades operativas para el equipo.',
    ],
  },
  {
    tramo: 'Mediodía (control)',
    acciones: [
      'Validá que el avance real siga el plan del día.',
      'Ajustá tareas con riesgo de atraso o sobrecarga.',
      'Corregí desvíos de cobros o pagos urgentes.',
    ],
  },
  {
    tramo: 'Cierre (fin de jornada)',
    acciones: [
      'Compará objetivo vs resultado en producción y cobranzas.',
      'Detectá pendientes críticos para abrir mañana sin fricción.',
      'Registrá decisiones para seguimiento del día siguiente.',
    ],
  },
];

export default function DocumentationDashboardGuide() {
  return (
    <DocumentationLayout
      title="Guía de Dashboard"
      description="Qué mirar, cómo interpretarlo y qué acciones tomar para decidir mejor en el día a día."
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Qué es el Dashboard</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Es el panel de control operativo del negocio. Resume en una sola vista el estado de ventas,
            producción, entregas y cobranzas para que tomes decisiones rápidas con datos reales.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Para qué sirve en el día a día</h2>
          <ul className="mt-3 grid gap-2 text-sm text-slate-600">
            <li className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">Priorizar trabajo urgente y pedidos con mayor impacto en caja.</li>
            <li className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">Detectar atrasos antes de que afecten entregas y satisfacción del cliente.</li>
            <li className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">Coordinar producción, tesorería y administración con una misma referencia.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Indicadores principales y cómo interpretarlos</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {indicadores.map((item) => (
              <article key={item.title} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-slate-900">
                  <TrendingUp className="h-4 w-4 text-sky-600" />
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-amber-800">
            <Eye className="h-4 w-4" />
            <h2 className="text-lg font-semibold">Cómo detectar alertas tempranas</h2>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            <li className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4" />Crecimiento sostenido de órdenes atrasadas durante varios días.</li>
            <li className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4" />Pendiente de cobro alto con pocas órdenes finalizadas para cobrar.</li>
            <li className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4" />Diferencia marcada entre ritmo de ventas y capacidad operativa real.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <Clock3 className="h-4 w-4 text-sky-600" />
            <h2 className="text-lg font-semibold">Rutina recomendada de uso</h2>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {rutina.map((bloque) => (
              <article key={bloque.tramo} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">{bloque.tramo}</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                  {bloque.acciones.map((accion) => (
                    <li key={accion} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                      <span>{accion}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-rose-900">Errores frecuentes de interpretación</h2>
            <ul className="mt-3 space-y-2 text-sm text-rose-900">
              <li>Tomar un único indicador aislado sin cruzarlo con producción y cobranzas.</li>
              <li>Asumir que todo pendiente se cobra hoy, sin validar estado operativo de las órdenes.</li>
              <li>No considerar tendencias de 7 a 30 días y decidir sólo por el dato del momento.</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-emerald-900">Checklist rápido diario</h2>
            <ul className="mt-3 space-y-2 text-sm text-emerald-900">
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Revisé pedidos atrasados y definí prioridad.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Validé entregas del día y su impacto en cobro.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Controlé cobros/pagos críticos de las próximas 24 hs.</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Dejé claras las prioridades para el siguiente turno.</li>
            </ul>
          </article>
        </section>
      </div>
    </DocumentationLayout>
  );
}
