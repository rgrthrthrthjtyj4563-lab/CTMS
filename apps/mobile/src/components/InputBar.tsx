import { View, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Mic, Camera, Paperclip, Send } from 'lucide-react-native';
import { colors, radius } from '../theme';

interface InputBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmit?: () => void;
  onVoice?: () => void;
  onCamera?: () => void;
  onAttach?: () => void;
  disabled?: boolean;
  submitting?: boolean;
}

/**
 * Single-layer message input bar.
 * Only the outer shell has a border; inner TextInput is borderless (including Web outline).
 */
export function InputBar({
  placeholder = '描述工作事实…',
  value = '',
  onChangeText,
  onSubmit,
  onVoice,
  onCamera,
  onAttach,
  disabled = false,
  submitting = false,
}: InputBarProps) {
  const canSend = Boolean(value.trim()) && !disabled && !submitting;

  return (
    <View style={styles.row}>
      <View style={styles.shell}>
        <TextInput
          style={[styles.input, Platform.OS === 'web' ? styles.inputWeb : null]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          multiline
          editable={!disabled && !submitting}
          onSubmitEditing={onSubmit}
          underlineColorAndroid="transparent"
        />
        <View style={styles.actions}>
          {onCamera ? (
            <Pressable onPress={onCamera} disabled={disabled || submitting} hitSlop={6}>
              <Camera
                size={17}
                color={disabled || submitting ? colors.border : colors.textMuted}
                strokeWidth={1.7}
              />
            </Pressable>
          ) : null}
          {onAttach ? (
            <Pressable onPress={onAttach} disabled={disabled || submitting} hitSlop={6}>
              <Paperclip
                size={17}
                color={disabled || submitting ? colors.border : colors.textMuted}
                strokeWidth={1.7}
              />
            </Pressable>
          ) : null}
          {onSubmit ? (
            <Pressable onPress={onSubmit} disabled={!canSend} hitSlop={6}>
              {submitting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Send size={17} color={canSend ? colors.primary : colors.border} strokeWidth={1.7} />
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
      {onVoice ? (
        <Pressable
          style={[styles.micBtn, (disabled || submitting) && styles.micDisabled]}
          onPress={onVoice}
          disabled={disabled || submitting}
        >
          <Mic size={17} color={colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  shell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F9FAFB',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    maxHeight: 96,
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  // Web-only: kill browser textarea border + focus outline
  inputWeb: {
    // @ts-expect-error RN web style
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    boxShadow: 'none',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 2,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micDisabled: { opacity: 0.5 },
});
