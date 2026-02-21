import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  hint?: string;
  icon: LucideIcon;
  tone?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate';
  delta?: number;
}

const toneMap = {
  cyan: 'from-cyan-500 to-blue-500',
  emerald: 'from-emerald-500 to-teal-500',
  amber: 'from-amber-500 to-orange-500',
  rose: 'from-rose-500 to-pink-500',
  indigo: 'from-indigo-500 to-violet-500',
  slate: 'from-slate-500 to-slate-700',
};

export function KPICard({
  title,
  value,
  subtitle,
  hint,
  icon: Icon,
  tone = 'cyan',
  delta,
}: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${toneMap[tone]} text-white shadow`}>
        <Icon className="h-5 w-5" />
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>

      {(subtitle || delta !== undefined) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{subtitle || ''}</p>
          {delta !== undefined && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {hint && <p className="mt-2 text-[11px] leading-4 text-slate-400">{hint}</p>}

      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-100/60 blur-2xl" />
    </motion.div>
  );
}
