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
