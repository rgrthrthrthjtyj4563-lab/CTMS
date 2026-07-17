import { View, StyleSheet, type ViewProps } from 'react-native';
import { colors, radius } from '../theme';

interface CardProps extends ViewProps {
  borderColor?: string;
}

export function Card({ style, borderColor, children, ...rest }: CardProps) {
  return (
    <View
      style={[styles.card, borderColor ? { borderColor } : null, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
});