import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { MODULES } from '../../constants/branding';

export function ModulesSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-purple-50/30 via-white to-blue-50/30">
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
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
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
                  <div className="bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl p-8 aspect-video flex items-center justify-center shadow-lg">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                        <span className="text-white text-3xl font-bold">{index + 1}</span>
                      </div>
                      <p className="text-purple-700 font-semibold text-lg">{module.title}</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <h3 className="text-3xl font-bold text-gray-900">{module.title}</h3>
                  <p className="text-lg text-gray-600 leading-relaxed">{module.description}</p>
                  <ul className="space-y-3">
                    {module.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-lime-500 flex-shrink-0 mt-0.5" />
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
