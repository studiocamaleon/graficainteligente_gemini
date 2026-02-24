import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  FileUp,
  Info,
  MessageSquare,
  Receipt,
  Route,
  Users,
} from 'lucide-react';
import { DocumentationLayout } from '../../../components/documentation/DocumentationLayout';

const sectionLinks = [
  { id: 'que-es-ot', label: '1. Qué es una OT y por qué importa' },
  { id: 'flujo-completo', label: '2. Flujo completo de creación' },
  { id: 'cliente-rapido', label: '3. Alta rápida de cliente' },
  { id: 'calendario-semaforos', label: '4. Calendario y semáforos' },
  { id: 'items-catalogo-vs-personalizado', label: '5. Items: catálogo vs personalizado' },
  { id: 'rutas-produccion', label: '6. Rutas de producción' },
  { id: 'notas-adjuntos', label: '7. Notas y adjuntos' },
  { id: 'pagos-recibos', label: '8. Pagos y recibos' },
  { id: 'notificaciones', label: '9. Notificaciones al cliente' },
  { id: 'errores-frecuentes', label: '10. Errores frecuentes' },
  { id: 'checklist-final', label: '11. Checklist operativo final' },
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
  const map = {
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
      label: 'Impacto en producción',
    },
  } as const;

  const styles = map[kind];

  return (
    <div className={`rounded-xl border p-4 ${styles.wrap}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${styles.text}`}>{styles.label}</p>
      <p className={`mt-1 text-sm font-semibold ${styles.text}`}>{title}</p>
      <div className={`mt-1 text-sm ${styles.text}`}>{children}</div>
    </div>
  );
}

