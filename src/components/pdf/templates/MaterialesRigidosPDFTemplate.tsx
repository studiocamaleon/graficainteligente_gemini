import { forwardRef } from 'react';
import { PDFBadge } from '../PDFBadge';
import { formatCurrency } from '../../../utils/pdfHelpers';
import type { ProductosAgrupadosPorMaterial } from '../../../hooks/useAllProductosMaterialesRigidosPrecios';

interface MaterialesRigidosPDFTemplateProps {
  productosAgrupados: ProductosAgrupadosPorMaterial;
}

const calcularM2Placa = (ancho: number, alto: number): number => {
  return (ancho * alto) / 10000;
};

const calcularPrecioM2 = (
  precioPlaca: number,
  ancho: number,
  alto: number
): number => {
  const m2 = calcularM2Placa(ancho, alto);
  return m2 > 0 ? precioPlaca / m2 : 0;
};

export const MaterialesRigidosPDFTemplate = forwardRef<HTMLDivElement, MaterialesRigidosPDFTemplateProps>(
  ({ productosAgrupados }, ref) => {
    const materialesIds = Object.keys(productosAgrupados);

    return (
      <div
        ref={ref}
        className="bg-white p-8 font-sans text-gray-900"
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
        <div className="mb-12 border-b border-gray-100 pb-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Lista de Precios</h1>
              <p className="text-gray-500 mt-1">Materiales Rígidos</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              Generado el {new Date().toLocaleDateString('es-ES')}
            </div>
          </div>
        </div>

        <div className="space-y-12">
          {materialesIds.map((materialId, index) => {
            const grupo = productosAgrupados[materialId];
            return (
              <div key={materialId} className={`avoid-break ${index > 0 ? 'mt-8' : ''}`}>
                <div className="mb-6 flex items-center justify-between border-l-4 border-indigo-500 pl-3">
                  <h2 className="text-xl font-bold text-slate-900">{grupo.material_nombre}</h2>
                  <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
                    {grupo.productos.length} {grupo.productos.length === 1 ? 'Variante' : 'Variantes'}
                  </span>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                      <tr>
                        <th className="px-4 py-3 border-b border-gray-200">Producto / Variante</th>
                        <th className="px-4 py-3 border-b border-gray-200 text-center">Espesor</th>
                        <th className="px-4 py-3 border-b border-gray-200 text-center">Medida Placa</th>
                        <th className="px-4 py-3 border-b border-gray-200 text-right">Precio Placa</th>
                        <th className="px-4 py-3 border-b border-gray-200 text-right">Precio m²</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {grupo.productos.map((producto, idx) => {
                        const precioPlaca = producto.precio_actual?.precio_placa || 0;
                        const precioM2 = precioPlaca > 0
                          ? calcularPrecioM2(precioPlaca, producto.medida_placa_ancho, producto.medida_placa_alto)
                          : 0;
                        const m2Placa = calcularM2Placa(producto.medida_placa_ancho, producto.medida_placa_alto);

                        return (
                          <tr key={producto.id} className="hover:bg-slate-50/50 avoid-break">
                            <td className="px-4 py-3 text-slate-700">
                              <div className="font-medium">{producto.nombre}</div>
                              <div className="text-xs text-slate-500">{producto.material.variante_nombre}</div>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-600">
                              {producto.material.espesor !== null ? `${producto.material.espesor} mm` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-600">
                              {producto.medida_placa_ancho} × {producto.medida_placa_alto} cm
                              <span className="block text-xs text-gray-400">({m2Placa.toFixed(2)} m²)</span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">
                              {precioPlaca > 0 ? formatCurrency(precioPlaca) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-500 text-xs">
                              {precioM2 > 0 ? formatCurrency(precioM2) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

MaterialesRigidosPDFTemplate.displayName = 'MaterialesRigidosPDFTemplate';
