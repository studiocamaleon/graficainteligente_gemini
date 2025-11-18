import { View, Text } from '@react-pdf/renderer';
import { commonStyles } from './styles';

interface PDFHeaderProps {
  title: string;
  subtitle?: string;
}

export function PDFHeader({ title, subtitle }: PDFHeaderProps) {
  return (
    <View style={commonStyles.header}>
      <Text style={commonStyles.headerTitle}>{title}</Text>
      {subtitle && <Text style={commonStyles.headerSubtitle}>{subtitle}</Text>}
    </View>
  );
}
