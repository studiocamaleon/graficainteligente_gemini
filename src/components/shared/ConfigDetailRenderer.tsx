import { Badge } from '../ui/Badge';

interface ConfigDetailRendererProps {
    config: any;
    tipoItem?: string;
}

export function ConfigDetailRenderer({ config: rawConfig, tipoItem }: ConfigDetailRendererProps) {
    if (!rawConfig) return null;

    // Normalización: Si la configuración viene envuelta en una subpropiedad (común en ciertos flujos)
    const config = (rawConfig.configuracion || rawConfig.config)
        ? { ...rawConfig, ...(rawConfig.configuracion || rawConfig.config) }
        : rawConfig;

    // Lógica específica para Centro de Copiado
    const isCentroCopiado =
        (tipoItem || '').toLowerCase().includes('copiado') ||
        (config.categoria || '').toLowerCase().includes('copiado') ||
        config.cantidad_copias !== undefined ||
        config.tamanio_papel_id !== undefined;

    if (isCentroCopiado) {
        return (
            <div className="space-y-1 text-xs text-gray-600 mt-1">
                {/* Info Copias/Hojas */}
                <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{config.cantidad_copias} juegos</span>
                    <span className="text-gray-300">|</span>
                    <span>{config.cantidad_hojas} hojas orig.</span>
                </div>

                {/* Info Papel/Tinta */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                    {config.tamanio_nombre && <Badge variant="default" className="text-[10px] h-5">{config.tamanio_nombre}</Badge>}
                    {config.papel_detalle && <Badge variant="default" className="text-[10px] h-5">{config.papel_detalle}</Badge>}
                    <Badge variant={config.tipo_tinta === 'CMYK' || config.tipo_tinta === 'color' ? 'purple' : 'default'} className="text-[10px] h-5">
                        {config.tipo_tinta === 'CMYK' || config.tipo_tinta === 'color' ? 'Color' : 'B/N'}
                    </Badge>
                    <Badge variant="default" className="text-[10px] h-5">
                        {config.cara_impresa === 'frente_y_dorso' || config.cara_impresa === 'doble' || config.cara_impresa === '1/1' ? 'Doble Faz' : 'Simple Faz'}
                    </Badge>
                </div>

                {/* Terminaciones (Anillado, Plastificado, Guillotinado, etc.) */}
                {(config.anillado || config.plastificado || config.guillotinado || config.abrochado || config.corte || config.dobladillo) && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {config.anillado && (
                            <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Anillado {config.anillado.tipo}</Badge>
                        )}
                        {config.plastificado && (
                            <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Plastificado {config.plastificado.tipo}</Badge>
                        )}
                        {config.guillotinado && (
                            <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Guillotinado</Badge>
                        )}
                        {config.abrochado && (
                            <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Abrochado</Badge>
                        )}
                        {config.corte && (
                            <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Corte</Badge>
                        )}
                        {config.dobladillo && (
                            <Badge variant="warning" size="sm" className="text-[10px] h-5 px-1.5">Dobladillo</Badge>
                        )}
                    </div>
                )}

                {/* Servicios y Acabados Extra */}
                {((config.servicios_seleccionados && config.servicios_seleccionados.length > 0) ||
                    (config.acabados_seleccionados && config.acabados_seleccionados.length > 0)) && (
                        <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-gray-100">
                            {config.servicios_seleccionados?.map((s: any, idx: number) => (
                                <Badge key={`srv-${idx}`} variant="blue" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
                                    {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
                                </Badge>
                            ))}
                            {config.acabados_seleccionados?.map((a: any, idx: number) => (
                                <Badge key={`acb-${idx}`} variant="purple" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
                                    {a.nombre}
                                </Badge>
                            ))}
                        </div>
                    )}
            </div>
        );
    }

    // Lógica estándar para otros tipos de item
    const hasDetails = (config.material_nombre) ||
        (config.tecnologia_nombre) ||
        (config.tinta_nombre) ||
        (config.medida_ancho || config.medida_alto) ||
        (config.cara_impresa) ||
        ((config.servicios_seleccionados && config.servicios_seleccionados.length > 0)) ||
        ((config.acabados_seleccionados && config.acabados_seleccionados.length > 0));

    if (!hasDetails) return null;

    return (
        <div className="space-y-1 mt-1">
            {/* Configuration Badges */}
            <div className="flex flex-wrap gap-1.5 items-center">
                {config.material_nombre && (
                    <Badge variant="default" className="text-[10px] h-5">
                        {config.material_nombre} {config.gramaje ? `${config.gramaje}g` : ''}
                    </Badge>
                )}
                {config.tecnologia_nombre && (
                    <Badge variant="default" className="text-[10px] h-5">
                        {config.tecnologia_nombre}
                    </Badge>
                )}
                {config.tinta_nombre && (
                    <Badge variant={config.tinta_nombre.toLowerCase().includes('negro') ? 'default' : 'purple'} className="text-[10px] h-5">
                        {config.tinta_nombre}
                    </Badge>
                )}
                {(config.medida_ancho || config.medida_alto || config.ancho || config.alto) && (
                    <Badge variant="default" className="text-[10px] h-5">
                        {config.medida_ancho || config.ancho}x{config.medida_alto || config.alto} {
                            config.unidad_medida ||
                            (['gran', 'formato', 'plotter', 'rigido', 'banner'].some(
                                keyword => (tipoItem || '').toLowerCase().includes(keyword) ||
                                    (config.categoria || '').toLowerCase().includes(keyword) ||
                                    (config.producto_categoria || '').toLowerCase().includes(keyword)
                            ) ? 'cm' : 'mm')
                        }
                    </Badge>
                )}
                {config.cara_impresa && (
                    <Badge variant="default" className="text-[10px] h-5">
                        {config.cara_impresa === 'solo_frente' ? 'Simple Faz' : 'Doble Faz'}
                    </Badge>
                )}
            </div>

            {/* Services & Finishings Badges */}
            <div className="flex flex-wrap gap-1 mt-1">
                {config.servicios_seleccionados?.map((s: any, idx: number) => (
                    <Badge key={`srv-${idx}`} variant="blue" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
                        {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
                    </Badge>
                ))}
                {config.acabados_seleccionados?.map((a: any, idx: number) => (
                    <Badge key={`acb-${idx}`} variant="purple" size="sm" className="text-[10px] px-1.5 h-auto py-0.5">
                        {a.nombre}
                    </Badge>
                ))}
            </div>
        </div>
    );
}
