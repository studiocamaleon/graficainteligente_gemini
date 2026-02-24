import {
  BarChart3,
  CheckCircle2,
  Factory,
  Filter,
  Layers,
  UserCheck,
  Workflow,
} from 'lucide-react';
import { DocumentationLayout } from '../../../components/documentation/DocumentationLayout';

const sectionLinks = [
  { id: 'que-es-produccion', label: '1. Qué es Producción y para qué sirve' },
  { id: 'mapa-tabs', label: '2. Mapa de tabs y uso recomendado' },
  { id: 'fuentes-informacion', label: '3. De dónde viene la información' },
  { id: 'tab-jobs', label: '4. Tab Jobs: cómo leerlo' },
  { id: 'tab-estaciones', label: '5. Tab Estaciones: rutina diaria' },
  { id: 'orden-tareas', label: '6. Importancia de seguir el orden' },
  { id: 'urgencias-fechas', label: '7. Urgencias y semántica de fechas' },
  { id: 'pausas-continuidad', label: '8. Pausas y continuidad' },
  { id: 'tab-rendimiento', label: '9. Tab Rendimiento (admin/super_admin)' },
  { id: 'errores-frecuentes', label: '10. Errores frecuentes en Producción' },
  { id: 'checklist-estaciones', label: '11. Checklist diario de Estaciones' },
];

function Callout({
  kind,
  title,
  children,
}: {
  kind: 'tip' | 'atencion' | 'impacto';
  title: string;
  children: React.ReactNode;
}) {
  const variants = {
    tip: {
      wrap: 'border-emerald-200 bg-emerald-50/80',
      text: 'text-emerald-900',
      label: 'Tip',
    },
    atencion: {
      wrap: 'border-amber-200 bg-amber-50/80',
      text: 'text-amber-900',
      label: 'Atención',
    },
    impacto: {
      wrap: 'border-sky-200 bg-sky-50/80',
      text: 'text-sky-900',
      label: 'Impacto operativo',
    },
  } as const;

  const style = variants[kind];

  return (
    <div className={`rounded-xl border p-4 ${style.wrap}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${style.text}`}>{style.label}</p>
      <p className={`mt-1 text-sm font-semibold ${style.text}`}>{title}</p>
      <div className={`mt-1 text-sm ${style.text}`}>{children}</div>
    </div>
  );
}

