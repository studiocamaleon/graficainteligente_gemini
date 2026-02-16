import { motion } from 'framer-motion';
import { Sun, Moon, Sunset, CalendarClock } from 'lucide-react';
import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent } from '../ui/card';

interface WelcomeIntroProps {
  loading?: boolean;
}

export function WelcomeIntro({ loading }: WelcomeIntroProps) {
  const { profile } = useAuth();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return { text: 'Buenos días', Icon: Sun };
    }
    if (hour >= 12 && hour < 20) {
      return { text: 'Buenas tardes', Icon: Sunset };
    }
    return { text: 'Buenas noches', Icon: Moon };
  }, []);

  const Icon = greeting.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Centro de Control</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {greeting.text}, {profile?.full_name?.split(' ')[0] || 'equipo'}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Resumen operativo del día y próximas acciones.
              </p>
            </div>

            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 md:flex">
              <Icon className="h-4 w-4" />
              <CalendarClock className="h-4 w-4" />
            </div>
          </div>

          {loading && (
            <div className="mt-4 h-2 w-40 animate-pulse rounded bg-slate-200" />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
