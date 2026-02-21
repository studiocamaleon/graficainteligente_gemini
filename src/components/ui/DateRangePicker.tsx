import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}

const TZ = 'America/Argentina/Buenos_Aires';

const weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => (startDate ? dayjs(startDate) : dayjs()));
  const [draftStart, setDraftStart] = useState<dayjs.Dayjs | null>(startDate ? dayjs(startDate) : null);
  const [draftEnd, setDraftEnd] = useState<dayjs.Dayjs | null>(endDate ? dayjs(endDate) : null);
  const containerRef = useRef<HTMLDivElement>(null);

  const start = startDate ? dayjs(startDate) : null;
  const end = endDate ? dayjs(endDate) : null;

  useEffect(() => {
    if (isOpen) {
      setDraftStart(startDate ? dayjs(startDate) : null);
      setDraftEnd(endDate ? dayjs(endDate) : null);
    }
  }, [isOpen, startDate, endDate]);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [isOpen]);

  const days = useMemo(() => {
    const firstDay = currentMonth.startOf('month');
    const startOffset = firstDay.day();
    const totalDays = currentMonth.daysInMonth();
    const out: Array<dayjs.Dayjs | null> = [];
    for (let i = 0; i < startOffset; i += 1) out.push(null);
    for (let d = 1; d <= totalDays; d += 1) out.push(currentMonth.date(d));
    return out;
  }, [currentMonth]);

  const isInRange = (day: dayjs.Dayjs) => {
    if (!draftStart || !draftEnd) return false;
    return day.isAfter(draftStart, 'day') && day.isBefore(draftEnd, 'day');
  };

  const applyPreset = (preset: '7d' | '30d' | 'mes') => {
    const now = dayjs();
    if (preset === '7d') {
      onChange(now.subtract(6, 'day').format('YYYY-MM-DD'), now.format('YYYY-MM-DD'));
      return;
    }
    if (preset === '30d') {
      onChange(now.subtract(29, 'day').format('YYYY-MM-DD'), now.format('YYYY-MM-DD'));
      return;
    }
    onChange(now.startOf('month').format('YYYY-MM-DD'), now.endOf('month').format('YYYY-MM-DD'));
  };

  const pickDay = (day: dayjs.Dayjs) => {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(day);
      setDraftEnd(null);
      return;
    }
    if (day.isBefore(draftStart, 'day')) {
      onChange(day.format('YYYY-MM-DD'), draftStart.format('YYYY-MM-DD'));
      setIsOpen(false);
      return;
    }
    onChange(draftStart.format('YYYY-MM-DD'), day.format('YYYY-MM-DD'));
    setIsOpen(false);
  };

  const label = start && end
    ? `${start.format('DD/MM/YYYY')} - ${end.format('DD/MM/YYYY')}`
    : start
      ? `${start.format('DD/MM/YYYY')} - ...`
      : 'Elegir rango';

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full rounded-xl border border-cyan-200 bg-white/90 px-4 py-2.5 text-left text-sm text-slate-700 shadow-sm transition hover:border-cyan-300"
      >
        <span className="inline-flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-cyan-600" />
          {label}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="absolute z-50 mt-2 w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => setCurrentMonth((m) => m.subtract(1, 'month'))} className="rounded-lg p-2 hover:bg-slate-100">
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <p className="text-sm font-semibold capitalize text-slate-800">{currentMonth.format('MMMM YYYY')}</p>
              <button type="button" onClick={() => setCurrentMonth((m) => m.add(1, 'month'))} className="rounded-lg p-2 hover:bg-slate-100">
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div key={day} className="py-1 text-center text-[11px] font-semibold text-slate-500">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} className="h-9" />;
                const selectedStart = !!draftStart && day.isSame(draftStart, 'day');
                const selectedEnd = !!draftEnd && day.isSame(draftEnd, 'day');
                const inRange = isInRange(day);
                return (
                  <button
                    key={day.format('YYYY-MM-DD')}
                    type="button"
                    onClick={() => pickDay(day)}
                    className={`h-9 rounded-lg text-sm font-medium transition ${
                      selectedStart || selectedEnd
                        ? 'bg-cyan-500 text-white'
                        : inRange
                          ? 'bg-cyan-100 text-cyan-900'
                          : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {day.date()}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => applyPreset('7d')} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">Últimos 7 días</button>
              <button type="button" onClick={() => applyPreset('30d')} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">Últimos 30 días</button>
              <button type="button" onClick={() => applyPreset('mes')} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">Este mes</button>
              <button
                type="button"
                onClick={() => {
                  setDraftStart(null);
                  setDraftEnd(null);
                  onChange('', '');
                }}
                className="rounded-full border border-rose-200 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50"
              >
                Limpiar
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Zona horaria: {TZ}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
