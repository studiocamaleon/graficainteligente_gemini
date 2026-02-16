import { DollarSign } from 'lucide-react';
import { formatCurrency as globalFormatCurrency } from '../../../utils/stringUtils';
import type { ProductConfiguration } from '../../../hooks/wizard/useProductConfiguration';
import type { SelectedConfiguration } from './ConfigurationStep';
import type { ItemCopiadoConfig } from '../../centro-copiado/CentroCopiadoItemForm';

interface SummaryPricingSidebarProps {
    config: ProductConfiguration;
    selectedConfig: SelectedConfiguration;
    precioBase: number | null;
    precioServicios: number;
    precioAcabados: number;
    precioTotal: number | null;
    isCalculatingPrice: boolean;
    centroCopiadoConfig?: Partial<ItemCopiadoConfig>;
    centroCopiadoPrice?: number;
}

export function SummaryPricingSidebar({
    config,
    selectedConfig,
    precioBase,
    precioServicios,
    precioAcabados,
    precioTotal,
    isCalculatingPrice,
    centroCopiadoConfig,
    centroCopiadoPrice
}: SummaryPricingSidebarProps) {
    const formatCurrency = (value: number | null) => {
        if (value === null) return '-';
        return globalFormatCurrency(value);
    };

    const hasMultipleLines = config.permite_multiples_lineas && selectedConfig.lineas_medidas.length > 0;

    const totalUnidades = hasMultipleLines
        ? selectedConfig.lineas_medidas.reduce((sum, line) => sum + line.cantidad, 0)
        : selectedConfig.cantidad;

    const totalMT2 = hasMultipleLines
        ? selectedConfig.lineas_medidas.reduce((sum, line) => sum + (line.mt2_calculado || 0) * line.cantidad, 0)
        : 0;

    const totalMetrosLineales = hasMultipleLines
        ? selectedConfig.lineas_medidas.reduce((sum, line) => sum + (line.metros_lineales || 0) * line.cantidad, 0)
        : 0;

    const totalPrecioGeneral = hasMultipleLines
        ? selectedConfig.lineas_medidas.reduce((sum, line) => sum + (line.precio_total_linea || 0), 0)
        : precioTotal !== null ? precioTotal * selectedConfig.cantidad : 0;

    // Centro de Copiado View
    if (config.categoria === 'Centro de Copiado' && centroCopiadoConfig) {
        const precioFinal = centroCopiadoPrice || 0;

        return (
            <div className="h-full bg-slate-950 flex flex-col p-6 sm:p-8">
                <div className="relative overflow-hidden rounded-2xl bg-slate-900/40 border border-slate-800 shadow-2xl p-6 backdrop-blur-md">
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
                        <div className="p-2 bg-teal-500/10 rounded-xl">
                            <DollarSign className="w-5 h-5 text-teal-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">Resumen Copiado</h3>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Estimación Inicial</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-gradient-to-b from-teal-600/20 to-teal-600/5 border border-teal-500/30">
                            <p className="text-[10px] font-black text-teal-400 uppercase tracking-[0.2em] mb-2">Total Estimado</p>
                            <p className="text-4xl font-black text-white font-mono tracking-tighter">{formatCurrency(precioFinal)}</p>
                        </div>

                        <div className="text-[10px] text-slate-400 italic bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                            * El precio final puede variar por extras no cotizados en este paso.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-950 flex flex-col">
            <div className="relative flex-1 overflow-y-auto p-6 sm:p-8">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-600/20 transition-colors" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl -ml-16 -mb-16 group-hover:bg-purple-600/20 transition-colors" />

                <div className="relative">
                    <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-4">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <DollarSign className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">Resumen Final</h3>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Costo Total Detallado</p>
                        </div>
                    </div>

                    {isCalculatingPrice ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full border-2 border-slate-800" />
                                <div className="absolute top-0 left-0 w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                            </div>
                            <p className="text-sm text-slate-400 font-medium animate-pulse">Calculando precio...</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Sección de Métricas - VERTICAL */}
                            <div className="space-y-3">
                                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Volumen</p>
                                    <p className="text-xl font-black text-white">{totalUnidades} <span className="text-xs font-normal text-slate-400">unidades</span></p>
                                </div>

                                {(config.tipo_venta_real === 'mt2' && totalMT2 > 0) || (config.tipo_venta_real === 'mt_lineal' && totalMetrosLineales > 0) ? (
                                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                            {config.tipo_venta_real === 'mt2' ? 'Superficie Total' : 'Largo Total'}
                                        </p>
                                        <p className="text-xl font-black text-white">
                                            {config.tipo_venta_real === 'mt2' ? totalMT2.toFixed(2) : totalMetrosLineales.toFixed(2)}
                                            <span className="text-xs font-normal text-slate-400 ml-1">{config.tipo_venta_real === 'mt2' ? 'm²' : 'ml'}</span>
                                        </p>
                                    </div>
                                ) : null}
                            </div>

                            {/* Sección de Finanzas */}
                            {!hasMultipleLines && (
                                <div className="space-y-2 bg-slate-900/30 p-4 rounded-xl border border-slate-800/50 italic">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">Precio Base:</span>
                                        <span className="text-slate-200 font-mono tracking-tighter font-medium">{formatCurrency(precioBase)}</span>
                                    </div>

                                    {precioServicios > 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Extras:</span>
                                            <span className="text-slate-200 font-mono tracking-tighter font-medium">+{formatCurrency(precioServicios)}</span>
                                        </div>
                                    )}

                                    {precioAcabados > 0 && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Acabados:</span>
                                            <span className="text-slate-200 font-mono tracking-tighter font-medium">+{formatCurrency(precioAcabados)}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center pt-1.5 mt-1.5 border-t border-slate-800/80">
                                        <span className="text-slate-400 font-bold text-xs uppercase text-[10px]">Unitario:</span>
                                        <span className="text-blue-400 font-mono tracking-tighter font-bold text-xs">{formatCurrency(precioTotal)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Gran Total */}
                            <div className="relative pt-4">
                                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-b from-blue-600/20 to-blue-600/5 border border-blue-500/30 backdrop-blur-md">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Total Neto a Pagar</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-black text-white tracking-tighter font-mono text-center">
                                            {formatCurrency(totalPrecioGeneral)}
                                        </span>
                                    </div>

                                    {config.impuesto_iva > 0 && (
                                        <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-500 tracking-tight">IVA {config.impuesto_iva}% Incluido</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