export default function DocumentationOrdenesTrabajoGuide() {
  return (
    <DocumentationLayout
      title="Guía de Órdenes de Trabajo"
      description="Cómo cargar una OT de forma correcta para que administración, ventas y producción trabajen con información completa y confiable."
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

        <section id="que-es-ot" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">1. Qué es una OT y por qué importa</h2>
          <p className="mt-2 text-sm text-slate-600">
            La Orden de Trabajo (OT) es el documento operativo que activa producción y organiza la entrega al cliente.
            Cargarla bien evita retrabajos, atrasos y dudas en taller.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Cargar rápido: solo completar lo mínimo para guardar.</li>
            <li>Cargar bien: dejar cada item con especificación y ruta ejecutable por producción.</li>
          </ul>
          <div className="mt-3">
            <Callout kind="impacto" title="La calidad de la OT impacta directo en tiempos de entrega">
              Si la OT sale incompleta, el equipo de producción pierde tiempo en reconsulta y correcciones.
            </Callout>
          </div>
        </section>

        <section id="flujo-completo" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">2. Flujo completo de creación (paso a paso)</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>
              <strong>Cabecera:</strong> seleccionar cliente, definir fecha/tipo de entrega, canal de venta y notas internas.
            </li>
            <li>
              <strong>Tab Items:</strong> agregar items de catálogo o personalizados, revisar cantidades, precios y descuentos.
            </li>
            <li>
              <strong>Tab Rutas de Producción:</strong> validar que cada item físico tenga pasos ejecutables.
            </li>
            <li>
              <strong>Tab Adjuntos:</strong> subir artes finales, referencias y archivos clave para taller.
            </li>
            <li>
              <strong>Tab Pagos:</strong> registrar cobros cuando corresponda (si el rol lo permite).
            </li>
            <li>
              <strong>Tab Historial:</strong> revisar trazabilidad de cambios y eventos.
            </li>
          </ol>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <Users className="mb-2 h-4 w-4 text-sky-600" />
              Cliente y contexto comercial
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <Factory className="mb-2 h-4 w-4 text-sky-600" />
              Especificación y ejecución operativa
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <ClipboardCheck className="mb-2 h-4 w-4 text-sky-600" />
              Control y trazabilidad
            </div>
          </div>
        </section>

        <section id="cliente-rapido" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">3. Cliente desde la OT (Alta rápida)</h2>
          <p className="mt-2 text-sm text-slate-600">Desde el botón <strong>+</strong> en cliente podés crear un cliente sin salir del flujo de OT.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Campos obligatorios: Nombre fantasía, Razón social, CUIT/DNI y WhatsApp.</li>
            <li>Si se crea correctamente, queda seleccionado automáticamente en la OT.</li>
            <li>Permite continuar la carga sin perder contexto.</li>
          </ul>
        </section>

        <section id="calendario-semaforos" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">4. Calendario y semáforos de carga</h2>
          <p className="mt-2 text-sm text-slate-600">El selector de fecha muestra semáforo por carga diaria estimada de OT.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">Verde: carga baja (1 a 3).</div>
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">Amarillo: carga media (4 a 7).</div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">Rojo: carga alta (8 o más).</div>
          </div>
          <p className="mt-3 text-sm text-slate-600">Base de cálculo actual:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Órdenes con fecha estimada de entrega cargada.</li>
            <li>Solo órdenes de la misma empresa.</li>
            <li>Excluye estados cancelada y presupuesto.</li>
          </ul>
          <div className="mt-3">
            <Callout kind="atencion" title="El semáforo es una ayuda, no una verdad absoluta">
              Siempre validar junto con estado real de producción, capacidad del equipo y urgencias del cliente.
            </Callout>
          </div>
        </section>

        <section id="items-catalogo-vs-personalizado" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">5. Items: catálogo vs personalizado (y centro de copiado)</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Tipo</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Cómo se define</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Riesgo operativo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Catálogo</td>
                  <td className="px-3 py-2 text-slate-600">Parte de producto existente con configuración y precio base.</td>
                  <td className="px-3 py-2 text-slate-600">Bajo si se valida configuración final.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Personalizado</td>
                  <td className="px-3 py-2 text-slate-600">Se define manualmente (nombre, descripción, categoría, precio).</td>
                  <td className="px-3 py-2 text-slate-600">Alto si queda sin ruta de producción definida.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Centro de copiado</td>
                  <td className="px-3 py-2 text-slate-600">Item específico de copiado asociado a su configuración propia.</td>
                  <td className="px-3 py-2 text-slate-600">Medio si no se validan detalles de copias/papeles.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Cada item también admite <strong>identificador interno</strong> (ej: Modelo A, Modelo B), útil para distinguir variantes del mismo producto.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Para entender cómo aplicar extras al item y cómo impactan en precio/ruta, revisá la guía{' '}
            <a href="/app/documentacion/servicios-acabados" className="font-semibold text-sky-700 underline underline-offset-2">
              Servicios y Acabados
            </a>.
          </p>
          <div className="mt-3">
            <Callout kind="atencion" title="Item personalizado sin ruta = riesgo de bloqueo en taller">
              Regla recomendada: todo personalizado debe salir con ruta predefinida o con ruta manual completa antes de ejecutar producción.
            </Callout>
          </div>
        </section>

        <section id="rutas-produccion" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">6. Rutas de Producción: reglas y buenas prácticas</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>El sistema puede generar rutas automáticamente según producto/configuración.</li>
            <li>Podés editar manualmente pasos, orden y comentarios para operador.</li>
            <li>Una ruta sin etapa principal se considera incompleta.</li>
          </ul>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Callout kind="tip" title="Usar comentarios por paso mejora ejecución">
              Agregá aclaraciones puntuales para evitar ambigüedad entre diseño, preprensa y taller.
            </Callout>
            <Callout kind="impacto" title="Control mínimo antes de guardar/activar">
              Confirmar que cada item físico tenga al menos un paso principal y secuencia lógica de producción.
            </Callout>
          </div>
        </section>

        <section id="notas-adjuntos" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">7. Notas y adjuntos: información crítica para taller</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>En creación: usar notas internas para contexto operativo.</li>
            <li>En edición/detalle: agregar notas adicionales con autor y fecha.</li>
            <li>Adjuntos: subir archivos finales, pruebas y referencias visuales necesarias.</li>
          </ul>
          <div className="mt-3">
            <Callout kind="impacto" title="Sin nota/adjunto, aumenta el retrabajo">
              Producción necesita instrucciones claras y arte correcto para ejecutar bien a la primera.
            </Callout>
          </div>
        </section>

        <section id="pagos-recibos" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">8. Pagos y recibos (desde OT)</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Al registrar un pago se da de alta el movimiento de pago en la orden.</li>
            <li>Se intenta generar recibo PDF automáticamente.</li>
            <li>Se intenta enviar mensaje de recibo por WhatsApp al cliente.</li>
          </ul>
          <p className="mt-2 text-sm text-slate-600">El resultado puede variar según permisos de rol, disponibilidad de servicio y configuración de integración.</p>
        </section>

        <section id="notificaciones" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">9. Notificaciones al cliente (qué se envía y cuándo)</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <Bell className="mb-2 h-4 w-4 text-sky-600" />
              <p className="font-semibold text-slate-900">Al crear OT</p>
              <p className="mt-1">Intento de envío template <code>nueva_orden_v4</code> vía <code>send-wati-message</code>.</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <Route className="mb-2 h-4 w-4 text-sky-600" />
              <p className="font-semibold text-slate-900">Al finalizar OT</p>
              <p className="mt-1">Trigger backend de finalización envía template vigente de orden finalizada.</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <Receipt className="mb-2 h-4 w-4 text-sky-600" />
              <p className="font-semibold text-slate-900">Al registrar pago</p>
              <p className="mt-1">Intento de template <code>recibo_pago_v1</code> junto a generación de recibo.</p>
            </article>
          </div>
          <div className="mt-3">
            <Callout kind="atencion" title="No asumir envío garantizado">
              El envío depende de integración habilitada, credenciales, plantillas aprobadas y datos válidos del cliente. Si falla, puede registrarse error/estado en <code>whatsapp_notificaciones</code>.
            </Callout>
          </div>
        </section>

        <section id="errores-frecuentes" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">10. Errores frecuentes y cómo evitarlos</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Fecha de entrega mal cargada o incoherente con la carga real de trabajo.</li>
            <li>Items personalizados sin ruta definida.</li>
            <li>Falta de notas operativas clave o adjuntos indispensables.</li>
            <li>Usar semáforo como única decisión sin validar situación real de taller.</li>
          </ul>
        </section>

        <section id="checklist-final" className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-900">11. Checklist operativo final (pre-guardar / pre-enviar a producción)</h2>
          <ul className="mt-3 space-y-2 text-sm text-emerald-900">
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Cliente validado y canal de venta definido.</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Fecha y tipo de entrega consistentes con capacidad operativa.</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Cada item tiene especificación clara (y si aplica, identificador interno).</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Rutas completas, especialmente en personalizados.</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Notas internas y adjuntos listos para producción.</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Montos/totales/pagos revisados según necesidad comercial.</li>
          </ul>
          <p className="mt-3 text-sm text-emerald-900">
            Si este checklist está completo, la OT queda en condiciones de ejecución con menor riesgo operativo.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Diagrama rápido del flujo OT</h2>
          <div className="mt-3 overflow-x-auto">
            <div className="min-w-[760px] rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">
                1) Cliente y cabecera <span className="mx-2 text-slate-400">→</span>
                2) Items (catálogo/personalizado) <span className="mx-2 text-slate-400">→</span>
                3) Rutas de producción <span className="mx-2 text-slate-400">→</span>
                4) Adjuntos y notas <span className="mx-2 text-slate-400">→</span>
                5) Guardar OT <span className="mx-2 text-slate-400">→</span>
                6) Notificaciones / ejecución
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <Info className="mb-1 h-4 w-4 text-sky-600" />
              Contexto comercial
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <Route className="mb-1 h-4 w-4 text-sky-600" />
              Ejecución de producción
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <MessageSquare className="mb-1 h-4 w-4 text-sky-600" />
              Comunicación y trazabilidad
            </div>
          </div>
        </section>
      </div>
    </DocumentationLayout>
  );
}
