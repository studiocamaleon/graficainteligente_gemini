import { useState, useEffect } from 'react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { AlertCircle, Clock, Loader2, Package, Sparkles, Ruler } from 'lucide-react';
import type { ProductConfiguration } from '../../../hooks/wizard/useProductConfiguration';
import type { MeasurementLine, SelectedConfiguration } from './ConfigurationStep';
import type { SelectedFinishing } from './ServicesAndFinishingsStep';
import { useUniversalPricing } from '../../../hooks/wizard/useUniversalPricing';
import { formatCurrency } from '../../../utils/stringUtils';

interface AddLineFormProps {
    config: ProductConfiguration;
    baseConfig: Omit<SelectedConfiguration, 'lineas_medidas'>;
    selectedAcabados: SelectedFinishing[];
    existingLine?: MeasurementLine;
    onSave: (line: MeasurementLine) => void;
    onCancel: () => void;
}

export function AddLineForm({
    config,
    baseConfig,
    selectedAcabados,
    existingLine,
    onSave,
    onCancel
}: AddLineFormProps) {
    const isEditMode = !!existingLine;

    const [ancho, setAncho] = useState<number>(0);
    const [alto, setAlto] = useState<number>(0);
    const [anchoSeleccionado, setAnchoSeleccionado] = useState<number | null>(null);
    const [metrosLineales, setMetrosLineales] = useState<number>(0);
    const [cantidad, setCantidad] = useState<number>(1);
    const [acabadosSeleccionados, setAcabadosSeleccionados] = useState<Array<{
        acabado_id: string;
        acabado_nombre: string;
        nivel_id: string | null;
        nivel_nombre: string | null;
        tipo_impacto: string;
        valor_porcentaje: number | null;
        valor_monto: number | null;
        valor_impacto_secundario?: number | null;
        cantidad?: number;
    }>>([]);

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (existingLine) {
            setAncho(existingLine.ancho || 0);
            setAlto(existingLine.alto || 0);
            setAnchoSeleccionado(existingLine.ancho_seleccionado || null);
            setMetrosLineales(existingLine.metros_lineales || 0);
            setCantidad(existingLine.cantidad);
            setAcabadosSeleccionados(existingLine.acabados || []);
        } else {
            setAcabadosSeleccionados(selectedAcabados || []);
        }
    }, [existingLine, selectedAcabados]);

    const mt2Calculado = config.tipo_venta_real === 'mt2'
        ? (ancho && alto ? (ancho * alto) / 10000 : 0)
        : (config.tipo_venta_real === 'mt_lineal' && anchoSeleccionado && metrosLineales
            ? (anchoSeleccionado * (metrosLineales * 100)) / 10000
            : 0);

    const mt2Total = mt2Calculado * cantidad;

    // Real-time Pricing Logic
    const { calculatePrice, isCalculating } = useUniversalPricing();
    const [precioCalculado, setPrecioCalculado] = useState<{
        precio_base: number;
        precio_servicios: number;
        precio_acabados: number;
        precio_total: number;
    } | null>(null);

    useEffect(() => {
        const calcularPrecioEnVivo = async () => {
            // Solo calcular si tenemos los datos mínimos requeridos
            const datosCompletos = config.tipo_venta_real === 'mt2'
                ? (ancho > 0 && alto > 0)
                : (config.tipo_venta_real === 'mt_lineal' ? (anchoSeleccionado && metrosLineales > 0) : true);

            if (!datosCompletos || cantidad <= 0) {
                setPrecioCalculado(null);
                return;
            }

            // Constuir configuración temporal para el cálculo
            const tempConfig: SelectedConfiguration = {
                ...baseConfig,
                lineas_medidas: [], // No se usa para el cálculo unitario
                cantidad: cantidad,
                medida_ancho: config.tipo_venta_real === 'mt2' ? ancho : (anchoSeleccionado || 0),
                medida_alto: config.tipo_venta_real === 'mt2' ? alto : (metrosLineales * 100),
            };

            // Ajuste específico para metros lineales si es necesario que la altura sea en cm
            if (config.tipo_venta_real === 'mt_lineal') {
                tempConfig.medida_alto = metrosLineales * 100;
            }

            console.log('🚀 Calling calculatePrice from AddLineForm with:', {
                acabados: acabadosSeleccionados,
                cantidadManual: acabadosSeleccionados[0]?.cantidad
            });

            const result = await calculatePrice(
                config.id,
                config.categoria as any,
                tempConfig,
                [], // Servicios removidos de este nivel
                acabadosSeleccionados
            );

            console.log('💰 calculatePrice result:', result);

            if (result.tiene_precio) {
                setPrecioCalculado({
                    precio_base: (result.precio_base || 0) * cantidad,
                    precio_servicios: result.precio_servicios * cantidad,
                    precio_acabados: result.precio_acabados * cantidad,
                    precio_total: (result.precio_total || 0) * cantidad
                });
            } else {
                setPrecioCalculado(null);
            }
        };

        const timer = setTimeout(() => {
            calcularPrecioEnVivo();
        }, 500); // Debounce

        return () => clearTimeout(timer);
    }, [ancho, alto, anchoSeleccionado, metrosLineales, cantidad, acabadosSeleccionados, baseConfig, config, calculatePrice]);


    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (config.tipo_venta_real === 'mt2') {
            if (!ancho || ancho <= 0) newErrors.ancho = 'Requerido';
            if (!alto || alto <= 0) newErrors.alto = 'Requerido';
        } else if (config.tipo_venta_real === 'mt_lineal') {
            if (!anchoSeleccionado) newErrors.ancho = 'Requerido';
            if (!metrosLineales || metrosLineales <= 0) newErrors.metros = 'Requerido';
        }

        if (!cantidad || cantidad <= 0) {
            newErrors.cantidad = 'Requerido';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (!validateForm()) return;

        const newLine: MeasurementLine = {
            id: existingLine?.id || crypto.randomUUID(),
            ancho: config.tipo_venta_real === 'mt2' ? ancho : undefined,
            alto: config.tipo_venta_real === 'mt2' ? alto : undefined,
            mt2_calculado: (config.tipo_venta_real === 'mt2' || config.tipo_venta_real === 'mt_lineal') ? mt2Calculado : undefined,
            ancho_seleccionado: config.tipo_venta_real === 'mt_lineal' ? anchoSeleccionado || undefined : undefined,
            metros_lineales: config.tipo_venta_real === 'mt_lineal' ? metrosLineales : undefined,
            cantidad,
            acabados: acabadosSeleccionados,

            // Guardar precios calculados
            precio_base_unitario: precioCalculado ? (precioCalculado.precio_base / cantidad) : 0,
            precio_servicios_unitario: precioCalculado ? (precioCalculado.precio_servicios / cantidad) : 0,
            precio_acabados_unitario: precioCalculado ? (precioCalculado.precio_acabados / cantidad) : 0,
            precio_unitario_final: precioCalculado ? (precioCalculado.precio_total / cantidad) : 0,
            precio_total_linea: precioCalculado ? precioCalculado.precio_total : 0
        };

        onSave(newLine);
    };

    const handleToggleAcabado = (acabadoConfig: typeof config.acabados[0]) => {
        const isSelected = acabadosSeleccionados.some(a => a.acabado_id === acabadoConfig.acabado_id);
        if (isSelected) {
            setAcabadosSeleccionados(prev => prev.filter(a => a.acabado_id !== acabadoConfig.acabado_id));
        } else {
            const nivel = acabadoConfig.niveles?.[0];
            if (!nivel) return;
            setAcabadosSeleccionados(prev => [...prev, {
                acabado_id: acabadoConfig.acabado_id,
                acabado_nombre: acabadoConfig.acabado_nombre,
                nivel_id: acabadoConfig.tiene_niveles ? nivel.id : null,
                nivel_nombre: acabadoConfig.tiene_niveles ? nivel.nombre : null,
                tipo_impacto: nivel.tipo_impacto,
                valor_porcentaje: nivel.valor_porcentaje,
                valor_monto: nivel.valor_monto,
                valor_impacto: nivel.valor_impacto, // Added fallback
                valor_impacto_secundario: nivel.valor_impacto_secundario,
                cantidad: 1 // Default quantity (e.g. 1 minute)
            }]);
        }
    };

    const handleChangeNivelAcabado = (acabadoConfig: typeof config.acabados[0], nivelId: string) => {
        const nivel = acabadoConfig.niveles?.find(n => n.id === nivelId);
        if (!nivel) return;

        setAcabadosSeleccionados(prev => prev.map(a => {
            if (a.acabado_id === acabadoConfig.acabado_id) {
                return {
                    ...a,
                    nivel_id: nivel.id,
                    nivel_nombre: nivel.nombre,
                    tipo_impacto: nivel.tipo_impacto,
                    valor_porcentaje: nivel.valor_porcentaje,
                    valor_monto: nivel.valor_monto,
                    valor_impacto: nivel.valor_impacto, // Added fallback
                    valor_impacto_secundario: nivel.valor_impacto_secundario
                };
            }
            return a;
        }));
    };

    const handleChangeCantidadAcabado = (acabadoId: string, cantidad: number) => {
        console.log('📝 handleChangeCantidadAcabado', { acabadoId, cantidad });
        setAcabadosSeleccionados(prev => {
            const next = prev.map(a => {
                if (a.acabado_id === acabadoId) {
                    return { ...a, cantidad };
                }
                return a;
            });
            console.log('🔄 New acabadosSeleccionados state:', next);
            return next;
        });
    };

    const formatImpacto = (item: { tipo_impacto: string; valor_monto: number | null; valor_porcentaje: number | null }) => {
        if (!item.tipo_impacto || item.tipo_impacto === 'sin_impacto') return '';

        if (item.tipo_impacto === 'fijo_minuto' || item.tipo_impacto === 'fijo_por_minuto') {
            const parts = [];
            if (item.valor_monto) parts.push(`$${item.valor_monto.toFixed(2)}`);
            if (item.valor_porcentaje) parts.push(`$${item.valor_porcentaje.toFixed(2)}/min`);
            return parts.length > 0 ? parts.join(' + ') : '';
        }

        if (item.tipo_impacto === 'por_minuto' || item.tipo_impacto.includes('minuto')) {
            return item.valor_monto ? `+$${item.valor_monto.toFixed(2)} /min` : '';
        }

        if (item.tipo_impacto === 'precio_fijo' && item.valor_monto) return `+$${item.valor_monto.toFixed(2)}`;
        if (item.tipo_impacto === 'por_unidad' && item.valor_monto) return `+$${item.valor_monto.toFixed(2)} /u`;
        if (item.tipo_impacto === 'porcentual' && item.valor_porcentaje) return `+${item.valor_porcentaje}%`;
        if (item.tipo_impacto === 'por_mt2' && item.valor_monto) return `+$${item.valor_monto.toFixed(2)} /m²`;
        if (item.tipo_impacto === 'por_metro_lineal' && item.valor_monto) return `+$${item.valor_monto.toFixed(2)} /ml`;

        if (['fijo_mt2', 'fijo_metro_cuadrado', 'fijo_m2'].includes(item.tipo_impacto)) {
            const parts = [];
            if (item.valor_monto) parts.push(`$${item.valor_monto.toFixed(2)}`);
            if (item.valor_porcentaje) parts.push(`$${item.valor_porcentaje.toFixed(2)}/m²`);
            return parts.length > 0 ? parts.join(' + ') : '';
        }

        if (['fijo_mt_lineal', 'fijo_metro_lineal'].includes(item.tipo_impacto)) {
            const parts = [];
            if (item.valor_monto) parts.push(`$${item.valor_monto.toFixed(2)}`);
            if (item.valor_porcentaje) parts.push(`$${item.valor_porcentaje.toFixed(2)}/ml`);
            return parts.length > 0 ? parts.join(' + ') : '';
        }

        if (item.tipo_impacto === 'fijo_porcentual') {
            const parts = [];
            if (item.valor_monto) parts.push(`$${item.valor_monto.toFixed(2)}`);
            if (item.valor_porcentaje) parts.push(`${item.valor_porcentaje}%`);
            return parts.length > 0 ? parts.join(' + ') : '';
        }

        if (item.tipo_impacto === 'fijo_porcentual') {
            const parts = [];
            if (item.valor_monto) parts.push(`$${item.valor_monto.toFixed(2)}`);
            if (item.valor_porcentaje) parts.push(`${item.valor_porcentaje}%`);
            return parts.length > 0 ? parts.join(' + ') : '';
        }

        if (item.tipo_impacto === 'por_mt2_manual') {
            return item.valor_monto ? `+$${item.valor_monto.toFixed(2)} /m² (manual)` : '';
        }

        if (item.tipo_impacto === 'fijo_mt2_manual') {
            const parts = [];
            if (item.valor_monto) parts.push(`$${item.valor_monto.toFixed(2)}`);
            if (item.valor_porcentaje) parts.push(`$${item.valor_porcentaje.toFixed(2)}/m²`);
            return parts.length > 0 ? parts.join(' + ') : '';
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    {isEditMode ? 'Editar Línea' : 'Agregar Nueva Línea'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Configura las medidas y acabados para esta línea de producción.</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-4">
                    {/* Medidas Section */}
                    <div className="grid grid-cols-2 gap-4">
                        {config.tipo_venta_real === 'mt2' ? (
                            <>
                                <div className="space-y-1.5 focus-within:text-blue-600 transition-colors">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ancho (cm)</label>
                                    <div className="relative">
                                        <Input
                                            type="number" min="0" step="0.1"
                                            value={ancho || ''}
                                            onChange={(e) => setAncho(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                            error={errors.ancho}
                                            className="bg-white border-gray-200 focus:border-blue-500 pr-10 h-11 transition-all"
                                        />
                                        <span className="absolute right-3 top-3 text-[10px] text-gray-400 font-bold uppercase">cm</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5 focus-within:text-blue-600 transition-colors">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Alto (cm)</label>
                                    <div className="relative">
                                        <Input
                                            type="number" min="0" step="0.1"
                                            value={alto || ''}
                                            onChange={(e) => setAlto(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                            error={errors.alto}
                                            className="bg-white border-gray-200 focus:border-blue-500 pr-10 h-11 transition-all"
                                        />
                                        <span className="absolute right-3 top-3 text-[10px] text-gray-400 font-bold uppercase">cm</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-1.5 focus-within:text-blue-600 transition-colors">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ancho</label>
                                    <select
                                        className="w-full h-11 rounded-lg border-gray-200 bg-white text-gray-900 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 py-2 px-3 transition-all"
                                        value={anchoSeleccionado || ''}
                                        onChange={(e) => setAnchoSeleccionado(parseFloat(e.target.value))}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {config.anchos_disponibles?.map(a => (
                                            <option key={a} value={a}>{a} cm</option>
                                        ))}
                                    </select>
                                    {errors.ancho && <p className="text-[10px] text-red-500 font-medium mt-1">{errors.ancho}</p>}
                                </div>
                                <div className="space-y-1.5 focus-within:text-blue-600 transition-colors">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Largo (m)</label>
                                    <div className="relative">
                                        <Input
                                            type="number" min="0" step="0.1"
                                            value={metrosLineales || ''}
                                            onChange={(e) => setMetrosLineales(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                            error={errors.metros}
                                            className="bg-white border-gray-200 focus:border-blue-500 pr-10 h-11 transition-all"
                                        />
                                        <span className="absolute right-3 top-3 text-[10px] text-gray-400 font-bold uppercase">m</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Quantity Section - Moved to its own row for better vertical flow */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-gray-500">
                            <Package className="w-5 h-5 text-blue-500" />
                            <span className="text-xs font-bold uppercase tracking-wider">Cantidad</span>
                        </div>
                        <div className="w-32">
                            <Input
                                type="number" min="1"
                                value={cantidad || ''}
                                onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                                placeholder="1"
                                error={errors.cantidad}
                                className="bg-white border-gray-200 text-right font-bold text-lg h-11 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {(mt2Calculado > 0 || (config.cantidad_minima && mt2Calculado < config.cantidad_minima)) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-medium">Cálculo:</span>
                            <Badge variant="default" className="bg-gray-200 text-gray-800 hover:bg-gray-300 border-0">
                                {mt2Calculado.toFixed(2)} m² / u
                            </Badge>
                            {cantidad > 1 && (
                                <Badge variant="blue" className="bg-blue-50 text-blue-700 border-blue-200">
                                    Total: {mt2Total.toFixed(2)} m²
                                </Badge>
                            )}
                        </div>

                        {config.cantidad_minima && mt2Calculado < config.cantidad_minima && (
                            <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                <AlertCircle className="w-3 h-3" />
                                <span className="font-medium">Mínimo: {config.cantidad_minima} m²</span>
                            </div>
                        )}
                    </div>
                )}

                {config.acabados.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-900 border-b pb-2">
                            <Sparkles className="w-4 h-4 text-purple-600" />
                            <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Acabados (Por Pieza)</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {config.acabados.map((acabado) => {
                                const isSelected = acabadosSeleccionados.some(a => a.acabado_id === acabado.acabado_id);
                                const selectedData = acabadosSeleccionados.find(a => a.acabado_id === acabado.acabado_id);

                                return (
                                    <div
                                        key={acabado.acabado_id}
                                        className={`
                      relative p-3 rounded-lg border transition-all duration-200 text-sm
                      ${isSelected
                                                ? 'bg-purple-50 border-purple-200'
                                                : 'bg-white border-gray-200 hover:border-gray-300'}
                    `}
                                    >
                                        <label className="flex items-start gap-3 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleAcabado(acabado)}
                                                className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                            />
                                            <div className="flex-1">
                                                <div className={`font-medium ${isSelected ? 'text-purple-900' : 'text-gray-700'}`}>
                                                    {acabado.acabado_nombre}
                                                </div>

                                                {acabado.tiene_niveles && acabado.niveles && acabado.niveles.length > 1 && isSelected && (
                                                    <div className="mt-2 space-y-1">
                                                        {acabado.niveles.map(nivel => (
                                                            <label key={nivel.id} className="flex items-center gap-2 cursor-pointer group">
                                                                <input
                                                                    type="radio"
                                                                    name={`acb-form-${acabado.acabado_id}`}
                                                                    checked={selectedData?.nivel_id === nivel.id}
                                                                    onChange={() => handleChangeNivelAcabado(acabado, nivel.id)}
                                                                    className="text-purple-600 w-3 h-3 border-gray-300 focus:ring-1 focus:ring-purple-500"
                                                                />
                                                                <span className="text-xs text-gray-600 group-hover:text-gray-900">
                                                                    {nivel.nombre} <span className="text-gray-400">({formatImpacto(nivel)})</span>
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Time-based Quantity Input */}
                                                {/* Manual Quantity Input (Time or MT2) */}
                                                {['por_minuto', 'fijo_minuto', 'por_mt2_manual', 'fijo_mt2_manual'].includes(selectedData?.tipo_impacto || '') && isSelected && (
                                                    <div className="mt-3 flex items-center gap-3 bg-purple-50 p-2.5 rounded-lg border border-purple-100" onClick={(e) => e.preventDefault()}>
                                                        <div className="flex items-center gap-2 text-purple-700">
                                                            {['por_minuto', 'fijo_minuto'].includes(selectedData?.tipo_impacto || '') ? (
                                                                <Clock className="w-4 h-4" />
                                                            ) : (
                                                                <Ruler className="w-4 h-4" />
                                                            )}
                                                            <span className="text-xs font-bold uppercase tracking-wide">
                                                                {['por_minuto', 'fijo_minuto'].includes(selectedData?.tipo_impacto || '') ? 'Minutos:' : 'M² Manual:'}
                                                            </span>
                                                        </div>
                                                        <Input
                                                            type="number"
                                                            min="0.1"
                                                            step={['por_minuto', 'fijo_minuto'].includes(selectedData?.tipo_impacto || '') ? "1" : "0.01"}
                                                            value={selectedData?.cantidad || 1}
                                                            onChange={(e) => handleChangeCantidadAcabado(acabado.acabado_id, parseFloat(e.target.value) || 0)}
                                                            className="w-24 h-9 text-right font-mono font-medium bg-white border-purple-200 focus:border-purple-500 focus:ring-purple-500 text-sm"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-white">
                <div className="bg-gray-900 rounded-xl p-5 text-white shadow-xl mb-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-4 text-[10px] text-gray-400 border-b border-gray-800 pb-2 tracking-widest uppercase font-bold">
                        <span>Desglose de Costos</span>
                        {isCalculating && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
                    </div>

                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400 font-medium">Precio Base:</span>
                            <span className="font-mono font-bold tracking-tight">{formatCurrency(precioCalculado?.precio_base || 0)}</span>
                        </div>

                        {(precioCalculado?.precio_acabados || 0) > 0 && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-purple-400 font-medium">Acabados:</span>
                                <span className="text-purple-300 font-mono font-bold tracking-tight">+{formatCurrency(precioCalculado?.precio_acabados || 0)}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Estimado</div>
                        <div className="text-2xl font-black text-white flex items-baseline gap-1">
                            <span className="font-mono tracking-tighter overflow-hidden text-ellipsis whitespace-nowrap max-w-[250px]" title={(precioCalculado?.precio_total || 0).toString()}>
                                {formatCurrency(precioCalculado?.precio_total || 0)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button variant="ghost" onClick={onCancel} className="flex-1 text-gray-500 hover:text-gray-900 border border-gray-200">
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        className="flex-[2]"
                    >
                        {isEditMode ? 'Guardar Cambios' : 'Agregar Línea'}
                    </Button>
                </div>
            </div>
        </div >
    );
}
