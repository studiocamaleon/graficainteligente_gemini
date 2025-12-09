import { forwardRef } from 'react';
import type { Servicio, Acabado, ServicioNivelPrecio, AcabadoNivelPrecio, TipoImpactoPrecio } from '../../../types/database';

interface ServicioWithDetails extends Servicio {
    estacion?: { nombre: string };
    niveles_precio?: ServicioNivelPrecio[];
}

interface AcabadoWithDetails extends Acabado {
    estacion?: { nombre: string };
    niveles_precio?: AcabadoNivelPrecio[];
}

interface Props {
    servicios: ServicioWithDetails[];
    acabados: AcabadoWithDetails[];
}

const formatImpacto = (
    tipo: TipoImpactoPrecio | null | undefined,
    valor: number | null | undefined,
    valorSecundario: number | null | undefined
): string => {
    if (!tipo) return '-';
    const v = valor || 0;
    const v2 = valorSecundario || 0;

    switch (tipo) {
        case 'sin_impacto':
            return 'Sin Costo';
        case 'precio_fijo':
            return `$${v.toFixed(2)}`;
        case 'por_unidad':
            return `$${v.toFixed(2)} / u`;
        case 'por_minuto':
            return `$${v.toFixed(2)} / min`;
        case 'porcentual':
            return `+ ${v}%`;
        case 'por_mt2':
            return `$${v.toFixed(2)} / m²`;
        case 'por_mt_lineal':
            return `$${v.toFixed(2)} / ml`;
        case 'fijo_porcentual':
            return `$${v.toFixed(2)} + ${v2}%`;
        case 'fijo_mt2':
            return `$${v.toFixed(2)} + $${v2.toFixed(2)} / m²`;
        case 'fijo_mt_lineal':
            return `$${v.toFixed(2)} + $${v2.toFixed(2)} / ml`;
        case 'fijo_minuto':
            return `$${v.toFixed(2)} + $${v2.toFixed(2)} / min`;
        default:
            return tipo;
    }
};

export const ServiciosYAcabadosPDFTemplate = forwardRef<HTMLDivElement, Props>(
    ({ servicios, acabados }, ref) => {
        return (
            <div
                ref={ref}
                className="bg-white p-4 font-sans text-gray-900"
                style={{ minWidth: '210mm', maxWidth: '210mm', margin: '0 auto', minHeight: '297mm' }}
            >
                {/* Global Styles for Print */}
                <style type="text/css">
                    {`
            @page { size: A4; margin: 0; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page-break { page-break-before: always; }
              .avoid-break { page-break-inside: avoid; }
            }
          `}
                </style>

                {/* Header */}
                <div className="mb-4 border-b border-gray-100 pb-3">
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Lista de Precios</h1>
                            <p className="text-gray-500 mt-0">Servicios y Acabados</p>
                        </div>
                        <div className="text-right text-xs text-gray-400">
                            Generado el {new Date().toLocaleDateString('es-ES')}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">

                    {/* Section: Servicios */}
                    <div className="avoid-break">
                        <h2 className="text-lg font-bold text-indigo-900 mb-4 border-b border-indigo-100 pb-1">
                            Servicios
                        </h2>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                                    <tr>
                                        <th className="px-4 py-3 border-b border-gray-200 w-1/3">Nombre</th>
                                        <th className="px-4 py-3 border-b border-gray-200 w-1/4">Estación</th>
                                        <th className="px-4 py-3 border-b border-gray-200 text-right">Regla de Precio / Impacto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {servicios.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 avoid-break">
                                            <td className="px-4 py-3 align-top">
                                                <div className="font-medium text-slate-800">{item.nombre}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 align-top">
                                                {item.estacion?.nombre || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right align-top">
                                                {item.tiene_niveles_precio ? (
                                                    <div className="space-y-1">
                                                        {item.niveles_precio?.sort((a, b) => a.orden - b.orden).map((nivel, idx) => (
                                                            <div key={nivel.id} className={`flex justify-end gap-2 text-xs py-2 ${idx !== (item.niveles_precio?.length || 0) - 1 ? 'border-b border-gray-300' : ''}`}>
                                                                <span className="text-slate-400">{nivel.nombre}:</span>
                                                                <span className="font-medium text-indigo-600">
                                                                    {formatImpacto(nivel.tipo_impacto, nivel.valor_impacto, nivel.valor_impacto_secundario)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="font-medium text-indigo-600">
                                                        {formatImpacto(item.tipo_impacto, item.valor_impacto, item.valor_impacto_secundario)}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {servicios.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic">No hay servicios registrados</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section: Acabados */}
                    <div className="avoid-break">
                        <h2 className="text-lg font-bold text-rose-900 mb-4 border-b border-rose-100 pb-1">
                            Acabados
                        </h2>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                                    <tr>
                                        <th className="px-4 py-3 border-b border-gray-200 w-1/3">Nombre</th>
                                        <th className="px-4 py-3 border-b border-gray-200 w-1/4">Estación</th>
                                        <th className="px-4 py-3 border-b border-gray-200 text-right">Regla de Precio / Impacto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {acabados.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 avoid-break">
                                            <td className="px-4 py-3 align-top">
                                                <div className="font-medium text-slate-800">{item.nombre}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 align-top">
                                                {item.estacion?.nombre || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right align-top">
                                                {item.tiene_niveles_precio ? (
                                                    <div className="space-y-1">
                                                        {item.niveles_precio?.sort((a, b) => a.orden - b.orden).map((nivel, idx) => (
                                                            <div key={nivel.id} className={`flex justify-end gap-2 text-xs py-2 ${idx !== (item.niveles_precio?.length || 0) - 1 ? 'border-b border-gray-300' : ''}`}>
                                                                <span className="text-slate-400">{nivel.nombre}:</span>
                                                                <span className="font-medium text-rose-600">
                                                                    {formatImpacto(nivel.tipo_impacto, nivel.valor_impacto, nivel.valor_impacto_secundario)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="font-medium text-rose-600">
                                                        {formatImpacto(item.tipo_impacto, item.valor_impacto, item.valor_impacto_secundario)}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {acabados.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic">No hay acabados registrados</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="text-xs text-gray-400 pt-4 px-1">
                        * Los precios y porcentajes están sujetos a cambios. Documento para uso interno.
                    </div>

                </div>
            </div>
        );
    }
);

ServiciosYAcabadosPDFTemplate.displayName = 'ServiciosYAcabadosPDFTemplate';
