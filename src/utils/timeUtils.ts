export function calcularTiempoTranscurrido(fechaInicio: string): string {
  const ahora = new Date();
  const inicio = new Date(fechaInicio);
  const diferenciaMs = ahora.getTime() - inicio.getTime();

  const minutos = Math.floor(diferenciaMs / (1000 * 60));
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (dias > 0) {
    const horasRestantes = horas % 24;
    return horasRestantes > 0 ? `${dias}d ${horasRestantes}h` : `${dias}d`;
  }

  if (horas > 0) {
    const minutosRestantes = minutos % 60;
    return minutosRestantes > 0 ? `${horas}h ${minutosRestantes}m` : `${horas}h`;
  }

  return `${minutos}m`;
}

export function formatearFechaOrden(fecha: string): string {
  const fechaOrden = new Date(fecha);
  const ahora = new Date();

  const esMismoDia = fechaOrden.toDateString() === ahora.toDateString();

  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  const esAyer = fechaOrden.toDateString() === ayer.toDateString();

  const horas = fechaOrden.getHours().toString().padStart(2, '0');
  const minutos = fechaOrden.getMinutes().toString().padStart(2, '0');
  const horaFormateada = `${horas}:${minutos}`;

  if (esMismoDia) {
    return `Hoy ${horaFormateada}`;
  }

  if (esAyer) {
    return `Ayer ${horaFormateada}`;
  }

  const dia = fechaOrden.getDate().toString().padStart(2, '0');
  const mes = (fechaOrden.getMonth() + 1).toString().padStart(2, '0');

  return `${dia}/${mes} ${horaFormateada}`;
}

// Utilidades para horarios de atención

export function normalizeTimeFormat(time: string): string {
  if (!time) return '';
  const trimmed = time.trim();
  if (!trimmed) return '';

  // Si tiene formato HH:MM:SS (8 caracteres), quitar los segundos
  if (trimmed.length === 8 && trimmed.match(/^\d{2}:\d{2}:\d{2}$/)) {
    return trimmed.substring(0, 5); // Retorna HH:MM
  }

  // Si ya tiene formato HH:MM o H:MM, retornarlo
  return trimmed;
}

export function isValidTimeFormat(time: string): boolean {
  if (!time) return false;
  const normalizedTime = normalizeTimeFormat(time);
  if (!normalizedTime) return false;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(normalizedTime);
}

export function parseTimeToMinutes(time: string): number {
  const normalizedTime = normalizeTimeFormat(time);
  if (!normalizedTime || !isValidTimeFormat(normalizedTime)) return 0;
  const [hours, minutes] = normalizedTime.split(':').map(Number);
  return hours * 60 + minutes;
}

export function compareTimeRanges(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const start1Minutes = parseTimeToMinutes(start1);
  const end1Minutes = parseTimeToMinutes(end1);
  const start2Minutes = parseTimeToMinutes(start2);
  const end2Minutes = parseTimeToMinutes(end2);

  return (
    (start2Minutes >= start1Minutes && start2Minutes < end1Minutes) ||
    (end2Minutes > start1Minutes && end2Minutes <= end1Minutes) ||
    (start2Minutes <= start1Minutes && end2Minutes >= end1Minutes)
  );
}

export function getDayName(dayOfWeek: number): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[dayOfWeek] || '';
}

export function getDayNameShort(dayOfWeek: number): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return days[dayOfWeek] || '';
}

export function formatTimeForDisplay(time: string): string {
  if (!time) return '';
  return time;
}

