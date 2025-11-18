import { Document, Page, View, Text, StyleSheet, pdf } from '../reactPdfWrapper';
import { PDFHeader } from '../pdfComponents/PDFHeader';
import { PDFFooter } from '../pdfComponents/PDFFooter';
import { PDFInkBadge } from '../pdfComponents/PDFInkBadge';
import { PDFPageNumber } from '../pdfComponents/PDFPageNumber';
import { commonStyles, colors } from '../pdfComponents/styles';
import type { ProductoLaserParaPrecios } from '../../hooks/useAllProductosLaserPrecios';

const styles = StyleSheet.create({
  productoSection: {
    marginBottom: 20,
    break: true,
  },
  productoHeader: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  productoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
  },
  materialInfo: {
    fontSize: 9,
    color: colors.gray500,
    marginBottom: 12,
    paddingLeft: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.white,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  tableRowAlt: {
    backgroundColor: colors.gray50,
  },
  tableCell: {
    fontSize: 9,
    color: colors.gray700,
  },
  tableCellCenter: {
    textAlign: 'center',
  },
  tableCellRight: {
    textAlign: 'right',
  },
  colMedida: {
    width: '25%',
  },
  colTinta: {
    width: '30%',
  },
  colCantidad: {
    width: '15%',
  },
  colCara: {
    width: '15%',
  },
  colPrecio: {
    width: '15%',
  },
  priceText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.success,
  },
  tintaBadgeContainer: {
    paddingLeft: 4,
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

const getCantidades = (producto: ProductoLaserParaPrecios): number[] => {
  if (producto.tipo_venta === 'cantidades_fijas') {
    return producto.cantidades_fijas || [];
  }
  return [1];
};

interface CombinacionPrecio {
  medida: string;
  tinta: string;
  cantidad: number;
  cara: string;
  precio: number;
}

interface ProductoSectionProps {
  producto: ProductoLaserParaPrecios;
}

function ProductoSection({ producto }: ProductoSectionProps) {
  const combinaciones: CombinacionPrecio[] = [];

  producto.medidas_disponibles.forEach((medida) => {
    producto.tecnologias.forEach((tecnologia) => {
      tecnologia.tintas.forEach((tinta) => {
        const cantidades = getCantidades(producto);

        cantidades.forEach((cantidad) => {
          producto.caras_impresas.forEach((cara) => {
            const precioExistente = producto.precios_existentes.find(
              (p) =>
                p.medida_ancho === medida.ancho &&
                p.medida_alto === medida.alto &&
                p.tinta_id === tinta.id &&
                p.cantidad === cantidad &&
                p.cara_impresa === cara
            );

            if (precioExistente) {
              combinaciones.push({
                medida: `${medida.ancho} × ${medida.alto} cm`,
                tinta: tinta.nombre,
                cantidad: cantidad,
                cara: cara === 'simple' ? 'Simple' : 'Doble',
                precio: precioExistente.precio,
              });
            }
          });
        });
      });
    });
  });

  const materialInfo =
    producto.materiales.length > 0
      ? `Material: ${producto.materiales[0].material_nombre} - ${producto.materiales[0].variante_nombre}${
          producto.materiales[0].espesor
            ? ` (${producto.materiales[0].espesor} ${producto.materiales[0].unidad_espesor})`
            : ''
        }`
      : null;

  return (
    <View style={styles.productoSection}>
      <View style={styles.productoHeader}>
        <Text style={styles.productoTitle}>{producto.nombre}</Text>
      </View>

      {materialInfo && <Text style={styles.materialInfo}>{materialInfo}</Text>}

      {combinaciones.length === 0 ? (
        <Text style={styles.emptyText}>Sin precios configurados</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colMedida]}>Medida</Text>
            <Text style={[styles.tableHeaderText, styles.colTinta]}>Tinta</Text>
            <Text style={[styles.tableHeaderText, styles.colCantidad]}>Cantidad</Text>
            <Text style={[styles.tableHeaderText, styles.colCara]}>Cara</Text>
            <Text style={[styles.tableHeaderText, styles.colPrecio]}>Precio</Text>
          </View>

          {combinaciones.map((combo, index) => (
            <View
              key={`${combo.medida}-${combo.tinta}-${combo.cantidad}-${combo.cara}`}
              style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, styles.colMedida, styles.tableCellCenter]}>
                {combo.medida}
              </Text>
              <View style={[styles.colTinta, styles.tintaBadgeContainer]}>
                <Text style={styles.tableCell}>{combo.tinta}</Text>
              </View>
              <Text style={[styles.tableCell, styles.colCantidad, styles.tableCellCenter]}>
                {combo.cantidad}
              </Text>
              <Text style={[styles.tableCell, styles.colCara, styles.tableCellCenter]}>
                {combo.cara}
              </Text>
              <Text style={[styles.priceText, styles.colPrecio, styles.tableCellRight]}>
                {formatCurrency(combo.precio)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface ImpresionLaserPDFDocumentProps {
  productos: ProductoLaserParaPrecios[];
}

function ImpresionLaserPDFDocument({ productos }: ImpresionLaserPDFDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={commonStyles.page}>
        <PDFHeader title="Lista de Precios" subtitle="Impresión Láser" />

        {productos.length === 0 ? (
          <View style={commonStyles.emptyState}>
            <Text>No hay productos disponibles para exportar.</Text>
          </View>
        ) : (
          <View>
            {productos.map((producto) => (
              <ProductoSection key={producto.id} producto={producto} />
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

export const generateImpresionLaserReactPDF = async (productos: ProductoLaserParaPrecios[]) => {
  const doc = <ImpresionLaserPDFDocument productos={productos} />;
  const asPdf = pdf(doc);
  const blob = await asPdf.toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Lista_Precios_Impresion_Laser_${formatDateForFilename()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
