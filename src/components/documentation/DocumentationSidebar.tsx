import { NavLink } from 'react-router-dom';
import { BookOpen, Boxes, ClipboardList, LayoutDashboard, Scale, Sparkles } from 'lucide-react';

const sections = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Guía de lectura operativa diaria',
    icon: LayoutDashboard,
    path: '/app/documentacion/dashboard',
  },
  {
    id: 'ordenes-trabajo',
    name: 'Órdenes de Trabajo',
    description: 'Guía operativa completa de OT',
    icon: ClipboardList,
    path: '/app/documentacion/ordenes-trabajo',
  },
  {
    id: 'produccion',
    name: 'Producción',
    description: 'Operación diaria de jobs y estaciones',
    icon: Boxes,
    path: '/app/documentacion/produccion',
  },
  {
    id: 'servicios-acabados',
    name: 'Servicios y Acabados',
    description: 'Guía de uso e impacto en OT',
    icon: Sparkles,
    path: '/app/documentacion/servicios-acabados',
  },
  {
    id: 'reglas-internas',
    name: 'Reglas internas',
    description: 'Procedimientos críticos y acuerdos',
    icon: Scale,
    path: '/app/documentacion/reglas-internas',
  },
];

export function DocumentationSidebar() {
  return (
    <aside className="w-full shrink-0 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm lg:w-72">
      <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/80 p-3">
        <div className="flex items-center gap-2 text-sky-700">
          <BookOpen className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-wide">Documentación</p>
        </div>
        <p className="mt-1 text-sm text-slate-600">Material de soporte para uso diario del sistema.</p>
      </div>

      <nav className="space-y-2" aria-label="Secciones de documentación">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <NavLink
              key={section.id}
              to={section.path}
              className={({ isActive }) =>
                [
                  'group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-all',
                  isActive
                    ? 'border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 text-slate-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                ].join(' ')
              }
            >
              <div className="mt-0.5 rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 group-hover:text-slate-800">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{section.name}</p>
                <p className="text-xs text-slate-500">{section.description}</p>
              </div>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
