import {
  FileText,
  Clock,
  CheckCircle,
  TrendingUp,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../ui/Card';
import type { PresupuestoConRelaciones } from '../../types/presupuestos';

interface PresupuestosStatsProps {
  presupuestos: PresupuestoConRelaciones[];
}

export function PresupuestosStats({ presupuestos }: PresupuestosStatsProps) {
  // Calcular estadísticas
  const stats = {
    total: presupuestos.length,
    borradores: presupuestos.filter((p) => p.estado === 'borrador').length,
    enviados: presupuestos.filter((p) => p.estado === 'enviado').length,
    aprobados: presupuestos.filter((p) => p.estado === 'aprobado').length,
    rechazados: presupuestos.filter((p) => p.estado === 'rechazado').length,
    convertidos: presupuestos.filter((p) => p.estado === 'convertido').length,
    vencidos: presupuestos.filter((p) => p.estado === 'vencido').length,
    porVencer: presupuestos.filter((p) => {
      if (!p.fecha_validez || p.estado !== 'enviado') return false;
      const dias = Math.ceil(
        (new Date(p.fecha_validez).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return dias > 0 && dias <= 7;
    }).length,
  };

  // Valor total
  const valorTotal = presupuestos.reduce((sum, p) => sum + Number(p.total), 0);

  // Valor en negociación (enviados + pendientes)
  const valorEnNegociacion = presupuestos
    .filter((p) => ['enviado', 'pendiente'].includes(p.estado))
    .reduce((sum, p) => sum + Number(p.total), 0);

  // Tasa de conversión
  const totalEnviados = presupuestos.filter((p) =>
    ['enviado', 'aprobado', 'rechazado', 'convertido', 'vencido'].includes(p.estado)
  ).length;
  const tasaConversion =
    totalEnviados > 0 ? (stats.aprobados / totalEnviados) * 100 : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const statCards = [
    {
      title: 'Total Presupuestos',
      value: stats.total.toString(),
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'En Negociación',
      value: stats.enviados.toString(),
      subtitle: formatCurrency(valorEnNegociacion),
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Aprobados',
      value: stats.aprobados.toString(),
      subtitle: `${stats.convertidos} convertidos`,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Tasa Conversión',
      value: `${tasaConversion.toFixed(1)}%`,
      subtitle: `${stats.aprobados} de ${totalEnviados}`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Valor Total',
      value: formatCurrency(valorTotal),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Por Vencer (7 días)',
      value: stats.porVencer.toString(),
      subtitle: stats.vencidos > 0 ? `${stats.vencidos} vencidos` : undefined,
      icon: AlertCircle,
      color: stats.porVencer > 0 ? 'text-yellow-600' : 'text-gray-400',
      bgColor: stats.porVencer > 0 ? 'bg-yellow-50' : 'bg-gray-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mb-1">
                  {stat.value}
                </p>
                {stat.subtitle && (
                  <p className="text-xs text-gray-500">{stat.subtitle}</p>
                )}
              </div>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
