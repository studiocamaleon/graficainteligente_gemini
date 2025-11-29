import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card } from '../ui/Card';

interface DashboardStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bgColor?: string;
  subtitle?: string;
  loading?: boolean;
}

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor = 'bg-gray-100',
  subtitle,
  loading,
}: DashboardStatCardProps) {
  if (loading) {
    return (
      <Card hover padding="md">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
            <div className="h-8 bg-gray-200 rounded w-16 animate-pulse"></div>
          </div>
          <div className={`w-12 h-12 rounded-xl ${bgColor} animate-pulse`}></div>
        </div>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card hover padding="md">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">{label}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
