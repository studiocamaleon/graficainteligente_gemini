import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/card';

interface BISectionCardProps {
  title: string;
  description?: string;
  right?: ReactNode;
  children: ReactNode;
}

export function BISectionCard({ title, description, right, children }: BISectionCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
      <Card className="overflow-hidden border-slate-200 bg-white/95 backdrop-blur">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-cyan-50/40 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
              {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
            </div>
            {right}
          </div>
        </div>
        <div className="p-5">{children}</div>
      </Card>
    </motion.div>
  );
}
