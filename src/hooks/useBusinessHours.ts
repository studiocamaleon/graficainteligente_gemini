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
    console.group(`🔍 DEBUG: Validando ${schedule.day_name}`);
    console.log('is_open:', schedule.is_open);

    if (!schedule.is_open) {
      console.log('✅ Día cerrado, no requiere validación');
      console.groupEnd();
      return null;
    }

    console.log('opening_time_1:', JSON.stringify(schedule.opening_time_1), `(length: ${schedule.opening_time_1.length}, codes: [${[...schedule.opening_time_1].map(c => c.charCodeAt(0)).join(',')}])`);
    console.log('closing_time_1:', JSON.stringify(schedule.closing_time_1), `(length: ${schedule.closing_time_1.length}, codes: [${[...schedule.closing_time_1].map(c => c.charCodeAt(0)).join(',')}])`);

    if (schedule.opening_time_2 || schedule.closing_time_2) {
      console.log('opening_time_2:', JSON.stringify(schedule.opening_time_2), `(length: ${schedule.opening_time_2.length}, codes: [${[...schedule.opening_time_2].map(c => c.charCodeAt(0)).join(',')}])`);
      console.log('closing_time_2:', JSON.stringify(schedule.closing_time_2), `(length: ${schedule.closing_time_2.length}, codes: [${[...schedule.closing_time_2].map(c => c.charCodeAt(0)).join(',')}])`);
    }

    console.log('Validando primer rango...');
    const error1 = validateTimeRange(schedule.opening_time_1, schedule.closing_time_1);
    if (error1) {
      console.error('❌ Error en primer rango:', error1);
      console.groupEnd();
      return `Primer rango: ${error1}`;
    }
    console.log('✅ Primer rango válido');

    if (schedule.opening_time_2 && schedule.closing_time_2) {
      console.log('Validando segundo rango...');
      const error2 = validateTimeRange(schedule.opening_time_2, schedule.closing_time_2);
      if (error2) {
        console.error('❌ Error en segundo rango:', error2);
        console.groupEnd();
        return `Segundo rango: ${error2}`;
      }
      console.log('✅ Segundo rango válido');

      console.log('Verificando traslape de rangos...');
      if (
        compareTimeRanges(
          schedule.opening_time_1,
          schedule.closing_time_1,
          schedule.opening_time_2,
          schedule.closing_time_2
        )
      ) {
        console.error('❌ Los rangos se traslapan');
        console.groupEnd();
        return 'Los rangos horarios no pueden traslaparse';
      }
      console.log('✅ No hay traslape');
    }

    if ((schedule.opening_time_2 && !schedule.closing_time_2) || (!schedule.opening_time_2 && schedule.closing_time_2)) {
      console.error('❌ Segundo rango incompleto');
      console.groupEnd();
      return 'Debe completar ambos horarios del segundo rango';
    }

    console.log('✅ Validación completa exitosa');
    console.groupEnd();
    return null;
  }, []);

  const saveBusinessHours = useCallback(async () => {
    console.group('🔍 DEBUG: Guardando horarios');
    console.log('Company ID:', company?.id);
    console.log('Total schedules:', schedules.length);

    if (!company?.id) {
      console.error('❌ No hay empresa seleccionada');
      console.groupEnd();
      setError('No hay empresa seleccionada');
      return { success: false, error: 'No hay empresa seleccionada' };
    }

    console.log('Schedules a validar:');
    console.table(schedules.map(s => ({
      dia: s.day_name,
      abierto: s.is_open,
      apertura1: s.opening_time_1,
      cierre1: s.closing_time_1,
      apertura2: s.opening_time_2,
      cierre2: s.closing_time_2
    })));

    console.log('\n📋 Iniciando validación de cada día...');
    for (const schedule of schedules) {
      const validationError = validateSchedule(schedule);
      if (validationError) {
        const errorMsg = `${schedule.day_name}: ${validationError}`;
        console.error('❌ Error de validación:', errorMsg);
        console.groupEnd();
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    }
    console.log('✅ Todas las validaciones pasaron correctamente');

    try {
      setLoading(true);
      setError(null);

      console.log('\n📤 Preparando datos para enviar a Supabase...');
      const upsertData = schedules.map((schedule) => ({
        company_id: company.id,
        day_of_week: schedule.day_of_week,
        is_open: schedule.is_open,
        opening_time_1: schedule.is_open && schedule.opening_time_1 ? schedule.opening_time_1 : null,
        closing_time_1: schedule.is_open && schedule.closing_time_1 ? schedule.closing_time_1 : null,
        opening_time_2: schedule.is_open && schedule.opening_time_2 ? schedule.opening_time_2 : null,
        closing_time_2: schedule.is_open && schedule.closing_time_2 ? schedule.closing_time_2 : null,
      }));

      console.log('Datos a insertar/actualizar:');
      console.table(upsertData.filter(d => d.is_open));

      console.log('\n🚀 Enviando a Supabase...');
      const { error: upsertError } = await supabase
        .from('company_business_hours')
        .upsert(upsertData, {
          onConflict: 'company_id,day_of_week',
        });

      if (upsertError) {
        console.error('❌ Error de Supabase:', upsertError);
        throw upsertError;
      }

      console.log('✅ Datos guardados exitosamente');
      console.log('♻️ Recargando horarios desde base de datos...');
      await fetchBusinessHours();

      console.log('✅ Proceso completado exitosamente');
      console.groupEnd();
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al guardar horarios';
      console.error('❌ Error en el proceso de guardado:', err);
      console.groupEnd();
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
