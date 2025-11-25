import { Plus, X } from 'lucide-react';
import { Switch } from '../ui/Switch';
import { Button } from '../ui/Button';
import { TimeRangePicker } from '../ui/TimeRangePicker';
import type { DaySchedule, DayOfWeek } from '../../types/database';

interface DayScheduleEditorProps {
  schedule: DaySchedule;
  onChange: (dayOfWeek: DayOfWeek, updates: Partial<DaySchedule>) => void;
  onToggle: (dayOfWeek: DayOfWeek) => void;
  disabled?: boolean;
}

export function DayScheduleEditor({
  schedule,
  onChange,
  onToggle,
  disabled = false,
}: DayScheduleEditorProps) {
  const hasSecondRange = schedule.opening_time_2 !== '' && schedule.closing_time_2 !== '';

  const handleAddSecondRange = () => {
    onChange(schedule.day_of_week, {
      opening_time_2: '15:00',
      closing_time_2: '19:00',
    });
  };

  const handleRemoveSecondRange = () => {
    onChange(schedule.day_of_week, {
      opening_time_2: '',
      closing_time_2: '',
    });
  };

  return (
    <div
      className={`p-4 rounded-lg border-2 transition-all ${
        schedule.is_open
          ? 'border-green-200 bg-green-50'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Switch
            checked={schedule.is_open}
            onChange={() => onToggle(schedule.day_of_week)}
            disabled={disabled}
          />
          <span className="font-medium text-gray-900">{schedule.day_name}</span>
        </div>
        {schedule.is_open && (
          <span className="text-xs text-green-600 font-medium">Abierto</span>
        )}
        {!schedule.is_open && (
          <span className="text-xs text-gray-500 font-medium">Cerrado</span>
        )}
      </div>

      {schedule.is_open && (
        <div className="space-y-3">
          <TimeRangePicker
            startValue={schedule.opening_time_1}
            endValue={schedule.closing_time_1}
            onStartChange={(value) =>
              onChange(schedule.day_of_week, { opening_time_1: value })
            }
            onEndChange={(value) =>
              onChange(schedule.day_of_week, { closing_time_1: value })
            }
            startLabel="Apertura"
            endLabel="Cierre"
            disabled={disabled}
          />

          {hasSecondRange && (
            <div className="pl-4 border-l-2 border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-700">
                  Segundo horario
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveSecondRange}
                  disabled={disabled}
                  className="h-6 px-2 text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Quitar
                </Button>
              </div>
              <TimeRangePicker
                startValue={schedule.opening_time_2}
                endValue={schedule.closing_time_2}
                onStartChange={(value) =>
                  onChange(schedule.day_of_week, { opening_time_2: value })
                }
                onEndChange={(value) =>
                  onChange(schedule.day_of_week, { closing_time_2: value })
                }
                startLabel="Apertura"
                endLabel="Cierre"
                disabled={disabled}
              />
            </div>
          )}

          {!hasSecondRange && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSecondRange}
              disabled={disabled}
              className="w-full text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Agregar segundo horario
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
