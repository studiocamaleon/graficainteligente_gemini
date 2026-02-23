import { AlertTriangle, ArrowDownRight, ArrowUpRight, ShieldAlert, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '../ui/card';

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

interface CashflowV2KpiStripProps {
  currentBalance: number;
  projectedBalance: number;
  wipOverdue: number;
  otherOverdue: number;
  overdueOut: number;
  criticalDays: number;
}

export function CashflowV2KpiStrip({
  currentBalance,
  projectedBalance,
  wipOverdue,
  otherOverdue,
  overdueOut,
  criticalDays,
}: CashflowV2KpiStripProps) {
  const items = [
    {
      id: 'current',
      title: 'Saldo actual',
      value: formatMoney(currentBalance),
      tone: 'text-slate-900',
      bg: 'from-white to-slate-50',
      icon: Wallet,
      note: 'Caja consolidada',
    },
    {
      id: 'projected',
      title: 'Saldo proyectado',
      value: formatMoney(projectedBalance),
      tone: projectedBalance >= 0 ? 'text-emerald-700' : 'text-rose-700',
      bg: projectedBalance >= 0 ? 'from-emerald-50 to-white' : 'from-rose-50 to-white',
      icon: projectedBalance >= 0 ? ArrowUpRight : ArrowDownRight,
      note: 'Cierre del horizonte',
    },
    {
      id: 'wipOverdue',
      title: 'Cobros vencidos (WIP)',
      value: formatMoney(wipOverdue),
      tone: 'text-emerald-700',
      bg: 'from-emerald-50 to-white',
      icon: ArrowUpRight,
      note: 'Órdenes vencidas pendientes',
    },
    {
      id: 'otherOverdue',
      title: 'Otros vencidos',
      value: formatMoney(otherOverdue),
      tone: 'text-teal-700',
      bg: 'from-teal-50 to-white',
      icon: ArrowUpRight,
      note: 'Cheques + liquidaciones',
    },
    {
      id: 'overdueOut',
      title: 'Deudas vencidas',
      value: formatMoney(overdueOut),
      tone: 'text-rose-700',
      bg: 'from-rose-50 to-white',
      icon: AlertTriangle,
      note: `Días críticos: ${criticalDays}`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.25 }}
          >
            <Card className={`border-slate-200 bg-gradient-to-br ${item.bg} p-4 shadow-md`}>
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.title}</p>
                <Icon className={`h-4 w-4 ${item.tone}`} />
              </div>
              <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
              <p className="mt-1 text-xs text-slate-500">{item.note}</p>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
