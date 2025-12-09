import { forwardRef, Fragment } from 'react';
import { formatCurrency } from '../../../utils/pdfHelpers';
import type {
    CentroCopiadoTamanioPapel,
    CentroCopiadoPapel,
    CentroCopiadoRangoPrecioImpresion,
    TipoTintaCopiado
} from '../../../types/database';

interface PrecioCargado {
    tamanio_papel_id: string;
    papel_id: string;
    rango_precio_id: string;
    cara_impresa: 'frente' | 'frente_y_dorso';
    precio: number;
}

interface CentroCopiadoPapelWithMaterial extends CentroCopiadoPapel {
    material?: { nombre: string } | null;
}

interface CentroCopiadoPDFTemplateProps {
    tamanios: CentroCopiadoTamanioPapel[];
    papeles: CentroCopiadoPapelWithMaterial[];
    rangos: CentroCopiadoRangoPrecioImpresion[];
    preciosCMYK: Map<string, PrecioCargado[]>;
    preciosBN: Map<string, PrecioCargado[]>;
}

export const CentroCopiadoPDFTemplate = forwardRef<HTMLDivElement, CentroCopiadoPDFTemplateProps>(
    ({ tamanios, papeles, rangos, preciosCMYK, preciosBN }, ref) => {

        const getPrecio = (
            preciosMap: Map<string, PrecioCargado[]>,
            tamanioId: string,
            papelId: string,
            rangoId: string,
            cara: 'frente' | 'frente_y_dorso'
        ) => {
            const key = `${tamanioId}-${papelId}`;
            const preciosList = preciosMap.get(key);
            if (!preciosList) return '-';

            const found = preciosList.find(p => p.rango_precio_id === rangoId && p.cara_impresa === cara);
            return found && found.precio > 0 ? formatCurrency(found.precio) : '-';
        };

        const renderTintaSection = (tipoTinta: TipoTintaCopiado, preciosMap: Map<string, PrecioCargado[]>) => {
            return (
                <div className="mb-12">
                    <div className="mb-6 flex items-center gap-2 pdf-section-header">
                        <span className={`px-4 py-1.5 rounded-lg text-sm font-bold border ${tipoTinta === 'CMYK' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                            {tipoTinta === 'CMYK' ? 'Impresión Color (CMYK)' : 'Impresión Blanco y Negro'}
                        </span>
                    </div>

                    <div className="space-y-8">
                        {tamanios.map(tamanio => (
                            <div key={tamanio.id} className="avoid-break mb-8">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 border-l-4 border-slate-300 pl-3">
                                    Formato: {tamanio.nombre} <span className="text-sm font-normal text-slate-500">({tamanio.ancho_mm}x{tamanio.alto_mm}mm)</span>
                                </h3>

                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                                            <tr>
                                                <th rowSpan={2} className="px-4 py-3 border-b border-r border-gray-200 bg-gray-100/50 w-48 align-bottom">
                                                    Papel
                                                </th>
                                                {rangos.map(rango => (
                                                    <th key={rango.id} colSpan={2} className="px-2 py-2 border-b border-l border-gray-200 text-center bg-gray-50">
                                                        {rango.hojas_desde} - {rango.hojas_hasta || '+'}
                                                    </th>
                                                ))}
                                            </tr>
                                            <tr>
                                                {rangos.map(rango => (
                                                    <Fragment key={`sub-${rango.id}`}>
                                                        <th className="px-2 py-1.5 border-b border-l border-gray-100 text-right text-[10px] text-gray-400 font-semibold w-20">Frente</th>
                                                        <th className="px-2 py-1.5 border-b border-gray-100 text-right text-[10px] text-gray-400 font-semibold w-20">F/D</th>
                                                    </Fragment>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {papeles.map(papel => (
                                                <tr key={papel.id} className="hover:bg-slate-50/50 avoid-break">
                                                    <td className="px-4 py-3 font-medium text-slate-700 border-r border-gray-100">
                                                        <div className="flex flex-col">
                                                            <span>{papel.material?.nombre}</span>
                                                            <span className="text-xs text-slate-400 font-normal">
                                                                {papel.variante_nombre} {papel.espesor ? `(${papel.espesor}g)` : ''}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    {rangos.map(rango => (
                                                        <Fragment key={`${papel.id}-${rango.id}`}>
                                                            <td className="px-2 py-3 text-right text-slate-600 border-l border-gray-50 font-medium">
                                                                {getPrecio(preciosMap, tamanio.id, papel.id, rango.id, 'frente')}
                                                            </td>
                                                            <td className="px-2 py-3 text-right text-slate-600 font-medium">
                                                                {getPrecio(preciosMap, tamanio.id, papel.id, rango.id, 'frente_y_dorso')}
                                                            </td>
                                                        </Fragment>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        };

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
              .avoid-break { page-break-inside: avoid; break-inside: avoid; }
              tr { page-break-inside: avoid; break-inside: avoid-row; }
              table { page-break-inside: auto; break-inside: auto; }
            }
          `}
                </style>

                {/* Header */}
                <div className="mb-4 border-b border-gray-100 pb-3">
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Lista de Precios</h1>
                            <p className="text-gray-500 mt-0">Centro de Copiado</p>
                        </div>
                        <div className="text-right text-xs text-gray-400">
                            Generado el {new Date().toLocaleDateString('es-ES')}
                        </div>
                    </div>
                </div>

                <div className="space-y-12">
                    {renderTintaSection('CMYK', preciosCMYK)}
                    <div className="page-break" />
                    {renderTintaSection('K', preciosBN)}
                </div>
            </div>
        );
    }
);

CentroCopiadoPDFTemplate.displayName = 'CentroCopiadoPDFTemplate';
