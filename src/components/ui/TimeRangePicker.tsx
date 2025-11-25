import { Clock } from 'lucide-react';
import { Input } from './Input';

interface TimeRangePickerProps {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startLabel?: string;
  endLabel?: string;
  disabled?: boolean;
  error?: string;
}

export function TimeRangePicker({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startLabel = 'Desde',
  endLabel = 'Hasta',
  disabled = false,
  error,
}: TimeRangePickerProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            <Clock className="w-3 h-3 inline-block mr-1" />
            {startLabel}
          </label>
          <Input
            type="time"
            value={startValue}
            onChange={(e) => onStartChange(e.target.value)}
            disabled={disabled}
            className="text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            <Clock className="w-3 h-3 inline-block mr-1" />
            {endLabel}
          </label>
          <Input
            type="time"
            value={endValue}
            onChange={(e) => onEndChange(e.target.value)}
            disabled={disabled}
            className="text-sm"
          />
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
