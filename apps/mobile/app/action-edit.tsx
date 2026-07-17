import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ChevronLeft, Info } from 'lucide-react-native';
import { api, type ActionItem } from '../src/lib/api';
import { StatusBar } from '../src/components/StatusBar';
import { Tag } from '../src/components/Tag';
import { Card } from '../src/components/Card';
import { colors, radius, typography } from '../src/theme';

const SEVERITY_LABEL: Record<string, string> = {
  HIGH: '主要',
  MEDIUM: '次要',
  LOW: '轻微',
  CRITICAL: '严重',
};

export default function ActionEditScreen() {
  const { itemId, packId } = useLocalSearchParams<{ itemId: string; packId: string }>();
  const [item, setItem] = useState<ActionItem | null>(null);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('主要');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!packId || !itemId) return;
      setLoading(true);
      void api
        .actionPack(packId)
        .then((d) => {
          const found = d.items.find((i) => i.id === itemId) ?? null;
          setItem(found);
          if (found) {
            setDescription(found.description ?? String(found.data?.description ?? ''));
            const sev = String(found.data?.severity ?? 'HIGH');
            setSeverity(SEVERITY_LABEL[sev] ?? '主要');
          }
        })
        .finally(() => setLoading(false));
    }, [packId, itemId]),
  );

  const save = async () => {
    if (!itemId || !packId) return;
    await api.updateActionItem(packId, itemId, {
      description,
      severity: severity === '主要' ? 'HIGH' : severity === '次要' ? 'MEDIUM' : 'LOW',
    });
    router.push(`/action-pack?packId=${packId}`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>动作项不存在</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>返回</Text>
        </Pressable>
      </View>
    );
  }

  const itemData = item.data ?? {};

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={22} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.headerTitle}>
            <Text style={styles.h2}>编辑 {item.type} 草稿</Text>
            <Text style={styles.h2sub}>AI 生成 · 修改后确认写入</Text>
          </View>
          <Tag status="draft" label="草稿" />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={styles.source}>
          <Info size={12} color={colors.primary} />
          <Text style={styles.sourceText}>来源：本次访视输入 · {item.title}</Text>
        </View>

        <Card>
          <View style={styles.field}>
            <Text style={styles.label}>类型</Text>
            <Text style={styles.selectValue}>{item.type}</Text>
          </View>
          {item.type === 'ISSUE' && (
            <View style={[styles.field, styles.fieldBorder]}>
              <Text style={styles.label}>严重程度</Text>
              <View style={styles.severityRow}>
                {['主要', '次要', '轻微'].map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.severityBtn, severity === s && styles.severityActive]}
                    onPress={() => setSeverity(s)}
                  >
                    <Text style={[styles.severityText, severity === s && styles.severityTextActive]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <View style={[styles.field, styles.fieldBorder]}>
            <Text style={styles.label}>描述</Text>
            <TextInput
              style={styles.textarea}
              multiline
              value={description}
              onChangeText={setDescription}
            />
          </View>
          {item.type === 'ISSUE' && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>负责人</Text>
                <Text style={styles.selectValue}>
                  {String(itemData.responsiblePerson ?? '未指定')}
                </Text>
              </View>
              <View style={[styles.field, styles.fieldBorder]}>
                <Text style={styles.label}>关闭截止</Text>
                <Text style={styles.selectValue}>
                  {itemData.targetDate ? String(itemData.targetDate).split('T')[0] : '未指定'}
                </Text>
              </View>
            </>
          )}
        </Card>

        <Card>
          <View style={styles.evidenceHead}>
            <Text style={styles.evidenceTitle}>关联证据</Text>
            <Tag status="draft" label="暂未开放" />
          </View>
          <Text style={styles.noEvidence}>证据关联功能暂未开放，请在访视中上传附件</Text>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>取消</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={() => void save()}>
          <Text style={styles.saveText}>保存并返回</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.red },
  backLink: { color: colors.primary, marginTop: 8 },
  header: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { flex: 1 },
  h2: { fontSize: typography.xl, fontWeight: '700', color: colors.text },
  h2sub: { fontSize: 11, color: colors.textSecondary },
  scroll: { flex: 1 },
  source: { flexDirection: 'row', gap: 8, backgroundColor: colors.primaryLight, borderRadius: radius.button, borderWidth: 1, borderColor: `${colors.primary}33`, padding: 12 },
  sourceText: { flex: 1, fontSize: 11.5, color: colors.primary, lineHeight: 18 },
  field: { paddingHorizontal: 16, paddingVertical: 12 },
  fieldBorder: { borderTopWidth: 1, borderTopColor: '#FAFAFA' },
  label: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 6 },
  selectValue: { fontSize: typography.md, color: colors.text },
  severityRow: { flexDirection: 'row', gap: 8 },
  severityBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: colors.border },
  severityActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  severityText: { fontSize: typography.md, color: colors.text },
  severityTextActive: { color: colors.primary, fontWeight: '600' },
  textarea: { backgroundColor: '#F9FAFB', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 12, fontSize: 13.5, color: colors.text, minHeight: 100, textAlignVertical: 'top' },
  evidenceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  evidenceTitle: { fontSize: 11.5, fontWeight: '600', color: '#4B5563', textTransform: 'uppercase' },
  noEvidence: { padding: 16, fontSize: 12, color: colors.textMuted },
  footer: { flexDirection: 'row', gap: 8, padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.borderLight },
  cancelBtn: { flex: 1, height: 44, backgroundColor: '#F3F4F6', borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: typography.md, color: '#374151', fontWeight: '500' },
  saveBtn: { flex: 2, height: 44, backgroundColor: colors.primary, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: typography.md, color: colors.white, fontWeight: '600' },
});