export default function DocumentationProduccionGuide() {
  return (
    <DocumentationLayout
      title="Guía de Producción"
      description="Cómo usar Producción en el día a día para priorizar tareas, trabajar con orden y cumplir mejor las entregas."
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Índice rápido</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {sectionLinks.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                {item.label}
              </a>
            ))}
          </div>
        </section>

        <section id="que-es-produccion" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">1. Qué es Producción y para qué sirve</h2>
          <p className="mt-2 text-sm text-slate-600">
            El módulo de Producción centraliza la ejecución de tareas de órdenes ya cargadas y define qué tiene que hacer cada área.
            Su objetivo es convertir la OT en trabajo ejecutado, entregado y trazable.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li><strong>Vista global:</strong> Jobs para seguimiento transversal.</li>
            <li><strong>Vista operativa:</strong> Estaciones para ejecución diaria por puesto.</li>
            <li><strong>Vista analítica:</strong> Rendimiento para gestión de productividad.</li>
          </ul>
        </section>

        <section id="mapa-tabs" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">2. Mapa de tabs y uso recomendado</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Tab</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Objetivo</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Uso recomendado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Jobs</td>
                  <td className="px-3 py-2 text-slate-600">Seguimiento de items en pendiente, en proceso y finalizado.</td>
                  <td className="px-3 py-2 text-slate-600">Visión general y detección rápida de cuellos de botella.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Estaciones</td>
                  <td className="px-3 py-2 text-slate-600">Trabajo diario por estación y mesa de trabajo.</td>
                  <td className="px-3 py-2 text-slate-600">Tab principal de ejecución del operador.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Rendimiento</td>
                  <td className="px-3 py-2 text-slate-600">Análisis de desempeño y evolución.</td>
                  <td className="px-3 py-2 text-slate-600">Uso gerencial (admin/super_admin), no microgestión por tarea.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="fuentes-informacion" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">3. De dónde viene la información</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-900">Jobs</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Muestra trabajos reales de órdenes activas que todavía impactan producción.</li>
                <li>No incluye órdenes canceladas ni entregadas.</li>
                <li>No incluye conceptos de cobro que no requieren trabajo productivo.</li>
                <li>Su objetivo es dar una vista general del estado de ejecución.</li>
              </ul>
            </article>

            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-900">Estaciones</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Muestra tareas activas por estación de trabajo.</li>
                <li>Incluye tareas pendientes, en proceso y pausadas.</li>
                <li>Solo se muestran estaciones habilitadas.</li>
                <li>Una tarea aparece cuando ya está en condiciones de ser ejecutada dentro de su secuencia.</li>
              </ul>
            </article>

            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-900">Rendimiento</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Resume la evolución del trabajo finalizado y la carga por equipo.</li>
                <li>Sirve para decisiones de gestión y mejora de procesos.</li>
                <li>No reemplaza la operación diaria de Estaciones.</li>
              </ul>
            </article>
          </div>
        </section>

        <section id="tab-jobs" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">4. Tab Jobs: cómo leerlo</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Organiza los trabajos por columnas: pendiente, en proceso y finalizado.</li>
            <li>Permite búsqueda por cliente, número de orden y producto.</li>
            <li>Tiene orden por fecha estimada de entrega (próximas o lejanas).</li>
            <li>El “paso relevante” te marca dónde está hoy cada trabajo dentro de su flujo.</li>
          </ul>
        </section>

        <section id="tab-estaciones" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">5. Tab Estaciones (sección principal) — rutina diaria</h2>
          <p className="mt-2 text-sm text-slate-600">Este es el tablero de trabajo diario para operadores y líderes de producción.</p>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <Layers className="mb-2 h-4 w-4 text-sky-600" />
              Seleccioná estación y revisá carga activa.
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <Filter className="mb-2 h-4 w-4 text-sky-600" />
              Aplicá filtros: Todos, Pendientes, Mi mesa, Solo urgentes.
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <UserCheck className="mb-2 h-4 w-4 text-sky-600" />
              Tomá tareas a mesa, ejecutá y finalizá en lote cuando corresponda.
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-600">Métricas clave de cabecera en estación:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li><code>Total activos</code></li>
            <li><code>Mi mesa</code></li>
            <li><code>Pendientes</code></li>
            <li><code>Urgentes</code></li>
            <li><code>Mostrando</code></li>
          </ul>

          <div className="mt-3">
            <Callout kind="impacto" title="Mesa de trabajo = responsabilidad clara">
              Tomar tareas en tu mesa define ownership operativo. Si la tarea está tomada por otro usuario, no debe intervenirse sin coordinación.
            </Callout>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">SOP visual (Estaciones)</p>
            <p className="mt-2 text-sm text-slate-700">
              1) Seleccionar estación <span className="mx-2 text-slate-400">→</span>
              2) Filtrar urgentes/pendientes <span className="mx-2 text-slate-400">→</span>
              3) Enviar a mi mesa <span className="mx-2 text-slate-400">→</span>
              4) Ejecutar y actualizar estado <span className="mx-2 text-slate-400">→</span>
              5) Finalizar seleccionados y liberar pendientes.
            </p>
          </div>
        </section>

        <section id="orden-tareas" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">6. Importancia de seguir el orden de tareas</h2>
          <p className="mt-2 text-sm text-slate-600">
            Aunque Estaciones ya evita mostrar pasos no listos, el equipo debe respetar la secuencia real de ejecución para mantener calidad y continuidad.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>No saltar pasos críticos por urgencia comercial.</li>
            <li>Evitar iniciar tareas dependientes en paralelo sin validar precondiciones.</li>
            <li>Cerrar correctamente pausas/reanudaciones para no distorsionar seguimiento.</li>
          </ul>
        </section>

        <section id="urgencias-fechas" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">7. Urgencias y semántica de fechas en Estaciones</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Vencido: fecha estimada ya superada.</li>
            <li>Hoy: requiere atención durante la jornada actual.</li>
            <li>Mañana: debe prepararse hoy para evitar atraso.</li>
          </ul>
          <div className="mt-3">
            <Callout kind="atencion" title="Urgente no significa desordenado">
              Priorizar urgencias no debe romper el flujo técnico de fabricación ni desplazar controles mínimos de calidad.
            </Callout>
          </div>
        </section>

        <section id="pausas-continuidad" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">8. Pausas y continuidad</h2>
          <p className="mt-2 text-sm text-slate-600">Una tarea pausada sigue activa y requiere seguimiento para retomar correctamente.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Registrar motivo de pausa cuando corresponda.</li>
            <li>Evitar pausas abiertas sin seguimiento.</li>
            <li>Reanudar con contexto para no perder continuidad operativa.</li>
          </ul>
        </section>

        <section id="tab-rendimiento" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">9. Tab Rendimiento (admin/super_admin)</h2>
          <p className="mt-2 text-sm text-slate-600">Rendimiento se usa para análisis gerencial: evolución de tareas, productividad y capacidad por usuario/estación.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Útil para decidir mejoras de proceso y balance de carga.</li>
            <li>No debe usarse para perseguir ejecución minuto a minuto de operadores.</li>
          </ul>
        </section>

        <section id="errores-frecuentes" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">10. Errores frecuentes en Producción</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Tomar tareas fuera de orden técnico.</li>
            <li>No usar mesa de trabajo y perder ownership.</li>
            <li>Finalizar tareas sin validar dependencias anteriores.</li>
            <li>Ignorar urgentes hasta convertirlas en vencidas.</li>
          </ul>
        </section>

        <section id="checklist-estaciones" className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-900">11. Checklist diario de Estaciones (operativo)</h2>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <article className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-sm font-semibold text-emerald-900">Inicio de turno</p>
              <ul className="mt-2 space-y-1 text-sm text-emerald-900">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Seleccionar estación y revisar urgentes.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Tomar a mesa tareas prioritarias del turno.</li>
              </ul>
            </article>

            <article className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-sm font-semibold text-emerald-900">Mitad de jornada</p>
              <ul className="mt-2 space-y-1 text-sm text-emerald-900">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Revisar pendientes vs mi mesa.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Destrabar pausados y reasignar si hace falta.</li>
              </ul>
            </article>

            <article className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-sm font-semibold text-emerald-900">Cierre de turno</p>
              <ul className="mt-2 space-y-1 text-sm text-emerald-900">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Finalizar seleccionados ya completados.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Dejar clara la continuidad para próximo turno.</li>
              </ul>
            </article>
          </div>

          <div className="mt-3">
            <Callout kind="tip" title="Estaciones bien usado = menos retrabajo y mejor cumplimiento">
              La combinación de prioridad correcta, ownership por mesa y cierre ordenado reduce desvíos de entrega y mejora previsibilidad.
            </Callout>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Resumen de operación recomendada</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <Factory className="mb-1 h-4 w-4 text-sky-600" />
              Ejecutar por estación con orden técnico.
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <Workflow className="mb-1 h-4 w-4 text-sky-600" />
              Usar mesa de trabajo para trazabilidad y foco.
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <BarChart3 className="mb-1 h-4 w-4 text-sky-600" />
              Medir rendimiento para mejorar procesos.
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Esta guía documenta el funcionamiento actual del módulo y sirve como estándar interno de capacitación operativa.
          </p>
        </section>
      </div>
    </DocumentationLayout>
  );
}
