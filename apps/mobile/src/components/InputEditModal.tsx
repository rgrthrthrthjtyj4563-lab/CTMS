import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { colors, radius } from '../theme';

type Props = {
  visible: boolean;
  initialContent: string;
  title?: string;
  onClose: () => void;
  onSave: (content: string, reason: string) => Promise<void>;
  onVoid: (reason: string) => Promise<void>;
};

export function InputEditModal({
  visible,
  initialContent,
  title = '编辑工作记录',
  onClose,
  onSave,
  onVoid,
}: Props) {
  const [content, setContent] = useState(initialContent);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setContent(initialContent);
      setReason('');
      setError(null);
    }
  }, [visible, initialContent]);

  const save = async () => {
    if (!content.trim()) {
      setError('内容不能为空');
      return;
    }
    if (!reason.trim()) {
      setError('请填写修改原因（合规留痕）');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(content.trim(), reason.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const voidIt = async () => {
    if (!reason.trim()) {
      setError('请填写作废原因');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onVoid(reason.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '作废失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.mask}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>修改与作废均写入审计，不物理删除</Text>
          <TextInput
            style={styles.input}
            multiline
            value={content}
            onChangeText={setContent}
            placeholder="记录内容"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={styles.reason}
            value={reason}
            onChangeText={setReason}
            placeholder="修改/作废原因（必填）"
            placeholderTextColor={colors.textMuted}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose} disabled={busy}>
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable style={styles.voidBtn} onPress={() => void voidIt()} disabled={busy}>
              <Trash2 size={14} color={colors.red} />
              <Text style={styles.voidText}>作废</Text>
            </Pressable>
            <Pressable style={styles.save} onPress={() => void save()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveText}>保存修改</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 16,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
    minHeight: 88,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  reason: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: 13,
    color: colors.text,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  error: { fontSize: 12, color: colors.red, marginBottom: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cancel: { paddingVertical: 10, paddingHorizontal: 12 },
  cancelText: { color: colors.textSecondary, fontWeight: '500' },
  voidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  voidText: { color: colors.red, fontWeight: '600', fontSize: 13 },
  save: {
    marginLeft: 'auto',
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 88,
    alignItems: 'center',
  },
  saveText: { color: colors.white, fontWeight: '600', fontSize: 13 },
});
