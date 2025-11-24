import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/es';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('es');

const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

interface DatePickerProps {
  label?: string;
  value: string | null;
  onChange: (date: string | null) => void;
  minDate?: Date | string;
  maxDate?: Date | string;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  error,
  placeholder = 'Seleccionar fecha',
  required,
  disabled,
  helperText,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(
    value ? dayjs(value).tz(ARGENTINA_TIMEZONE) : dayjs().tz(ARGENTINA_TIMEZONE)
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const minDateObj = minDate ? dayjs(minDate).tz(ARGENTINA_TIMEZONE) : null;
  const maxDateObj = maxDate ? dayjs(maxDate).tz(ARGENTINA_TIMEZONE) : null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getDaysInMonth = () => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const daysInMonth = currentMonth.daysInMonth();
    const startDayOfWeek = startOfMonth.day();

    const days: (dayjs.Dayjs | null)[] = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(currentMonth.date(i));
    }

    return days;
  };

  const isDateDisabled = (date: dayjs.Dayjs | null): boolean => {
    if (!date) return true;
    if (minDateObj && date.isBefore(minDateObj, 'day')) return true;
    if (maxDateObj && date.isAfter(maxDateObj, 'day')) return true;
    return false;
  };

  const handleDateSelect = (date: dayjs.Dayjs) => {
    if (!isDateDisabled(date)) {
      onChange(date.format('YYYY-MM-DD'));
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleShortcut = (daysToAdd: number) => {
    const newDate = dayjs().tz(ARGENTINA_TIMEZONE).add(daysToAdd, 'day');
    if (!isDateDisabled(newDate)) {
      onChange(newDate.format('YYYY-MM-DD'));
      setIsOpen(false);
    }
  };

  const previousMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, 'month'));
  };

  const nextMonth = () => {
    setCurrentMonth(currentMonth.add(1, 'month'));
  };

  const formatDisplayDate = (date: string | null) => {
    if (!date) return '';
    return dayjs(date).tz(ARGENTINA_TIMEZONE).format('DD/MM/YYYY');
  };

  const days = getDaysInMonth();
  const weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  const shortcuts = [
    { label: 'Hoy', days: 0 },
    { label: 'Mañana', days: 1 },
    { label: '+3 días', days: 3 },
    { label: '+7 días', days: 7 },
  ];

  return (
    <div ref={containerRef} className="relative max-w-xs w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          relative w-full px-4 py-2.5 rounded-lg border-2 transition-all cursor-pointer
          ${error
            ? 'border-red-500 focus-within:border-red-600'
            : 'border-slate-300 hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-200'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'}
        `}
      >
        <div className="flex items-center justify-between">
          <span className={value ? 'text-slate-900' : 'text-slate-400'}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
          <div className="flex items-center gap-2">
            {value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <Calendar className="w-5 h-5 text-slate-400" />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 w-full min-w-[320px]"
          >
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={previousMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>

              <div className="text-base font-semibold text-slate-900">
                {currentMonth.format('MMMM YYYY')}
              </div>

              <button
                type="button"
                onClick={nextMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day, index) => (
                <div
                  key={index}
                  className="text-center text-xs font-medium text-slate-500 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const isSelected = value && day.isSame(dayjs(value).tz(ARGENTINA_TIMEZONE), 'day');
                const isToday = day.isSame(dayjs().tz(ARGENTINA_TIMEZONE), 'day');
                const isDisabled = isDateDisabled(day);

                return (
                  <button
                    key={day.format('YYYY-MM-DD')}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    disabled={isDisabled}
                    className={`
                      aspect-square rounded-lg text-sm font-medium transition-all
                      ${isSelected
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : isToday
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        : 'text-slate-700 hover:bg-slate-100'
                      }
                      ${isDisabled
                        ? 'opacity-40 cursor-not-allowed hover:bg-transparent'
                        : 'cursor-pointer'
                      }
                    `}
                  >
                    {day.date()}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
              {shortcuts.map((shortcut) => (
                <button
                  key={shortcut.label}
                  type="button"
                  onClick={() => handleShortcut(shortcut.days)}
                  className="flex-1 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  {shortcut.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}
