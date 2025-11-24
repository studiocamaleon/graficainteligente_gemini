import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/es';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('es');

const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

export function getArgentinaDate(): dayjs.Dayjs {
  return dayjs().tz(ARGENTINA_TIMEZONE);
}

export function getArgentinaDateString(): string {
  return getArgentinaDate().format('YYYY-MM-DD');
}

export function formatDateForInput(date: Date | string | dayjs.Dayjs): string {
  return dayjs(date).tz(ARGENTINA_TIMEZONE).format('YYYY-MM-DD');
}

export function formatDateDisplay(date: Date | string | dayjs.Dayjs): string {
  return dayjs(date).tz(ARGENTINA_TIMEZONE).format('DD/MM/YYYY');
}

export function formatDateTimeDisplay(date: Date | string | dayjs.Dayjs): string {
  return dayjs(date).tz(ARGENTINA_TIMEZONE).format('DD/MM/YYYY HH:mm');
}

export function parseArgentinaDate(dateString: string): dayjs.Dayjs {
  return dayjs.tz(dateString, ARGENTINA_TIMEZONE);
}

export function isDateInFuture(date: Date | string | dayjs.Dayjs): boolean {
  const argentinaDate = dayjs(date).tz(ARGENTINA_TIMEZONE);
  const today = getArgentinaDate();
  return argentinaDate.isAfter(today, 'day');
}

export function isDateInPast(date: Date | string | dayjs.Dayjs): boolean {
  const argentinaDate = dayjs(date).tz(ARGENTINA_TIMEZONE);
  const today = getArgentinaDate();
  return argentinaDate.isBefore(today, 'day');
}

export function isSameDay(date1: Date | string | dayjs.Dayjs, date2: Date | string | dayjs.Dayjs): boolean {
  return dayjs(date1).tz(ARGENTINA_TIMEZONE).isSame(dayjs(date2).tz(ARGENTINA_TIMEZONE), 'day');
}

export function addDays(date: Date | string | dayjs.Dayjs, days: number): dayjs.Dayjs {
  return dayjs(date).tz(ARGENTINA_TIMEZONE).add(days, 'day');
}

export function subtractDays(date: Date | string | dayjs.Dayjs, days: number): dayjs.Dayjs {
  return dayjs(date).tz(ARGENTINA_TIMEZONE).subtract(days, 'day');
}

export function startOfDay(date: Date | string | dayjs.Dayjs): dayjs.Dayjs {
  return dayjs(date).tz(ARGENTINA_TIMEZONE).startOf('day');
}

export function endOfDay(date: Date | string | dayjs.Dayjs): dayjs.Dayjs {
  return dayjs(date).tz(ARGENTINA_TIMEZONE).endOf('day');
}

export { ARGENTINA_TIMEZONE };
