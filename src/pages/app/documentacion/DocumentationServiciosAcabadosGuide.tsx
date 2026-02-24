import { CheckCircle2, Scissors, Sparkles, Wrench } from 'lucide-react';
import { DocumentationLayout } from '../../../components/documentation/DocumentationLayout';

const sectionLinks = [
  { id: 'que-son', label: '1. Qué son Servicios y Acabados' },
  { id: 'diferencia-clave', label: '2. Diferencia clave entre ambos' },
  { id: 'cuando-usar', label: '3. Cuándo usar cada uno en una OT' },
  { id: 'impacto-precio', label: '4. Cómo impactan en el precio final' },
  { id: 'tipos-impacto', label: '5. Tipos de impacto (explicado simple)' },
  { id: 'niveles-precio', label: '6. Niveles de precio: cuándo conviene usarlos' },
  { id: 'impacto-rutas', label: '7. Impacto en producción y rutas' },
  { id: 'buenas-practicas', label: '8. Buenas prácticas de carga en OT' },
  { id: 'configuracion-abm', label: '9. Configuración en ABM Core' },
  { id: 'errores-frecuentes', label: '10. Errores frecuentes y cómo evitarlos' },
  { id: 'checklist', label: '11. Checklist rápido antes de guardar' },
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
      label: 'Impacto',
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

export default function DocumentationServiciosAcabadosGuide() {
  return (
    <DocumentationLayout
      title="Guía de Servicios y Acabados"
      description="Cómo usar, configurar y validar servicios/acabados para cotizar bien y evitar problemas de producción."
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

        <section id="que-son" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">1. Qué son Servicios y Acabados</h2>
          <p className="mt-2 text-sm text-slate-600">
            Ambos son agregados que complementan un item de la OT, pero cumplen funciones distintas.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Wrench className="h-4 w-4 text-sky-600" /> Servicio
              </div>
              <p className="mt-2">Es un adicional operativo/comercial que suma valor al trabajo (ejemplo: diseño, armado, instalación, gestión extra).</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Scissors className="h-4 w-4 text-purple-600" /> Acabado
              </div>
              <p className="mt-2">Es una terminación del producto físico (ejemplo: laminado, corte especial, doblado, terminación final).</p>
            </div>
          </div>
        </section>

        <section id="diferencia-clave" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">2. Diferencia clave entre ambos</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Aspecto</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Servicio</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Acabado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Objetivo</td>
                  <td className="px-3 py-2 text-slate-600">Agregar trabajo complementario.</td>
                  <td className="px-3 py-2 text-slate-600">Definir terminación del producto.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Momento de uso</td>
                  <td className="px-3 py-2 text-slate-600">Cuando hay una tarea extra a cobrar o ejecutar.</td>
                  <td className="px-3 py-2 text-slate-600">Cuando la pieza necesita terminación específica.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Impacto en precio</td>
                  <td className="px-3 py-2 text-slate-600">Puede sumar monto fijo o variable.</td>
                  <td className="px-3 py-2 text-slate-600">Puede sumar por unidad, medida o esquema mixto.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Impacto en ruta</td>
                  <td className="px-3 py-2 text-slate-600">Puede agregar pasos operativos.</td>
                  <td className="px-3 py-2 text-slate-600">Puede agregar pasos de postproducción.</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-900">Riesgo si se carga mal</td>
                  <td className="px-3 py-2 text-slate-600">Desvío de margen o cobro incompleto.</td>
                  <td className="px-3 py-2 text-slate-600">Retrabajo y terminación incorrecta en taller.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="cuando-usar" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">3. Cuándo usar cada uno en una OT</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Usá <strong>Servicio</strong> cuando hay un trabajo adicional que no forma parte del producto base.</li>
            <li>Usá <strong>Acabado</strong> cuando la pieza necesita una terminación física específica.</li>
            <li>Podés usar ambos en el mismo item si el trabajo lo requiere.</li>
          </ul>
          <div className="mt-3">
            <Callout kind="atencion" title="No mezclar criterio de uso">
              Si una terminación se carga como servicio (o al revés), se puede distorsionar el precio y también la ejecución en producción.
            </Callout>
          </div>
        </section>

        <section id="impacto-precio" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">4. Cómo impactan en el precio final</h2>
          <p className="mt-2 text-sm text-slate-600">
            Servicios y acabados pueden aumentar el precio del item con diferentes reglas. Si el impacto está mal definido,
            la cotización queda inconsistente y se afecta el margen.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Callout kind="impacto" title="Impacto comercial">
              Un tipo de impacto incorrecto puede hacer que cotices por debajo del costo real o que el precio quede fuera de mercado.
            </Callout>
            <Callout kind="impacto" title="Impacto operativo">
              Si además hay pasos asociados, producción puede recibir una ruta incompleta o errónea.
            </Callout>
          </div>
        </section>

        <section id="tipos-impacto" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">5. Tipos de impacto (explicado simple)</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p><strong>Sin impacto:</strong> no modifica precio.</p>
            <p><strong>Precio fijo:</strong> suma un monto único. Ejemplo: + $5.000.</p>
            <p><strong>Porcentual:</strong> suma un porcentaje sobre base. Ejemplo: +10%.</p>
            <p><strong>Por unidad:</strong> suma por cada unidad. Ejemplo: +$50 por unidad.</p>
            <p><strong>Por m²:</strong> suma según superficie. Ejemplo: +$2.000 por m².</p>
            <p><strong>Por metro lineal:</strong> suma por largo lineal. Ejemplo: +$1.200 por ml.</p>
            <p><strong>Por minuto:</strong> suma por tiempo operativo. Ejemplo: +$300 por minuto.</p>
            <p><strong>Mixtos (fijo + variable):</strong> combina dos reglas. Ejemplo: +$2.000 fijos + $700 por m².</p>
          </div>
          <div className="mt-3">
            <Callout kind="tip" title="Regla simple para elegir bien">
              Si el costo crece con cantidad/medida/tiempo, usá impacto variable. Si siempre cuesta lo mismo, usá fijo.
            </Callout>
          </div>
        </section>

        <section id="niveles-precio" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">6. Niveles de precio: cuándo conviene usarlos</h2>
          <p className="mt-2 text-sm text-slate-600">
            Usá niveles cuando un mismo servicio/acabado puede tener variantes (calidad, tiempo, tecnología o complejidad).
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Facilitan elegir una opción estándar al cargar la OT.</li>
            <li>Reducen errores manuales de precio.</li>
            <li>Mejoran consistencia entre vendedores.</li>
          </ul>
        </section>

        <section id="impacto-rutas" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">7. Impacto en producción y rutas</h2>
          <p className="mt-2 text-sm text-slate-600">
            Según la configuración, servicios y acabados pueden agregar pasos en la ruta de producción.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Si falta paso asociado, la tarea puede quedar incompleta para taller.</li>
            <li>Si el paso está mal definido, se puede desordenar la secuencia.</li>
            <li>Siempre validar la ruta final antes de confirmar una OT importante.</li>
          </ul>
        </section>

        <section id="buenas-practicas" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">8. Buenas prácticas de carga en OT</h2>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            1) Definir producto base correctamente
            <span className="mx-2 text-slate-400">→</span>
            2) Agregar servicios/acabados que realmente aplican
            <span className="mx-2 text-slate-400">→</span>
            3) Revisar impacto en precio
            <span className="mx-2 text-slate-400">→</span>
            4) Validar ruta final
            <span className="mx-2 text-slate-400">→</span>
            5) Guardar OT
          </div>
          <div className="mt-3">
            <Callout kind="tip" title="Menos cantidad, más precisión">
              Es mejor cargar menos extras pero bien definidos, que sumar muchos sin validar su impacto real.
            </Callout>
          </div>
        </section>

        <section id="configuracion-abm" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">9. Configuración en ABM Core (paso a paso funcional)</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>Ir a <strong>ABM Core &gt; Servicios</strong> o <strong>ABM Core &gt; Acabados</strong>.</li>
            <li>Definir nombre claro y categorías donde aplica.</li>
            <li>Elegir tipo de impacto correcto (o niveles si corresponde).</li>
            <li>Configurar estación/paso cuando tenga impacto operativo.</li>
            <li>Activar y probar en una OT de prueba antes de usar masivamente.</li>
          </ol>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Callout kind="atencion" title="Evitar nombres ambiguos">
              Un nombre poco claro provoca errores de selección al momento de cargar la OT.
            </Callout>
            <Callout kind="impacto" title="Configurar pensando en producción">
              No solo importa el precio: también importa que la ruta sea ejecutable de punta a punta.
            </Callout>
          </div>
        </section>

        <section id="errores-frecuentes" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">10. Errores frecuentes y cómo evitarlos</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Seleccionar impacto fijo cuando debería ser variable (o viceversa).</li>
            <li>Cargar el mismo concepto duplicado en servicio y acabado.</li>
            <li>No validar el resultado de precio final antes de guardar.</li>
            <li>Omitir validación de ruta luego de agregar extras.</li>
            <li>Dejar activos servicios/acabados obsoletos que confunden la carga.</li>
          </ul>
        </section>

        <section id="checklist" className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-900">11. Checklist rápido antes de guardar</h2>
          <ul className="mt-3 space-y-2 text-sm text-emerald-900">
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Servicio/acabado elegido con criterio correcto.</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Tipo de impacto revisado (fijo/variable/mixto).</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Precio final validado con el cliente o vendedor.</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Ruta de producción completa y coherente.</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4" />Sin duplicados ni configuraciones contradictorias.</li>
          </ul>
          <p className="mt-3 text-sm text-emerald-900">
            Si este checklist está completo, vas a cotizar mejor y producción va a ejecutar con menos fricción.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Recomendación final</h2>
          <p className="mt-2 text-sm text-slate-600">
            Si tenés dudas sobre cuándo usar cada concepto, priorizá la guía de criterio comercial: <strong>servicio = adicional de trabajo</strong>,
            <strong> acabado = terminación del producto</strong>. Esa regla evita la mayoría de los errores.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <Sparkles className="h-4 w-4" />
            Para más contexto operativo, complementalo con la guía de Órdenes de Trabajo y Producción.
          </div>
        </section>
      </div>
    </DocumentationLayout>
  );
}
