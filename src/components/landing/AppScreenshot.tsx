import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface Stat {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  trend?: string;
}

interface AppScreenshotProps {
  title: string;
  stats: Stat[];
  variant?: 'dashboard' | 'table' | 'wizard' | 'list';
  delay?: number;
}

export function AppScreenshot({ title, stats, variant = 'dashboard', delay = 0 }: AppScreenshotProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      className="relative"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-3xl blur-2xl"></div>

      <div className="relative bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 p-6 sm:p-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-200">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">{title}</h3>
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>

          {variant === 'dashboard' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ scale: 0.8, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: delay + 0.2 + index * 0.1 }}
                    className={`${
                      index === stats.length - 1 && stats.length % 2 !== 0
                        ? 'sm:col-span-2'
                        : ''
                    } bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-600 truncate">{stat.label}</p>
                        <p className="text-xl sm:text-2xl font-bold text-gray-900">{stat.value}</p>
                      </div>
                    </div>
                    {stat.trend && (
                      <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <span>↗</span>
                        <span>{stat.trend}</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {variant === 'table' && (
            <div className="space-y-3">
              {stats.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    {(() => {
                      const Icon = stats[0].icon;
                      return <Icon className="w-5 h-5 text-white" />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">Sistema de Filtrado Avanzado</p>
                    <p className="text-xs text-gray-600">Búsqueda y filtros en tiempo real</p>
                  </div>
                </div>
              )}

              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: delay + 0.3 + index * 0.1 }}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 ${stat.color} rounded-lg flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm text-gray-700">{stat.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{stat.value}</span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {variant === 'wizard' && (
            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`flex-1 h-2 rounded-full ${
                      step <= 2 ? 'bg-gradient-to-r from-blue-600 to-cyan-600' : 'bg-gray-200'
                    }`}
                  ></div>
                ))}
              </div>

              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: delay + 0.2 + index * 0.1 }}
                    className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{stat.label}</p>
                        <p className="text-xs text-gray-600 mt-1">{stat.value}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {variant === 'list' && (
            <div className="space-y-3">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: delay + 0.2 + index * 0.1 }}
                    className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{stat.label}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{stat.value}</p>
                    </div>
                    {stat.trend && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{stat.trend}</p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
