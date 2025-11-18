import { View, Text, StyleSheet } from '../reactPdfWrapper';
import { colors } from './styles';

interface PDFInkBadgeProps {
  tinta: string;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cmyk: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  rgb: {
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
  },
  blanco: {
    backgroundColor: '#F3F4F6',
    color: '#374151',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  barniz: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  default: {
    backgroundColor: colors.gray100,
    color: colors.gray700,
  },
});

export function PDFInkBadge({ tinta }: PDFInkBadgeProps) {
  const getInkStyle = () => {
    const tintaUpper = tinta.toUpperCase();
    if (tintaUpper.includes('CMYK')) return styles.cmyk;
    if (tintaUpper.includes('RGB')) return styles.rgb;
    if (tintaUpper.includes('BLANCO')) return styles.blanco;
    if (tintaUpper.includes('BARNIZ')) return styles.barniz;
    return styles.default;
  };

  const getInkLabel = () => {
    const tintaUpper = tinta.toUpperCase();
    if (tintaUpper.includes('CMYK')) return 'CMYK';
    if (tintaUpper.includes('RGB')) return 'RGB';
    if (tintaUpper.includes('BLANCO')) return 'Blanco';
    if (tintaUpper.includes('BARNIZ')) return 'Barniz';
    return tinta;
  };

  return (
    <View style={[styles.badge, getInkStyle()]}>
      <Text>{getInkLabel()}</Text>
    </View>
  );
}
