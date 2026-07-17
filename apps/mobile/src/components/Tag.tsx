import { View, Text, StyleSheet } from 'react-native';
import { radius, typography } from '../theme';

export type TagStatus = 'draft' | 'pending' | 'risk' | 'done' | 'info' | 'warning';

const TAG_STYLES: Record<TagStatus, { bg: string; text: string; dot: string; border: string }> = {
  draft: { bg: '#F0F9FF', text: '#0369A1', dot: '#38BDF8', border: '#BAE6FD' },
  pending: { bg: '#FFFBEB', text: '#B45309', dot: '#FBBF24', border: '#FDE68A' },
  risk: { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444', border: '#FECACA' },
  done: { bg: '#ECFDF5', text: '#047857', dot: '#10B981', border: '#A7F3D0' },
  info: { bg: '#F9FAFB', text: '#4B5563', dot: '#9CA3AF', border: '#E5E7EB' },
  warning: { bg: '#FFF7ED', text: '#C2410C', dot: '#FB923C', border: '#FED7AA' },
};

const LABELS: Partial<Record<TagStatus, string>> = {
  draft: 'AI草稿',
  pending: '待确认',
  risk: '需处理',
  done: '已审批',
  warning: '截止临近',
};

interface TagProps {
  status: TagStatus;
  label?: string;
}

export function Tag({ status, label }: TagProps) {
  const s = TAG_STYLES[status];
  const text = label ?? LABELS[status] ?? status;
  return (
    <View style={[styles.wrap, { backgroundColor: s.bg, borderColor: s.border }]}>
      <View style={[styles.dot, { backgroundColor: s.dot }]} />
      <Text style={[styles.text, { color: s.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: typography.xs, fontWeight: '500' },
});
