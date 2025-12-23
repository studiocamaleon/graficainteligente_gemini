import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface DashboardStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bgColor?: string;
  subtitle?: string;
  loading?: boolean;
  onClick?: () => void;
}

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor = 'bg-gray-100',
  subtitle,
  loading,
  onClick,
}: DashboardStatCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
          </CardTitle>
          <div className={`w-8 h-8 rounded-lg bg-gray-200 animate-pulse`}></div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            <div className="h-8 bg-gray-200 rounded w-16 animate-pulse mt-2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={onClick ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : ''}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <div className={`p-2 rounded-xl ${bgColor}`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
