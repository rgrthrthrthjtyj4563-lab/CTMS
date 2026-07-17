import { Modal, View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { useState } from 'react';
import { PHOTO_PURPOSES } from '../lib/photo-purpose';
import { colors, radius } from '../theme';

type Props = {
  visible: boolean;
  onCancel: () => void;
  onSelect: (purpose: string, note?: string) => void;
};

export function PurposePickerModal({ visible, onCancel, onSelect }: Props) {
  const [otherNote, setOtherNote] = useState('');
  const [showOther, setShowOther] = useState(false);

  const pick = (key: string, label: string) => {
    if (key === 'OTHER') {
      setShowOther(true);
      return;
    }
    setShowOther(false);
    setOtherNote('');
    onSelect(key, label);
  };

  const confirmOther = () => {
    if (!otherNote.trim()) return;
    onSelect('OTHER', otherNote.trim());
    setOtherNote('');
    setShowOther(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.mask}>
        <View style={styles.card}>
          <Text style={styles.title}>选择照片/附件用途</Text>
          <Text style={styles.hint}>合规归档需要标明用途</Text>
          {!showOther ? (
            <>
              {PHOTO_PURPOSES.map((p) => (
                <Pressable key={p.key} style={styles.row} onPress={() => pick(p.key, p.label)}>
                  <Text style={styles.rowText}>{p.label}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.cancel} onPress={onCancel}>
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="请简述用途"
                placeholderTextColor={colors.textMuted}
                value={otherNote}
                onChangeText={setOtherNote}
              />
              <View style={styles.otherActions}>
                <Pressable
                  onPress={() => {
                    setShowOther(false);
                    setOtherNote('');
                  }}
                >
                  <Text style={styles.cancelText}>返回</Text>
                </Pressable>
                <Pressable style={styles.confirm} onPress={confirmOther}>
                  <Text style={styles.confirmText}>确定</Text>
                </Pressable>
              </View>
            </>
          )}
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
    maxHeight: '80%',
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: 12 },
  row: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  rowText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  cancel: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  otherActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirm: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.button,
  },
  confirmText: { color: colors.white, fontWeight: '600' },
});
