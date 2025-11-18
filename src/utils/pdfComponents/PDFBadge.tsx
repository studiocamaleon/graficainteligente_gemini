import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { commonStyles, colors } from './styles';

interface PDFBadgeProps {
  children: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
}

export function PDFBadge({ children, variant = 'secondary' }: PDFBadgeProps) {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'primary':
        return commonStyles.badgePrimary;
      case 'success':
        return commonStyles.badgeSuccess;
      case 'warning':
        return commonStyles.badgeWarning;
      default:
        return commonStyles.badgeSecondary;
    }
  };

  return (
    <View style={[commonStyles.badge, getBadgeStyle()]}>
      <Text>{children}</Text>
    </View>
  );
}
