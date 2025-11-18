import { Text, StyleSheet } from '@react-pdf/renderer';
import { colors } from './styles';

const styles = StyleSheet.create({
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    color: colors.gray500,
  },
});

export function PDFPageNumber() {
  return (
    <Text
      style={styles.pageNumber}
      render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      fixed
    />
  );
}
