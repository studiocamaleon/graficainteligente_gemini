import type { PresupuestoConRelaciones } from '../../../types/presupuestos';

interface PresupuestoPDFTemplateProps {
  presupuesto: PresupuestoConRelaciones;
  companyData: any;
}

export function PresupuestoPDFTemplate({
  presupuesto,
  companyData,
}: PresupuestoPDFTemplateProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const totales = {
    subtotal: (presupuesto.items || []).reduce(
      (sum, item) => sum + Number(item.precio_total),
      0
    ),
    descuentos: 0,
    total: 0
  };
  totales.total = totales.subtotal - totales.descuentos;

  return (
    <div className="bg-white p-8 font-sans text-gray-900" style={{ minWidth: '210mm', maxWidth: '210mm', margin: '0 auto' }}>
      {/* Print Styles */}
      <style type="text/css">
        {`
          @page {
            size: A4;
            margin: 0;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}
      </style>

      {/* Header */}
      <div className="flex justify-between items-start mb-12">
        <div className="flex-1">
          {companyData?.logo_url ? (
            <img
              src={companyData.logo_url}
              alt={companyData.name}
              className="h-16 w-auto object-contain mb-4"
            />
          ) : (
            <div className="h-12 w-12 bg-gray-900 rounded-lg flex items-center justify-center mb-4">
              <span className="text-white font-bold text-xl">{(companyData?.name || 'C').charAt(0)}</span>
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{companyData?.name || companyData?.legal_name}</h1>
          <div className="text-sm text-gray-500 mt-1 space-y-0.5">
            {companyData?.address && <p>{companyData.address}</p>}
            {companyData?.contact_phone && <p>{companyData.contact_phone}</p>}
            {(companyData?.contact_email || companyData?.email) && <p>{companyData?.contact_email || companyData?.email}</p>}
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Presupuesto</h2>
          <p className="text-3xl font-bold text-gray-900">{presupuesto.numero_presupuesto}</p>
          <div className="mt-4 text-sm text-gray-500 space-y-1">
            <p>Fecha: <span className="font-medium text-gray-900">{formatDate(presupuesto.fecha_creacion)}</span></p>
            {presupuesto.fecha_validez && (
              <p>Válido hasta: <span className="font-medium text-red-600">{formatDate(presupuesto.fecha_validez)}</span></p>
            )}
          </div>
        </div>
      </div>

      {/* Client Section */}
      <div className="mb-12 border-t border-gray-100 pt-8">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Preparado para</h3>
        <p className="text-lg font-bold text-gray-900">{presupuesto.cliente?.razon_social || 'Cliente Final'}</p>
        <div className="text-sm text-gray-500 mt-1">
          {presupuesto.cliente?.email && <p>{presupuesto.cliente.email}</p>}
          {presupuesto.cliente?.telefono && <p>{presupuesto.cliente.telefono}</p>}
          {presupuesto.cliente?.domicilio && <p>{presupuesto.cliente.domicilio}</p>}
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-left">Item / Descripción</th>
              <th className="py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Cant.</th>
              <th className="py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Precio Unit.</th>
              <th className="py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Total</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-700">
            {(presupuesto.items || []).map((item, index) => (
              <tr key={index} className="border-b border-gray-50 last:border-0">
                <td className="py-4 pr-4">
                  <p className="font-semibold text-gray-900">{item.producto_nombre}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {(() => {
                      if (item.tipo_item === 'item_personalizado') {
                        return item.descripcion || '-';
                      }

                      // Helper logic for formating configuration (Inline to avoid external dep complications in templates)
                      const config = item.configuracion || {};
                      const parts: string[] = [];

                      // 1. Medidas con Unidad Correcta
                      if (config.medida_ancho || config.medida_alto) {
                        const unidad = config.unidad_medida || ((config.categoria === 'Impresion Laser' || config.tecnologia_nombre === 'Impresion Laser') ? 'mm' : 'cm');
                        if (config.medida_ancho && config.medida_alto) {
                          parts.push(`${config.medida_ancho}x${config.medida_alto} ${unidad}`);
                        } else {
                          parts.push(`${config.medida_ancho || config.medida_alto} ${unidad}`);
                        }
                      }

                      // 2. Material
                      if (config.material_nombre) {
                        let mat = config.material_nombre;
                        if (config.variante_nombre) mat += ` - ${config.variante_nombre}`;
                        parts.push(mat);
                      }

                      // 3. Espesor/Gramaje
                      if (config.espesor) {
                        const unidadEspesor = config.unidad_espesor || 'mm';
                        if (unidadEspesor === 'gr' || unidadEspesor === 'g') {
                          parts.push(`${config.espesor} ${unidadEspesor}`);
                        } else {
                          parts.push(`${config.espesor}${unidadEspesor}`);
                        }
                      } else if (config.gramaje) {
                        parts.push(`${config.gramaje} g`);
                      }

                      // 4. Tecnología/Tinta/Cara/Color
                      if (config.tecnologia_nombre) parts.push(config.tecnologia_nombre);
                      if (config.tinta_nombre) parts.push(config.tinta_nombre);

                      if (config.cara_impresa) {
                        const mapCara: Record<string, string> = {
                          '1/0': 'Frente',
                          '1/1': 'Frente y Dorso',
                          'frente_y_dorso': 'Frente y Dorso',
                          'solo_frente': 'Frente'
                        };
                        parts.push(mapCara[config.cara_impresa] || config.cara_impresa);
                      }

                      if (config.color) parts.push(config.color);
                      if (config.marca) parts.push(config.marca);

                      // 5. Servicios y Acabados
                      if (config.servicios_seleccionados?.length > 0) {
                        const servs = config.servicios_seleccionados.map((s: any) => s.nombre).join(', ');
                        parts.push(`Servicios: ${servs}`);
                      }
                      if (config.acabados_seleccionados?.length > 0) {
                        const acabs = config.acabados_seleccionados.map((a: any) => a.nombre).join(', ');
                        parts.push(`Acabados: ${acabs}`);
                      }

                      const generatedDesc = parts.join(' | ');

                      // Si hay descripción manual adicional (y no es igual a lo generado), la agregamos
                      if (item.descripcion && item.descripcion !== '-' && !generatedDesc.includes(item.descripcion)) {
                        return generatedDesc ? `${generatedDesc}\n${item.descripcion}` : item.descripcion;
                      }

                      return generatedDesc || item.descripcion || '-';
                    })()}
                  </p>
                </td>
                <td className="py-4 text-right whitespace-nowrap">{item.cantidad}</td>
                <td className="py-4 text-right whitespace-nowrap">{formatCurrency(item.precio_unitario_final || 0)}</td>
                <td className="py-4 text-right whitespace-nowrap font-medium text-gray-900">{formatCurrency(item.precio_total || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div className="flex justify-end mb-12">
        <div className="w-1/2 space-y-3 pt-4 border-t border-gray-200">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrency(totales.subtotal)}</span>
          </div>
          {totales.descuentos > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Descuentos</span>
              <span>-{formatCurrency(totales.descuentos)}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline pt-3 border-t border-gray-100">
            <span className="text-lg font-bold text-gray-900">Total</span>
            <div className="text-right">
              <span className="text-2xl font-bold text-gray-900 block">{formatCurrency(totales.total)}</span>
              <span className="text-xs text-gray-500 font-medium">(+ IVA)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conditions */}
      {presupuesto.condiciones_comerciales && (
        <div className="mb-12 p-6 bg-gray-50 rounded-lg border border-gray-100">
          <h4 className="text-xs font-bold text-gray-900 uppercase mb-2">Condiciones Comerciales</h4>
          <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
            {presupuesto.condiciones_comerciales}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center pt-8 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Este documento es un presupuesto válido. Generado el {new Date().toLocaleDateString('es-ES')}.
        </p>
      </div>
    </div>
  );
}
