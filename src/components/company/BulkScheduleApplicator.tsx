import { useState } from 'react';
import { Copy, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import type { DaySchedule, DayOfWeek } from '../../types/database';

interface BulkScheduleApplicatorProps {
  isOpen: boolean;
  onClose: () => void;
  schedules: DaySchedule[];
  onApply: (sourceDayOfWeek: DayOfWeek, targetDays: DayOfWeek[]) => void;
}

export function BulkScheduleApplicator({
  isOpen,
  onClose,
  schedules,
  onApply,
}: BulkScheduleApplicatorProps) {
  const [sourceDayOfWeek, setSourceDayOfWeek] = useState<DayOfWeek | ''>('');
  const [selectedDays, setSelectedDays] = useState<Set<DayOfWeek>>(new Set());

  const sourceSchedule = schedules.find((s) => s.day_of_week === sourceDayOfWeek);

  const handleDayToggle = (dayOfWeek: DayOfWeek) => {
    const newSelected = new Set(selectedDays);
    if (newSelected.has(dayOfWeek)) {
      newSelected.delete(dayOfWeek);
    } else {
      newSelected.add(dayOfWeek);
    }
    setSelectedDays(newSelected);
  };

  const handleApply = () => {
    if (sourceDayOfWeek === '' || selectedDays.size === 0) return;
    onApply(sourceDayOfWeek, Array.from(selectedDays));
    setSelectedDays(new Set());
    setSourceDayOfWeek('');
    onClose();
  };

  const handleClose = () => {
    setSelectedDays(new Set());
    setSourceDayOfWeek('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Aplicar horario a varios días">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Copiar horario desde:
          </label>
          <Select
            value={sourceDayOfWeek.toString()}
            onChange={(e) => setSourceDayOfWeek(Number(e.target.value) as DayOfWeek)}
          >
            <option value="">Selecciona un día</option>
            {schedules.map((schedule) => (
              <option key={schedule.day_of_week} value={schedule.day_of_week}>
                {schedule.day_name}
                {schedule.is_open
                  ? ` (${schedule.opening_time_1} - ${schedule.closing_time_1}${
                      schedule.opening_time_2
                        ? ` y ${schedule.opening_time_2} - ${schedule.closing_time_2}`
                        : ''
                    })`
                  : ' (Cerrado)'}
              </option>
            ))}
          </Select>
        </div>

        {sourceSchedule && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              Horario a aplicar:
            </h4>
            {sourceSchedule.is_open ? (
              <div className="space-y-1 text-sm text-blue-800">
                <p>
                  Primer horario: {sourceSchedule.opening_time_1} - {sourceSchedule.closing_time_1}
                </p>
                {sourceSchedule.opening_time_2 && sourceSchedule.closing_time_2 && (
                  <p>
                    Segundo horario: {sourceSchedule.opening_time_2} - {sourceSchedule.closing_time_2}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-blue-800">Día cerrado</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Aplicar a estos días:
          </label>
          <div className="space-y-2">
            {schedules.map((schedule) => {
              const isDisabled = schedule.day_of_week === sourceDayOfWeek;
              return (
                <label
                  key={schedule.day_of_week}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    isDisabled
                      ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
                      : selectedDays.has(schedule.day_of_week)
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-gray-200 hover:border-blue-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedDays.has(schedule.day_of_week)}
                    onChange={() => handleDayToggle(schedule.day_of_week)}
                    disabled={isDisabled}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    {schedule.day_name}
                  </span>
                  {schedule.is_open && (
                    <span className="ml-auto text-xs text-gray-500">
                      {schedule.opening_time_1} - {schedule.closing_time_1}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {selectedDays.size > 0 && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800">
              Los horarios existentes de los días seleccionados serán reemplazados.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={sourceDayOfWeek === '' || selectedDays.size === 0}
          >
            <Copy className="w-4 h-4 mr-2" />
            Aplicar a {selectedDays.size} {selectedDays.size === 1 ? 'día' : 'días'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
