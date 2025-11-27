import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { Client } from '../types/database';

dayjs.extend(isoWeek);

export const calcularProximoCierre = (cliente: Client): string => {
  if (!cliente.tiene_cuenta_corriente || !cliente.acuerdo_pago) {
    return '-';
  }

  const hoy = dayjs();

  switch (cliente.acuerdo_pago) {
    case 'Semanal': {
      if (!cliente.dia_cierre_semanal) return '-';
      const diaActual = hoy.isoWeekday();
      const diaCierre = cliente.dia_cierre_semanal;

      let diasHastaCierre = diaCierre - diaActual;
      if (diasHastaCierre <= 0) {
        diasHastaCierre += 7;
      }

      const fechaCierre = hoy.add(diasHastaCierre, 'day');
      return fechaCierre.format('DD/MM/YYYY');
    }

    case 'Quincenal': {
      const diaDelMes = hoy.date();
      let proximoCierre: dayjs.Dayjs;

      if (diaDelMes <= 15) {
        proximoCierre = hoy.date(15);
      } else {
        proximoCierre = hoy.endOf('month');
      }

      return proximoCierre.format('DD/MM/YYYY');
    }

    case 'Mensual': {
      if (cliente.usa_ultimo_dia_mes) {
        const ultimoDia = hoy.endOf('month');
        return ultimoDia.format('DD/MM/YYYY');
      } else if (cliente.dia_cierre_mensual) {
        const diaDelMes = hoy.date();
        let proximoCierre: dayjs.Dayjs;

        if (diaDelMes <= cliente.dia_cierre_mensual) {
          proximoCierre = hoy.date(cliente.dia_cierre_mensual);
        } else {
          proximoCierre = hoy.add(1, 'month').date(cliente.dia_cierre_mensual);
        }

        return proximoCierre.format('DD/MM/YYYY');
      }
      return '-';
    }

    default:
      return '-';
  }
};

export const getNombreDiaSemana = (dia: number): string => {
  const nombres = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  return nombres[dia] || '';
};

export const getDescripcionAcuerdo = (cliente: Client): string => {
  if (!cliente.tiene_cuenta_corriente || !cliente.acuerdo_pago) {
    return '';
  }

  switch (cliente.acuerdo_pago) {
    case 'Semanal':
      return cliente.dia_cierre_semanal
        ? `Cada ${getNombreDiaSemana(cliente.dia_cierre_semanal)}`
        : 'Semanal';

    case 'Quincenal':
      return 'Días 1 y 15';

    case 'Mensual':
      if (cliente.usa_ultimo_dia_mes) {
        return 'Último día del mes';
      } else if (cliente.dia_cierre_mensual) {
        return `Día ${cliente.dia_cierre_mensual}`;
      }
      return 'Mensual';

    default:
      return cliente.acuerdo_pago;
  }
};
