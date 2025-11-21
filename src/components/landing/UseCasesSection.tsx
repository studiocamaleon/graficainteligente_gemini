import { motion } from 'framer-motion';
import { Printer, Maximize2, Box, Shirt, LucideIcon } from 'lucide-react';
import { USE_CASES } from '../../constants/branding';

const iconMap: Record<string, LucideIcon> = {
  Printer,
  Maximize2,
  Box,
  Shirt,
};

export function UseCasesSection() {
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
            Soluciones para{' '}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              cada tipo
            </span>
            {' '}de negocio
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Desde imprentas tradicionales hasta operaciones de gran formato, tenemos la solución perfecta
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {USE_CASES.map((useCase, index) => {
            const Icon = iconMap[useCase.icon];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
                className="bg-gradient-to-br from-white via-blue-50/20 to-cyan-50/30 rounded-2xl p-8 border-2 border-gray-200 hover:border-blue-300 shadow-lg hover:shadow-2xl transition-all duration-300"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{useCase.title}</h3>
                    <p className="text-gray-600">{useCase.description}</p>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Características clave:</p>
                  <div className="flex flex-wrap gap-2">
                    {useCase.benefits.map((benefit, bIndex) => (
                      <span
                        key={bIndex}
                        className="px-3 py-1 bg-white border border-blue-200 text-blue-700 rounded-full text-sm font-medium"
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-8 text-white shadow-2xl">
            <h3 className="text-2xl font-bold mb-3">¿Tu negocio es diferente?</h3>
            <p className="text-lg opacity-90 mb-6">
              Nuestro sistema es altamente configurable y se adapta a tus necesidades específicas
            </p>
            <button className="px-8 py-3 bg-white text-blue-700 font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-lg">
              Contáctanos para una demo personalizada
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
