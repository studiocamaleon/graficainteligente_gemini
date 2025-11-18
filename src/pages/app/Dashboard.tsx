import { motion } from 'framer-motion';
import { TrendingUp, Users, Package, DollarSign } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { staggerContainer, staggerItem } from '../../animations/variants';
import { usePageHeader } from '../../hooks/usePageHeader';

export function Dashboard() {
  usePageHeader('Vista general de tu negocio');

  const stats = [
    { label: 'Órdenes Activas', value: '0', icon: Package, color: 'text-blue-600' },
    { label: 'Clientes', value: '0', icon: Users, color: 'text-green-600' },
    { label: 'Ingresos del Mes', value: '$0', icon: DollarSign, color: 'text-orange-600' },
    { label: 'Crecimiento', value: '0%', icon: TrendingUp, color: 'text-cyan-600' },
  ];

  return (
    <div>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={staggerItem}>
              <Card hover padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card padding="lg">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Actividad Reciente</h3>
          <div className="text-center py-12 text-gray-500">
            No hay actividad reciente
          </div>
        </Card>

        <Card padding="lg">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Próximas Entregas</h3>
          <div className="text-center py-12 text-gray-500">
            No hay entregas programadas
          </div>
        </Card>
      </div>
    </div>
  );
}
