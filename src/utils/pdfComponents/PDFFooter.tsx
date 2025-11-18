import { View, Text } from '@react-pdf/renderer';
import { commonStyles } from './styles';

interface PDFFooterProps {
  companyName?: string;
  date?: Date;
}

export function PDFFooter({ companyName = 'Sistema de Gestión', date = new Date() }: PDFFooterProps) {
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  return (
    <View style={commonStyles.footer} fixed>
      <Text style={commonStyles.footerText}>{companyName}</Text>
      <Text style={commonStyles.footerText}>{formatDate(date)}</Text>
    </View>
  );
}
