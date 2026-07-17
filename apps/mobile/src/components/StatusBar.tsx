import { View, StyleSheet, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

interface StatusBarProps extends ViewProps {
  dark?: boolean;
}

export function StatusBar({ dark = false, style, children, ...rest }: StatusBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top, backgroundColor: dark ? colors.dark : colors.card },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: '100%' },
});