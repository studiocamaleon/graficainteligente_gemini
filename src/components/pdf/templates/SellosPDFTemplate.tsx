import { forwardRef } from 'react';

interface ProductoSelloConPrecio {
  id: string;
  nombre: string;
  tipo_producto: string;
  medida_ancho: number | null;
  medida_alto: number | null;
  marca: string | null;
  precio_unitario: number;
}

interface SellosPDFTemplateProps {
  productos: ProductoSelloConPrecio[];
}

const getTipoProductoLabel = (tipo: string): string => {
  const labels: Record<string, string> = {
    sello: 'Sello',
    repuesto: 'Repuesto',
    polimero: 'Polímero',
    tinta: 'Tinta',
    accesorios: 'Accesorios',
  };
  return labels[tipo] || tipo;
};

const formatMedida = (ancho: number | null, alto: number | null): string => {
  if (!ancho && !alto) return '-';
  if (ancho && alto) return `${ancho} x ${alto} mm`;
  if (ancho) return `${ancho} mm`;
  if (alto) return `${alto} mm`;
  return '-';
};

export const SellosPDFTemplate = forwardRef<HTMLDivElement, SellosPDFTemplateProps>(
  ({ productos }, ref) => {

    // Optional: Group by 'Tipo' if desired, but a flat list sorted by type/name is also fine for Sellos.
    // For now, we'll keep the list but styling it nicely.

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
              <p className="text-gray-500 mt-1">Sellos y Accesorios</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              Generado el {new Date().toLocaleDateString('es-ES')}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="border border-gray-200 rounded-lg overflow-hidden avoid-break">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3 border-b border-gray-200 w-1/4">Producto</th>
                  <th className="px-4 py-3 border-b border-gray-200 w-1/6">Tipo</th>
                  <th className="px-4 py-3 border-b border-gray-200 w-1/6">Marca</th>
                  <th className="px-4 py-3 border-b border-gray-200 text-center w-1/6">Medida</th>
                  <th className="px-4 py-3 border-b border-gray-200 text-right w-1/6">Precio Unitario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productos.map((producto, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 avoid-break">
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {producto.nombre}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                        {getTipoProductoLabel(producto.tipo_producto)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {producto.marca || '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {formatMedida(producto.medida_ancho, producto.medida_alto)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {producto.precio_unitario > 0 ? `$ ${producto.precio_unitario.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-400 pt-4 px-1">
            * Precios unitarios. No incluye IVA.
          </div>
        </div>
      </div>
    );
  }
);

SellosPDFTemplate.displayName = 'SellosPDFTemplate';
