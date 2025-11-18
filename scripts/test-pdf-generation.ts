import { Document, Page, View, Text, StyleSheet, pdf } from '../src/utils/reactPdfWrapper';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  text: {
    fontSize: 12,
  },
});

const TestDocument = () => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View>
        <Text style={styles.title}>Prueba de Generación de PDF</Text>
        <Text style={styles.text}>Este es un PDF de prueba generado con @react-pdf/renderer</Text>
      </View>
    </Page>
  </Document>
);

async function testPDFGeneration() {
  console.log('Iniciando prueba de generación de PDF...');

  try {
    const doc = <TestDocument />;
    const asPdf = pdf(doc);
    const blob = await asPdf.toBlob();

    console.log('PDF generado exitosamente!');
    console.log('Tamaño del blob:', blob.size, 'bytes');
    console.log('Tipo MIME:', blob.type);

    return true;
  } catch (error) {
    console.error('Error al generar PDF:', error);
    return false;
  }
}

testPDFGeneration().then((success) => {
  if (success) {
    console.log('✓ Prueba completada con éxito');
    process.exit(0);
  } else {
    console.log('✗ Prueba fallida');
    process.exit(1);
  }
});