export function formatBusinessHoursForDisplay(hours: any[]): string {
  console.log('🕐 formatBusinessHoursForDisplay llamado con:', hours);
  console.log('🕐 Tipo:', typeof hours, 'Es array?:', Array.isArray(hours), 'Length:', hours?.length);

  if (!hours || !Array.isArray(hours) || hours.length === 0) {
    console.warn('⚠️ Horarios vacíos o inválidos:', { hours, isArray: Array.isArray(hours) });
    return 'Consultar horarios';
  }

  const openDays = hours.filter(h => h.is_open);
  console.log('🕐 Días abiertos filtrados:', openDays.length);

  if (openDays.length === 0) {
    return 'Cerrado temporalmente';
  }

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const formatTimeRange = (
    opening1: string | null,
    closing1: string | null,
    opening2: string | null,
    closing2: string | null
  ): string => {
    const time1 = normalizeTimeFormat(opening1 || '');
    const time2 = normalizeTimeFormat(closing1 || '');
    const time3 = normalizeTimeFormat(opening2 || '');
    const time4 = normalizeTimeFormat(closing2 || '');

    if (!time1 || !time2) return '';

    let result = `${time1}-${time2}`;

    if (time3 && time4) {
      result += ` y ${time3}-${time4}`;
    }

    return result;
  };

  type DayGroup = {
    days: number[];
    schedule: string;
  };

  const groups: DayGroup[] = [];

  for (const day of openDays) {
    const schedule = formatTimeRange(
      day.opening_time_1,
      day.closing_time_1,
      day.opening_time_2,
      day.closing_time_2
    );

    const existingGroup = groups.find(g => g.schedule === schedule);

    if (existingGroup) {
      existingGroup.days.push(day.day_of_week);
    } else {
      groups.push({ days: [day.day_of_week], schedule });
    }
  }

  const formatDayRange = (days: number[]): string => {
    if (days.length === 0) return '';
    if (days.length === 1) return dayNames[days[0]];

    days.sort((a, b) => a - b);

    const consecutive: number[][] = [];
    let currentRange: number[] = [days[0]];

    for (let i = 1; i < days.length; i++) {
      if (days[i] === currentRange[currentRange.length - 1] + 1) {
        currentRange.push(days[i]);
      } else {
        consecutive.push(currentRange);
        currentRange = [days[i]];
      }
    }
    consecutive.push(currentRange);

    return consecutive
      .map(range => {
        if (range.length === 1) {
          return dayNames[range[0]];
        } else if (range.length === 2) {
          return `${dayNames[range[0]]} y ${dayNames[range[1]]}`;
        } else {
          return `${dayNames[range[0]]} a ${dayNames[range[range.length - 1]]}`;
        }
      })
      .join(', ');
  };

  return groups
    .map(group => {
      const daysText = formatDayRange(group.days);
      return `${daysText} ${group.schedule}`;
    })
    .join(' | ');
}

export function validateTimeRange(start: string, end: string): string | null {
  console.group('🔍 DEBUG: validateTimeRange');
  console.log('start original:', JSON.stringify(start), `(type: ${typeof start}, length: ${start?.length || 0})`);
  console.log('start codes:', start ? [...start].map(c => c.charCodeAt(0)).join(',') : 'N/A');
  console.log('end original:', JSON.stringify(end), `(type: ${typeof end}, length: ${end?.length || 0})`);
  console.log('end codes:', end ? [...end].map(c => c.charCodeAt(0)).join(',') : 'N/A');

  const trimmedStart = normalizeTimeFormat(start || '');
  const trimmedEnd = normalizeTimeFormat(end || '');

  console.log('start normalizado:', JSON.stringify(trimmedStart), `(length: ${trimmedStart.length})`);
  console.log('end normalizado:', JSON.stringify(trimmedEnd), `(length: ${trimmedEnd.length})`);

  if (!trimmedStart || !trimmedEnd) {
    console.warn('❌ Validación fallida: campos vacíos');
    console.groupEnd();
    return 'Debe especificar hora de inicio y fin';
  }

  console.log('Validando formato de start con isValidTimeFormat...');
  const isStartValid = isValidTimeFormat(trimmedStart);
  console.log('isStartValid:', isStartValid);

  console.log('Validando formato de end con isValidTimeFormat...');
  const isEndValid = isValidTimeFormat(trimmedEnd);
  console.log('isEndValid:', isEndValid);

  if (!isStartValid || !isEndValid) {
    console.warn('❌ Validación fallida: formato inválido');
    console.groupEnd();
    return 'Formato de hora inválido (use HH:MM)';
  }

  const startMinutes = parseTimeToMinutes(trimmedStart);
  const endMinutes = parseTimeToMinutes(trimmedEnd);

  console.log('startMinutes:', startMinutes);
  console.log('endMinutes:', endMinutes);

  if (startMinutes >= endMinutes) {
    console.warn('❌ Validación fallida: hora de inicio >= hora de cierre');
    console.groupEnd();
    return 'La hora de inicio debe ser anterior a la hora de cierre';
  }

  console.log('✅ Validación exitosa');
  console.groupEnd();
  return null;
}
