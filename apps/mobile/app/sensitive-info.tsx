import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Shield, EyeOff } from 'lucide-react-native';
import { api } from '../src/lib/api';
import { StatusBar } from '../src/components/StatusBar';
import { Card } from '../src/components/Card';
import { colors, radius, typography } from '../src/theme';

export default function SensitiveInfoScreen() {
  const { visitId, uri, name, mimeType, attachmentId } = useLocalSearchParams<{
    visitId: string;
    uri?: string;
    name?: string;
    mimeType?: string;
    attachmentId?: string;
  }>();
  const [busy, setBusy] = useState(false);

  const confirmUpload = async () => {
    if (!visitId) return;
    setBusy(true);
    try {
      if (attachmentId) {
        await api.addVisitInput(visitId, {
          type: 'IMAGE',
          content: `已确认遮挡并关联证据：${name ?? attachmentId}`,
        });
      } else if (uri && name) {
        const res = await api.uploadAttachment(visitId, {
          uri,
          name,
          mimeType: mimeType || 'image/jpeg',
        });
        await api.addVisitInput(visitId, {
          type: 'IMAGE',
          content: `已确认遮挡并上传：${res.attachment.fileName}`,
        });
      }
      router.replace(`/imv-active?visitId=${visitId}`);
    } catch (e) {
      Alert.alert('上传失败', e instanceof Error ? e.message : '请重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.title}>敏感信息确认</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Card style={styles.card}>
          <Shield size={32} color={colors.amber} style={{ alignSelf: 'center', marginBottom: 12 }} />
          <Text style={styles.heading}>检测到可能的敏感信息</Text>
          <Text style={styles.desc}>
            图片中可能包含受试者姓名、身份证号或联系方式。上传前请确认已遮挡敏感区域，或取消上传。
          </Text>
          <View style={styles.preview}>
            {uri ? (
              <Image source={{ uri }} style={styles.previewImage} blurRadius={12} />
            ) : (
              <>
                <EyeOff size={24} color={colors.textMuted} />
                <Text style={styles.previewText}>预览区域（已模糊处理）</Text>
              </>
            )}
          </View>
        </Card>

        <Pressable style={styles.primary} onPress={() => void confirmUpload()} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? '上传中…' : '确认遮挡并上传'}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>取消上传</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: typography.xl, fontWeight: '700', color: colors.text },
  body: { flex: 1, padding: 16, gap: 12 },
  card: { padding: 20 },
  heading: { fontSize: typography.lg, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: 8 },
  desc: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  preview: {
    height: 160,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
  previewText: { fontSize: 12, color: colors.textMuted },
  primary: { height: 48, backgroundColor: colors.primary, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  secondary: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.textSecondary, fontSize: typography.base },
});