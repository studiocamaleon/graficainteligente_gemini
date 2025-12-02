import { PDFLayout } from '../PDFLayout';
import { PDFSectionHeader } from '../PDFSectionHeader';
import { PDFTable } from '../PDFTable';
import { PDFBadge } from '../PDFBadge';
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
  };
  totales.total = totales.subtotal - totales.descuentos;

  return (
    <PDFLayout
      title="PRESUPUESTO"
      companyLogo={companyData?.logo_url}
      companyName={companyData?.razon_social}
      companyAddress={companyData?.direccion}
      companyPhone={companyData?.telefono}
      companyEmail={companyData?.email}
    >
      {/* Número y fecha */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-blue-600 mb-2">
          N° {presupuesto.numero_presupuesto}
        </h2>
        <p className="text-gray-600">
          Fecha: {formatDate(presupuesto.fecha_creacion)}
        </p>
      </div>

      {/* Cliente */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <PDFSectionHeader title="CLIENTE" />
        <div className="mt-2 space-y-1">
          <p className="font-semibold">
            {presupuesto.cliente?.razon_social || 'Sin cliente'}
          </p>
          {presupuesto.cliente?.email && (
            <p className="text-sm text-gray-600">{presupuesto.cliente.email}</p>
          )}
          {presupuesto.cliente?.whatsapp && (
            <p className="text-sm text-gray-600">{presupuesto.cliente.whatsapp}</p>
          )}
          {presupuesto.cliente?.direccion && (
            <p className="text-sm text-gray-600">{presupuesto.cliente.direccion}</p>
          )}
        </div>
      </div>

      {/* Validez */}
      {presupuesto.fecha_validez && (
        <div className="text-right mb-4">
          <span className="text-red-600 font-semibold">
            Válido hasta: {formatDate(presupuesto.fecha_validez)}
          </span>
        </div>
      )}

      {/* Items */}
      <PDFTable
        headers={['Producto', 'Descripción', 'Cant.', 'Precio Unit.', 'Subtotal']}
        rows={(presupuesto.items || []).map((item) => [
          item.producto_nombre,
          item.descripcion || '-',
          item.cantidad.toString(),
          formatCurrency(item.precio_unitario_final),
          formatCurrency(item.precio_total),
        ])}
      />

      {/* Totales */}
      <div className="flex justify-end mt-6 mb-6">
        <div className="w-64 bg-gray-100 p-4 rounded-lg">
          <div className="flex justify-between mb-2">
            <span className="text-gray-700">Subtotal:</span>
            <span className="font-semibold">{formatCurrency(totales.subtotal)}</span>
          </div>
          {totales.descuentos > 0 && (
            <div className="flex justify-between mb-2 text-red-600">
              <span>Descuentos:</span>
              <span className="font-semibold">
                -{formatCurrency(totales.descuentos)}
              </span>
            </div>
          )}
          <div className="border-t-2 border-gray-300 pt-2 flex justify-between">
            <span className="text-lg font-bold text-blue-600">TOTAL:</span>
            <span className="text-xl font-bold text-blue-600">
              {formatCurrency(totales.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Condiciones */}
      {presupuesto.condiciones_comerciales && (
        <div className="mt-8">
          <PDFSectionHeader title="CONDICIONES COMERCIALES" />
          <div className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">
            {presupuesto.condiciones_comerciales}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-gray-300 text-center text-xs text-gray-500">
        <p>Presupuesto generado el {new Date().toLocaleDateString('es-ES')}</p>
      </div>
    </PDFLayout>
  );
}
