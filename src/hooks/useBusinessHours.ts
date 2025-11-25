import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { BusinessHours, DaySchedule, DayOfWeek } from '../types/database';
import { getDayName, validateTimeRange, compareTimeRanges } from '../utils/timeUtils';

export function useBusinessHours() {
  const { company } = useAuth();
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeEmptySchedules = useCallback((): DaySchedule[] => {
    return Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i as DayOfWeek,
      day_name: getDayName(i),
      is_open: false,
      opening_time_1: '',
      closing_time_1: '',
      opening_time_2: '',
      closing_time_2: '',
    }));
  }, []);

  const fetchBusinessHours = useCallback(async () => {
    if (!company?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('company_business_hours')
        .select('*')
        .eq('company_id', company.id)
        .order('day_of_week');

      if (fetchError) throw fetchError;

      const emptySchedules = initializeEmptySchedules();

      if (data && data.length > 0) {
        const mappedSchedules = emptySchedules.map((emptyDay) => {
          const existingDay = data.find((d: BusinessHours) => d.day_of_week === emptyDay.day_of_week);
          if (existingDay) {
            return {
              day_of_week: existingDay.day_of_week,
              day_name: getDayName(existingDay.day_of_week),
              is_open: existingDay.is_open,
              opening_time_1: existingDay.opening_time_1 || '',
              closing_time_1: existingDay.closing_time_1 || '',
              opening_time_2: existingDay.opening_time_2 || '',
              closing_time_2: existingDay.closing_time_2 || '',
            };
          }
          return emptyDay;
        });
        setSchedules(mappedSchedules);
      } else {
        setSchedules(emptySchedules);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar horarios');
      console.error('Error fetching business hours:', err);
    } finally {
      setLoading(false);
    }
  }, [company?.id, initializeEmptySchedules]);

  useEffect(() => {
    fetchBusinessHours();
  }, [fetchBusinessHours]);

  const updateSchedule = useCallback((dayOfWeek: DayOfWeek, updates: Partial<DaySchedule>) => {
    setSchedules((prev) =>
      prev.map((schedule) =>
        schedule.day_of_week === dayOfWeek
          ? { ...schedule, ...updates }
          : schedule
      )
    );
  }, []);

  const toggleDayStatus = useCallback((dayOfWeek: DayOfWeek) => {
    setSchedules((prev) =>
      prev.map((schedule) => {
        if (schedule.day_of_week === dayOfWeek) {
          if (schedule.is_open) {
            return {
              ...schedule,
              is_open: false,
              opening_time_1: '',
              closing_time_1: '',
              opening_time_2: '',
              closing_time_2: '',
            };
          } else {
            return {
              ...schedule,
              is_open: true,
            };
          }
        }
        return schedule;
      })
    );
  }, []);

  const applyToMultipleDays = useCallback((sourceDayOfWeek: DayOfWeek, targetDays: DayOfWeek[]) => {
    const sourceSchedule = schedules.find((s) => s.day_of_week === sourceDayOfWeek);
    if (!sourceSchedule) return;

    setSchedules((prev) =>
      prev.map((schedule) => {
        if (targetDays.includes(schedule.day_of_week)) {
          return {
            ...schedule,
            is_open: sourceSchedule.is_open,
            opening_time_1: sourceSchedule.opening_time_1,
            closing_time_1: sourceSchedule.closing_time_1,
            opening_time_2: sourceSchedule.opening_time_2,
            closing_time_2: sourceSchedule.closing_time_2,
          };
        }
        return schedule;
      })
    );
  }, [schedules]);

  const validateSchedule = useCallback((schedule: DaySchedule): string | null => {
    if (!schedule.is_open) return null;

    const error1 = validateTimeRange(schedule.opening_time_1, schedule.closing_time_1);
    if (error1) return `Primer rango: ${error1}`;

    if (schedule.opening_time_2 && schedule.closing_time_2) {
      const error2 = validateTimeRange(schedule.opening_time_2, schedule.closing_time_2);
      if (error2) return `Segundo rango: ${error2}`;

      if (
        compareTimeRanges(
          schedule.opening_time_1,
          schedule.closing_time_1,
          schedule.opening_time_2,
          schedule.closing_time_2
        )
      ) {
        return 'Los rangos horarios no pueden traslaparse';
      }
    }

    if ((schedule.opening_time_2 && !schedule.closing_time_2) || (!schedule.opening_time_2 && schedule.closing_time_2)) {
      return 'Debe completar ambos horarios del segundo rango';
    }

    return null;
  }, []);

  const saveBusinessHours = useCallback(async () => {
    if (!company?.id) {
      setError('No hay empresa seleccionada');
      return { success: false, error: 'No hay empresa seleccionada' };
    }

    for (const schedule of schedules) {
      const validationError = validateSchedule(schedule);
      if (validationError) {
        const errorMsg = `${schedule.day_name}: ${validationError}`;
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    }

    try {
      setLoading(true);
      setError(null);

      const upsertData = schedules.map((schedule) => ({
        company_id: company.id,
        day_of_week: schedule.day_of_week,
        is_open: schedule.is_open,
        opening_time_1: schedule.is_open && schedule.opening_time_1 ? schedule.opening_time_1 : null,
        closing_time_1: schedule.is_open && schedule.closing_time_1 ? schedule.closing_time_1 : null,
        opening_time_2: schedule.is_open && schedule.opening_time_2 ? schedule.opening_time_2 : null,
        closing_time_2: schedule.is_open && schedule.closing_time_2 ? schedule.closing_time_2 : null,
      }));

      const { error: upsertError } = await supabase
        .from('company_business_hours')
        .upsert(upsertData, {
          onConflict: 'company_id,day_of_week',
        });

      if (upsertError) throw upsertError;

      await fetchBusinessHours();

      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al guardar horarios';
      setError(errorMsg);
      console.error('Error saving business hours:', err);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [company?.id, schedules, validateSchedule, fetchBusinessHours]);

  return {
    schedules,
    loading,
    error,
    updateSchedule,
    toggleDayStatus,
    applyToMultipleDays,
    saveBusinessHours,
    refetch: fetchBusinessHours,
  };
}
