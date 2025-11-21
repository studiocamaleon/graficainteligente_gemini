import Datepicker from 'react-tailwindcss-datepicker';
import dayjs from 'dayjs';

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

  const today = dayjs().format('YYYY-MM-DD');
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  const in3Days = dayjs().add(3, 'day').format('YYYY-MM-DD');
  const in7Days = dayjs().add(7, 'day').format('YYYY-MM-DD');

  const shortcuts = [
    {
      text: "Hoy",
      period: {
        start: today,
        end: today,
      },
    },
    {
      text: "Mañana",
      period: {
        start: tomorrow,
        end: tomorrow,
      },
    },
    {
      text: "En 3 días",
      period: {
        start: in3Days,
        end: in3Days,
      },
    },
    {
      text: "En 7 días",
      period: {
        start: in7Days,
        end: in7Days,
      },
    },
  ];

  const dateValue = value
    ? { startDate: value, endDate: value }
    : null;

  const handleChange = (newValue: any) => {
    const isoDate = newValue?.startDate || null;
    onChange(isoDate);
  };

  return (
    <div className="max-w-xs w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <Datepicker
        useRange={false}
        asSingle={true}
        value={dateValue}
        onChange={handleChange}
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        placeholder={placeholder}
        displayFormat="DD/MM/YYYY"
        shortcuts={shortcuts}
        inputClassName={`
          w-full px-4 py-2.5 rounded-lg border-2 transition-colors
          focus:outline-none focus:ring-4 focus:ring-blue-200
          ${error
            ? 'border-red-500 focus:border-red-600'
            : 'border-slate-300 focus:border-blue-500 hover:border-slate-400'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer bg-white'}
        `}
        containerClassName="relative"
        toggleClassName="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        primaryColor="blue"
      />

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}
