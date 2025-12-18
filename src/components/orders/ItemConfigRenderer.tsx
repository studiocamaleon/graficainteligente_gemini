import { Badge } from '../ui/Badge';
import { Wrench } from 'lucide-react';

interface ItemConfigRendererProps {
    config: any;
    tipoItem?: string;
    rutasGeneradas?: any[];
}

export function ItemConfigRenderer({ config, tipoItem, rutasGeneradas }: ItemConfigRendererProps) {
    if (!config) return null;

    // --- Helpers ---
    const formatCaraImpresa = (cara: string) => {
        if (cara === '1/0') return 'Frente';
        if (cara === '1/1') return 'Frente y Dorso';
        if (cara === 'frente_y_dorso' || cara === 'solo_frente') return cara === 'frente_y_dorso' ? 'Frente y Dorso' : 'Frente';
        return cara;
    };

    const formatEspesorOGramaje = () => {
        // Si tiene espesor, usar la unidad del material
        if (config.espesor && config.unidad_espesor) {
            // Para gramajes, agregar espacio antes de la unidad
            if (config.unidad_espesor === 'gr' || config.unidad_espesor === 'g') {
                return `${config.espesor} ${config.unidad_espesor}`;
            }
            // Para otras unidades (mm, cm, etc), no agregar espacio
            return `${config.espesor}${config.unidad_espesor}`;
        }
        // Fallback: si solo tiene espesor sin unidad
        if (config.espesor) {
            return `${config.espesor}mm`;
        }
        // Fallback legacy: si tiene gramaje (por compatibilidad con datos antiguos)
        if (config.gramaje) {
            return `${config.gramaje} g`;
        }
        return null;
    };

    const getLinkedServices = (rutas: any[]) => {
        if (!rutas || rutas.length === 0) return [];

        const linkedServices = new Set<string>();

        rutas.forEach(ruta => {
            if (ruta.source_service_id && ruta.paso_nombre) {
                // Extract cleaner name if it follows the pattern "[Servicio] Name"
                const cleanName = ruta.paso_nombre.replace('[Servicio] ', '');
                linkedServices.add(cleanName);
            }
        });

        return Array.from(linkedServices);
    };

    // --- Lógica Centro de Copiado ---
    if (tipoItem === 'centro_copiado' || (config.cantidad_copias && config.cantidad_hojas)) {
        return (
            <div className="space-y-1 text-sm text-gray-600">
                {/* Info Copias/Hojas */}
                <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{config.cantidad_copias} juegos</span>
                    <span className="text-gray-400">x</span>
                    <span>{config.cantidad_hojas} hojas</span>
                </div>

                {/* Info Papel/Tinta */}
                <div className="flex flex-wrap gap-2 text-xs">
                    {config.tamanio_nombre && <Badge variant="default">{config.tamanio_nombre}</Badge>}
                    {config.papel_detalle && <Badge variant="default">{config.papel_detalle}</Badge>}
                    <Badge variant={config.tipo_tinta === 'CMYK' || config.tipo_tinta === 'color' ? 'purple' : 'default'}>
                        {config.tipo_tinta === 'CMYK' || config.tipo_tinta === 'color' ? 'Color' : 'B/N'}
                    </Badge>
                    <Badge variant="default">
                        {config.cara_impresa === 'frente_y_dorso' || config.cara_impresa === 'doble' || config.cara_impresa === '1/1' ? 'Doble Faz' : 'Simple Faz'}
                    </Badge>
                </div>

                {/* Terminaciones (Anillado, Plastificado, Guillotinado) */}
                {(config.anillado || config.plastificado || config.guillotinado || config.abrochado || config.corte || config.dobladillo) && (
                    <div className="flex flex-wrap gap-2 mt-1">
                        {config.anillado && (
                            <Badge variant="warning" size="sm">Anillado {config.anillado.tipo}</Badge>
                        )}
                        {config.plastificado && (
                            <Badge variant="warning" size="sm">Plastificado {config.plastificado.tipo}</Badge>
                        )}
                        {config.guillotinado && (
                            <Badge variant="warning" size="sm">Guillotinado</Badge>
                        )}
                        {config.abrochado && (
                            <Badge variant="warning" size="sm">Abrochado</Badge>
                        )}
                        {config.corte && (
                            <Badge variant="warning" size="sm">Corte</Badge>
                        )}
                        {config.dobladillo && (
                            <Badge variant="warning" size="sm">Dobladillo</Badge>
                        )}
                    </div>
                )}

                {/* Servicios Extra (Wizard OT) */}
                {((config.servicios_seleccionados && config.servicios_seleccionados.length > 0) ||
                    (config.acabados_seleccionados && config.acabados_seleccionados.length > 0)) && (
                        <div className="flex flex-wrap gap-1.5 mt-1 border-t border-gray-100 pt-1">
                            {config.servicios_seleccionados?.map((s: any, idx: number) => (
                                <Badge key={`servicio-${idx}`} variant="blue" size="sm">
                                    {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
                                </Badge>
                            ))}
                            {config.acabados_seleccionados?.map((a: any, idx: number) => (
                                <Badge key={`acabado-${idx}`} variant="purple" size="sm">
                                    {a.nivel ? `${a.nombre} (${a.nivel})` : a.nombre}
                                </Badge>
                            ))}
                        </div>
                    )}
            </div>
        );
    }

    // --- Lógica General (Producto o Gran Formato) ---
    const linkedServices = getLinkedServices(rutasGeneradas || []);
    const espesorFormateado = formatEspesorOGramaje();

    return (
        <div className="space-y-2">
            {/* Línea 0: Badges de Servicios Vinculados (Externos) */}
            {linkedServices.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {linkedServices.map((serviceName, idx) => (
                        <Badge key={`linked-${idx}`} variant="info" size="sm" className="border-cyan-400 bg-cyan-50 text-cyan-700">
                            <Wrench className="w-3 h-3 mr-1 inline-block" />
                            {serviceName}
                        </Badge>
                    ))}
                </div>
            )}

            {/* Línea 1: Info básica */}
            <div className="flex flex-wrap gap-1.5 text-sm text-gray-600">
                {(config.medida_ancho || config.medida_alto) && (
                    <span>
                        {config.medida_ancho && config.medida_alto
                            ? (
                                config.es_metro_lineal
                                    ? `${config.medida_ancho}x${config.medida_alto} cm (${(config.medida_alto / 100).toLocaleString('es-AR')} ml)`
                                    : `${config.medida_ancho}x${config.medida_alto} ${config.unidad_medida || ((config.categoria === 'Impresion Laser' || config.tecnologia_nombre === 'Impresion Laser') ? 'mm' : 'cm')}`
                            )
                            : `${config.medida_ancho || config.medida_alto} ${config.unidad_medida || ((config.categoria === 'Impresion Laser' || config.tecnologia_nombre === 'Impresion Laser') ? 'mm' : 'cm')}`
                        }
                    </span>
                )}
                {config.material_nombre && (
                    <>
                        {(config.medida_ancho || config.medida_alto) && <span className="text-gray-400">|</span>}
                        <span>
                            {config.material_nombre}
                            {config.variante_nombre && ` - ${config.variante_nombre}`}
                        </span>
                    </>
                )}
                {espesorFormateado && (
                    <>
                        <span className="text-gray-400">|</span>
                        <span>{espesorFormateado}</span>
                    </>
                )}
                {config.tecnologia_nombre && (
                    <>
                        <span className="text-gray-400">|</span>
                        <span>{config.tecnologia_nombre}</span>
                    </>
                )}
                {config.tinta_nombre && (
                    <>
                        <span className="text-gray-400">|</span>
                        <span>{config.tinta_nombre}</span>
                    </>
                )}
                {config.cara_impresa && (
                    <>
                        <span className="text-gray-400">|</span>
                        <span>{formatCaraImpresa(config.cara_impresa)}</span>
                    </>
                )}
                {config.color && (
                    <>
                        <span className="text-gray-400">|</span>
                        <span>{config.color}</span>
                    </>
                )}
                {config.marca && (
                    <>
                        <span className="text-gray-400">|</span>
                        <span>{config.marca}</span>
                    </>
                )}
            </div>

            {/* Línea 2: Servicios y Acabados con badges */}
            {((config.servicios_seleccionados && config.servicios_seleccionados.length > 0) ||
                (config.acabados_seleccionados && config.acabados_seleccionados.length > 0)) && (
                    <div className="flex flex-wrap gap-1.5">
                        {config.servicios_seleccionados?.map((s: any, idx: number) => (
                            <Badge key={`servicio-${idx}`} variant="blue" size="sm">
                                {s.nivel ? `${s.nombre} (${s.nivel})` : s.nombre}
                            </Badge>
                        ))}
                        {config.acabados_seleccionados?.map((a: any, idx: number) => (
                            <Badge key={`acabado-${idx}`} variant="purple" size="sm">
                                {a.nivel ? `${a.nombre} (${a.nivel})` : a.nombre}
                            </Badge>
                        ))}
                    </div>
                )}
        </div>
    );
}
