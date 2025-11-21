import { motion } from 'framer-motion';
import { CheckCircle2, Layers, Calculator, Users, BarChart3, Settings, Zap } from 'lucide-react';
import { MODULES } from '../../constants/branding';
import { AppScreenshot } from './AppScreenshot';

export function ModulesSection() {
  const moduleScreenshots = [
    {
      variant: 'wizard' as const,
      stats: [
        { label: 'Configuración de Producto', value: 'Selecciona materiales, medidas y acabados', icon: Settings, color: 'bg-blue-600' },
        { label: 'Cálculo Automático', value: 'Precios actualizados en tiempo real', icon: Calculator, color: 'bg-cyan-600' },
        { label: 'Múltiples Variantes', value: 'Gestiona espesores, colores y tamaños', icon: Layers, color: 'bg-blue-600' },
      ],
    },
    {
      variant: 'dashboard' as const,
      stats: [
        { label: 'Items', value: '3.5', icon: Layers, color: 'bg-blue-600', trend: 'Promedio por orden' },
        { label: 'Precisión', value: '98%', icon: Zap, color: 'bg-cyan-600', trend: 'En cotizaciones' },
        { label: 'Tiempo', value: '2 min', icon: Calculator, color: 'bg-blue-600', trend: 'Por cotización' },
      ],
    },
    {
      variant: 'table' as const,
      stats: [
        { label: 'Total clientes', value: '342', icon: Users, color: 'bg-blue-600' },
        { label: 'Activos', value: '85%', icon: CheckCircle2, color: 'bg-cyan-600' },
        { label: 'Con cuenta corriente', value: '127', icon: Calculator, color: 'bg-blue-600' },
      ],
    },
    {
      variant: 'dashboard' as const,
      stats: [
        { label: 'Ordenes Activas', value: '127', icon: Layers, color: 'bg-blue-600', trend: '+12%' },
        { label: 'Ingresos', value: '$45K', icon: Calculator, color: 'bg-cyan-600', trend: '+8%' },
        { label: 'Tiempo Promedio', value: '3.2 días', icon: BarChart3, color: 'bg-blue-600', trend: 'Producción' },
      ],
    },
  ];

  return (
    <section id="modules" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50/30 via-white to-cyan-50/30">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Módulos{' '}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Potentes
            </span>
            {' '}y Completos
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Cada funcionalidad diseñada específicamente para el sector gráfico
          </p>
        </motion.div>

        <div className="space-y-20">
          {MODULES.map((module, index) => {
            const isEven = index % 2 === 0;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-12 items-center`}
              >
                <div className="flex-1">
                  <AppScreenshot
                    title={module.title}
                    stats={moduleScreenshots[index].stats}
                    variant={moduleScreenshots[index].variant}
                    delay={0.2}
                  />
                </div>
                <div className="flex-1 space-y-4">
                  <h3 className="text-3xl font-bold text-gray-900">{module.title}</h3>
                  <p className="text-lg text-gray-600 leading-relaxed">{module.description}</p>
                  <ul className="space-y-3">
                    {module.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
