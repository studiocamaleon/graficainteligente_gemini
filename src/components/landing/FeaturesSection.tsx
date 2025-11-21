import { motion } from 'framer-motion';
import { Calculator, Workflow, Layers, Package, Users, BarChart3, LucideIcon } from 'lucide-react';
import { FEATURES } from '../../constants/branding';

const iconMap: Record<string, LucideIcon> = {
  Calculator,
  Workflow,
  Layers,
  Package,
  Users,
  BarChart3,
};

export function FeaturesSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Todo lo que necesitas en{' '}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              un solo lugar
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Automatiza procesos, reduce errores y optimiza cada aspecto de tu negocio gráfico
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, index) => {
            const Icon = iconMap[feature.icon];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl p-8 border border-gray-200 hover:border-blue-300 hover:shadow-2xl transition-all duration-300"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center mb-5 shadow-lg">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-full border border-blue-200">
            <span className="text-blue-700 font-semibold">
              + Muchas más funcionalidades diseñadas para tu éxito
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
