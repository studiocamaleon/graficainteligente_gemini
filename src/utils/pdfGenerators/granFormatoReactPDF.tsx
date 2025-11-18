import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer';
import { PDFHeader } from '../pdfComponents/PDFHeader';
import { PDFFooter } from '../pdfComponents/PDFFooter';
import { PDFInkBadge } from '../pdfComponents/PDFInkBadge';
import { PDFPageNumber } from '../pdfComponents/PDFPageNumber';
import { commonStyles, colors } from '../pdfComponents/styles';
import type { TecnologiaAgrupada } from '../../hooks/useAllProductosGranFormatoPrecios';

const styles = StyleSheet.create({
  tecnologiaSection: {
    marginBottom: 24,
  },
  tecnologiaHeader: {
    backgroundColor: colors.purple,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  tecnologiaTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.white,
  },
  tintaSection: {
    marginBottom: 16,
  },
  tintaHeader: {
    backgroundColor: colors.gray100,
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tintaLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.gray700,
    marginRight: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.white,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  tableRowAlt: {
    backgroundColor: colors.gray50,
  },
  tableCell: {
    fontSize: 8,
    color: colors.gray700,
  },
  tableCellCenter: {
    textAlign: 'center',
  },
  tableCellRight: {
    textAlign: 'right',
  },
  priceCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.success,
    textAlign: 'right',
  },
  emptyText: {
    fontSize: 9,
    color: colors.gray500,
    textAlign: 'center',
    padding: 12,
  },
});

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

interface RangoTableProps {
  productos: any[];
  rangos: any[];
  tipoVenta: string;
  unidadMedida: string;
}

function RangoTable({ productos, rangos, tipoVenta, unidadMedida }: RangoTableProps) {
  if (productos.length === 0) return null;

  const tieneAnchoFijo = tipoVenta === 'mt_lineal';
  const colProductoWidth = tieneAnchoFijo ? '25%' : '35%';
  const colTipoVentaWidth = '20%';
  const colAnchoWidth = '15%';
  const numRangos = rangos.length;
  const rangoColWidth = tieneAnchoFijo
    ? `${(60 - 15) / numRangos}%`
    : `${(65 / numRangos)}%`;

  return (
    <View style={styles.table} wrap={false}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { width: colProductoWidth }]}>Producto</Text>
        <Text style={[styles.tableHeaderText, { width: colTipoVentaWidth }]}>Tipo de Venta</Text>
        {tieneAnchoFijo && (
          <Text style={[styles.tableHeaderText, { width: colAnchoWidth }]}>Ancho</Text>
        )}
        {rangos.map((rango, index) => {
          const rangoText =
            rango.max === Infinity
              ? `≥ ${rango.min} ${unidadMedida}`
              : `${rango.min}-${rango.max} ${unidadMedida}`;
          return (
            <Text key={index} style={[styles.tableHeaderText, { width: rangoColWidth }]}>
              {rangoText}
            </Text>
          );
        })}
      </View>

      {productos.map((producto, index) => (
        <View
          key={producto.id}
          style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
        >
          <Text style={[styles.tableCell, { width: colProductoWidth }]}>{producto.nombre}</Text>
          <Text style={[styles.tableCell, styles.tableCellCenter, { width: colTipoVentaWidth }]}>
            {producto.tipo_venta === 'mt2' ? 'm²' : 'mt lineal'}
          </Text>
          {tieneAnchoFijo && (
            <Text style={[styles.tableCell, styles.tableCellCenter, { width: colAnchoWidth }]}>
              {producto.ancho_fijo ? `${producto.ancho_fijo} cm` : '-'}
            </Text>
          )}
          {rangos.map((rango, rangoIndex) => (
            <Text key={rangoIndex} style={[styles.priceCell, { width: rangoColWidth }]}>
              -
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

interface TintaSectionProps {
  tintaData: any;
}

function TintaSection({ tintaData }: TintaSectionProps) {
  return (
    <View style={styles.tintaSection}>
      <View style={styles.tintaHeader}>
        <Text style={styles.tintaLabel}>Tinta:</Text>
        <PDFInkBadge tinta={tintaData.tinta} />
      </View>

      {Array.from(tintaData.productosPorRango.entries()).map(([rangoId, productos]) => {
        if (productos.length === 0) return null;

        const primerProducto = productos[0];

        return (
          <RangoTable
            key={rangoId}
            productos={productos}
            rangos={primerProducto.rangos}
            tipoVenta={primerProducto.tipo_venta}
            unidadMedida={primerProducto.unidad_medida}
          />
        );
      })}
    </View>
  );
}

interface TecnologiaSectionProps {
  tecnologia: TecnologiaAgrupada;
}

function TecnologiaSection({ tecnologia }: TecnologiaSectionProps) {
  return (
    <View style={styles.tecnologiaSection} wrap={false}>
      <View style={styles.tecnologiaHeader}>
        <Text style={styles.tecnologiaTitle}>{tecnologia.nombre}</Text>
      </View>

      {tecnologia.tintas.map((tintaData) => (
        <TintaSection key={tintaData.tinta} tintaData={tintaData} />
      ))}
    </View>
  );
}

interface GranFormatoPDFDocumentProps {
  tecnologiasAgrupadas: TecnologiaAgrupada[];
}

function GranFormatoPDFDocument({ tecnologiasAgrupadas }: GranFormatoPDFDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={commonStyles.page}>
        <PDFHeader title="Lista de Precios" subtitle="Gran Formato" />

        {tecnologiasAgrupadas.length === 0 ? (
          <View style={commonStyles.emptyState}>
            <Text>No hay productos disponibles para exportar.</Text>
          </View>
        ) : (
          <View>
            {tecnologiasAgrupadas.map((tecnologia) => (
              <TecnologiaSection key={tecnologia.id} tecnologia={tecnologia} />
            ))}
          </View>
        )}

        <PDFFooter />
        <PDFPageNumber />
      </Page>
    </Document>
  );
}

const formatDateForFilename = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

export const generateGranFormatoReactPDF = async (
  tecnologiasAgrupadas: TecnologiaAgrupada[]
) => {
  const doc = <GranFormatoPDFDocument tecnologiasAgrupadas={tecnologiasAgrupadas} />;
  const asPdf = pdf(doc);
  const blob = await asPdf.toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Lista_Precios_Gran_Formato_${formatDateForFilename()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
