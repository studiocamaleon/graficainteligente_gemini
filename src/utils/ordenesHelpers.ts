export function generarDescripcionCopiado(config: any): string {
    if (!config) return '';
    const parts: string[] = [];

    // Basic info
    if (config.cantidad_copias && config.cantidad_hojas) {
        parts.push(`${config.cantidad_copias} juegos x ${config.cantidad_hojas} hojas`);
    }

    // Tech specs
    if (config.tamanio_nombre) parts.push(config.tamanio_nombre);
    if (config.papel_detalle) parts.push(config.papel_detalle);

    // Ink & Sides
    if (config.tipo_tinta) {
        parts.push(config.tipo_tinta === 'CMYK' ? 'Color' : 'B/N');
    }
    if (config.cara_impresa) {
        parts.push((config.cara_impresa === 'doble' || config.cara_impresa === '1/1') ? 'Doble Faz' : 'Simple Faz');
    }

    // Finishing
    if (config.anillado) parts.push(`Anillado ${config.anillado.tipo}`);
    if (config.plastificado) parts.push(`Plastificado ${config.plastificado.tipo}`);
    if (config.guillotinado) parts.push('Guillotinado');

    return parts.join('\n');
}
