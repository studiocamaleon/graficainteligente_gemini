import { Document, Page, View, Text, StyleSheet, pdf } from '../reactPdfWrapper';
import { PDFHeader } from '../pdfComponents/PDFHeader';
import { PDFFooter } from '../pdfComponents/PDFFooter';
import { PDFBadge } from '../pdfComponents/PDFBadge';
import { PDFPageNumber } from '../pdfComponents/PDFPageNumber';
import { commonStyles, colors } from '../pdfComponents/styles';
import type {
  ProductoMaterialRigidoParaPrecios,
  ProductosAgrupadosPorMaterial,
} from '../../hooks/useAllProductosMaterialesRigidosPrecios';

const styles = StyleSheet.create({
  materialSection: {
    marginBottom: 20,
  },
  materialHeader: {
    backgroundColor: colors.blue50,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.blue100,
  },
  materialTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  materialCount: {
    fontSize: 9,
    color: colors.gray500,
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
  colProducto: {
    width: '20%',
  },
  colVariante: {
    width: '18%',
  },
  colEspesor: {
    width: '15%',
  },
  colMedida: {
    width: '20%',
  },
  colPrecioPlaca: {
    width: '13%',
  },
  colPrecioM2: {
    width: '14%',
  },
  priceText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.success,
  },
  medidaContainer: {
    flexDirection: 'column',
  },
  medidaPrimary: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.gray900,
  },
  medidaSecondary: {
    fontSize: 8,
    color: colors.gray500,
    marginTop: 2,
  },
  badgeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  espesorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: colors.gray100,
    fontSize: 8,
    color: colors.gray700,
  },
  noAplicaText: {
    fontSize: 8,
    color: colors.gray500,
    fontStyle: 'italic',
    textAlign: 'center',
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

const calcularM2Placa = (ancho: number, alto: number): number => {
  return (ancho * alto) / 10000;
};

const calcularPrecioM2 = (precioPlaca: number, ancho: number, alto: number): number => {
  const m2 = calcularM2Placa(ancho, alto);
  return m2 > 0 ? precioPlaca / m2 : 0;
};

interface MaterialSectionProps {
  materialNombre: string;
  productos: ProductoMaterialRigidoParaPrecios[];
  productosCount: number;
}

function MaterialSection({ materialNombre, productos, productosCount }: MaterialSectionProps) {
  return (
    <View style={styles.materialSection} wrap={false}>
      <View style={styles.materialHeader}>
        <Text style={styles.materialTitle}>{materialNombre}</Text>
        <Text style={styles.materialCount}>
          {productosCount} {productosCount === 1 ? 'combinación' : 'combinaciones'}
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colProducto]}>Producto</Text>
          <Text style={[styles.tableHeaderText, styles.colVariante]}>Variante</Text>
          <Text style={[styles.tableHeaderText, styles.colEspesor]}>Espesor</Text>
          <Text style={[styles.tableHeaderText, styles.colMedida]}>Medida de Placa</Text>
          <Text style={[styles.tableHeaderText, styles.colPrecioPlaca]}>Precio Placa</Text>
          <Text style={[styles.tableHeaderText, styles.colPrecioM2]}>Precio m²</Text>
        </View>

        {productos.map((producto, index) => {
          const precioPlaca = producto.precio_actual?.precio_placa || 0;
          const precioM2 =
            precioPlaca > 0
              ? calcularPrecioM2(precioPlaca, producto.medida_placa_ancho, producto.medida_placa_alto)
              : 0;
          const m2Placa = calcularM2Placa(producto.medida_placa_ancho, producto.medida_placa_alto);

          return (
            <View
              key={producto.id}
              style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, styles.colProducto]}>{producto.nombre}</Text>
              <Text style={[styles.tableCell, styles.colVariante]}>
                {producto.material.variante_nombre}
              </Text>
              <View style={[styles.colEspesor, styles.badgeContainer]}>
                {producto.material.espesor !== null ? (
                  <Text style={styles.espesorBadge}>{producto.material.espesor} mm</Text>
                ) : (
                  <Text style={styles.noAplicaText}>No aplica</Text>
                )}
              </View>
              <View style={[styles.colMedida, styles.medidaContainer]}>
                <Text style={styles.medidaPrimary}>
                  {producto.medida_placa_ancho} × {producto.medida_placa_alto} cm
                </Text>
                <Text style={styles.medidaSecondary}>({m2Placa.toFixed(2)} m²)</Text>
              </View>
              <Text style={[styles.priceText, styles.colPrecioPlaca, styles.tableCellRight]}>
                {precioPlaca > 0 ? formatCurrency(precioPlaca) : '-'}
              </Text>
              <Text style={[styles.priceText, styles.colPrecioM2, styles.tableCellRight]}>
                {precioM2 > 0 ? formatCurrency(precioM2) : '-'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

interface MaterialesRigidosPDFDocumentProps {
  productosAgrupados: ProductosAgrupadosPorMaterial;
}

function MaterialesRigidosPDFDocument({ productosAgrupados }: MaterialesRigidosPDFDocumentProps) {
  const materialesIds = Object.keys(productosAgrupados);

  return (
    <Document>
      <Page size="A4" style={commonStyles.page}>
        <PDFHeader title="Lista de Precios" subtitle="Materiales Rígidos" />

        {materialesIds.length === 0 ? (
          <View style={commonStyles.emptyState}>
            <Text>No hay productos disponibles para exportar.</Text>
          </View>
        ) : (
          <View>
            {materialesIds.map((materialId) => {
              const grupo = productosAgrupados[materialId];
              return (
                <MaterialSection
                  key={materialId}
                  materialNombre={grupo.material_nombre}
                  productos={grupo.productos}
                  productosCount={grupo.productos.length}
                />
              );
            })}
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

export const generateMaterialesRigidosReactPDF = async (
  productosAgrupados: ProductosAgrupadosPorMaterial
) => {
  const doc = <MaterialesRigidosPDFDocument productosAgrupados={productosAgrupados} />;
  const asPdf = pdf(doc);
  const blob = await asPdf.toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Lista_Precios_Materiales_Rigidos_${formatDateForFilename()}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
