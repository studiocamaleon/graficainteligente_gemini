import { forwardRef } from 'react';
import { PDFLayout } from '../PDFLayout';
import { PDFTable } from '../PDFTable';
import { PDFSectionHeader } from '../PDFSectionHeader';
import { PDFBadge } from '../PDFBadge';
import { formatCurrency } from '../../../utils/pdfHelpers';

interface MaterialUVPDF {
  material_nombre: string;
  variante_nombre: string;
  espesor: number | null;
  unidad_espesor: string | null;
  dim_ancho_cm: number;
  dim_alto_cm: number;
  precio_por_m2: number;
}

interface PrecioImpresionUVPDF {
  tinta: string;
  rango_minimo: number;
  rango_maximo: number | null;
  precio_por_m2: number;
}

interface ProductoUVPDF {
  nombre: string;
  limite_ancho_cm: number | null;
  limite_alto_cm: number | null;
  permite_material_cliente: boolean;
  materiales: MaterialUVPDF[];
  precios_impresion: PrecioImpresionUVPDF[];
}

interface ImpresionUVRigidosPDFTemplateProps {
  productos: ProductoUVPDF[];
}

const getNombreTinta = (tinta: string): string => {
  const nombresMap: Record<string, string> = {
    'K': 'Negro (K)',
    'CMYK': 'Color (CMYK)',
    'CMYK+W': 'Color + Blanco',
    'CMYK+V': 'Color + Barniz',
    'CMYK+W+V': 'Color + Blanco + Barniz'
  };
  return nombresMap[tinta] || tinta;
};

const formatRango = (minimo: number, maximo: number | null): string => {
  if (maximo === null) {
    return `${minimo.toFixed(2)} m² en adelante`;
  }
  return `${minimo.toFixed(2)} - ${maximo.toFixed(2)} m²`;
};

export const ImpresionUVRigidosPDFTemplate = forwardRef<HTMLDivElement, ImpresionUVRigidosPDFTemplateProps>(
  ({ productos }, ref) => {
    return (
      <PDFLayout
        ref={ref}
        title="Lista de Precios"
        subtitle="Impresión UV sobre Rígidos"
      >
        <div className="space-y-8">
          {productos.map((producto, index) => (
            <div key={index} className="space-y-6">
              <PDFSectionHeader
                title={producto.nombre}
                badge={
                  <PDFBadge
                    label={producto.permite_material_cliente ? 'Con/Sin Material' : 'Solo Con Material'}
                    color="pink"
                    size="md"
                  />
                }
                color="pink"
              />

              {/* Información general */}
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Límites de Tamaño</div>
                    <div className="text-sm text-gray-900 mt-1">
                      {producto.limite_ancho_cm && producto.limite_alto_cm
                        ? `Máximo: ${producto.limite_ancho_cm} × ${producto.limite_alto_cm} cm`
                        : 'Sin límites definidos'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Modalidad de Trabajo</div>
                    <div className="text-sm text-gray-900 mt-1">
                      {producto.permite_material_cliente
                        ? 'Acepta material del cliente o material del catálogo'
                        : 'Solo material del catálogo'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Materiales disponibles */}
              {producto.materiales.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">Materiales Disponibles</h3>
                  <PDFTable
                    columns={[
                      { header: 'Material', key: 'material', align: 'left', width: '30%' },
                      { header: 'Variante', key: 'variante', align: 'left', width: '20%' },
                      { header: 'Espesor', key: 'espesor', align: 'center', width: '15%' },
                      { header: 'Dimensiones', key: 'dimensiones', align: 'center', width: '20%' },
                      { header: 'Precio/m²', key: 'precio_m2', align: 'right', width: '15%' },
                    ]}
                    data={producto.materiales.map((mat) => {
                      const m2 = (mat.dim_ancho_cm * mat.dim_alto_cm) / 10000;
                      return {
                        material: mat.material_nombre,
                        variante: mat.variante_nombre,
                        espesor: mat.espesor && mat.unidad_espesor
                          ? `${mat.espesor} ${mat.unidad_espesor}`
                          : '-',
                        dimensiones: `${mat.dim_ancho_cm} × ${mat.dim_alto_cm} cm (${m2.toFixed(2)} m²)`,
                        precio_m2: formatCurrency(mat.precio_por_m2),
                      };
                    })}
                  />
                </div>
              )}

              {/* Precios de impresión UV */}
              {producto.precios_impresion.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">Precios de Impresión UV</h3>
                  <PDFTable
                    columns={[
                      { header: 'Tipo de Tinta', key: 'tinta', align: 'left', width: '30%' },
                      { header: 'Rango de m²', key: 'rango', align: 'left', width: '40%' },
                      { header: 'Precio/m²', key: 'precio', align: 'right', width: '30%' },
                    ]}
                    data={producto.precios_impresion.map((precio) => ({
                      tinta: getNombreTinta(precio.tinta),
                      rango: formatRango(precio.rango_minimo, precio.rango_maximo),
                      precio: formatCurrency(precio.precio_por_m2),
                    }))}
                  />
                </div>
              )}

              {/* Nota informativa */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-xs text-gray-700">
                  <strong>Nota:</strong> El precio final se calcula sumando el costo del material (si aplica) más el costo de la impresión UV según los m² y el tipo de tinta seleccionado.
                  {producto.permite_material_cliente && (
                    <span> Si el cliente provee el material, solo se cobra la impresión UV.</span>
                  )}
                </div>
              </div>

              {index < productos.length - 1 && (
                <div className="border-t border-gray-200 my-6"></div>
              )}
            </div>
          ))}
        </div>
      </PDFLayout>
    );
  }
);

ImpresionUVRigidosPDFTemplate.displayName = 'ImpresionUVRigidosPDFTemplate';
