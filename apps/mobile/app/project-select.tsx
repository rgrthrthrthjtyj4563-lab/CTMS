import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Check, Building2 } from 'lucide-react-native';
import { api } from '../src/lib/api';
import { loadUser, saveSession, loadToken } from '../src/lib/session';
import { StatusBar } from '../src/components/StatusBar';
import { Card } from '../src/components/Card';
import { colors, radius, typography } from '../src/theme';

export default function ProjectSelectScreen() {
  const [projects, setProjects] = useState<
    Array<{ id: string; code: string; name: string; sites: Array<{ id: string; code: string; name: string }> }>
  >([]);
  const [selected, setSelected] = useState<{ projectId: string; siteId?: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      void api.projects().then((d) => setProjects(d.projects));
      void loadUser().then((u) => {
        if (u?.projectId) setSelected({ projectId: u.projectId, siteId: u.siteId });
      });
    }, []),
  );

  const confirm = async () => {
    if (!selected) return;
    const res = await api.updateContext(selected.projectId, selected.siteId);
    const user = await loadUser();
    const token = await loadToken();
    if (user && token) {
      const project = projects.find((p) => p.id === selected.projectId);
      const site = project?.sites.find((s) => s.id === selected.siteId);
      const ctx = res.context;
      await saveSession({
        token,
        user: {
          ...user,
          projectId: ctx.projectId ?? selected.projectId,
          projectCode: ctx.projectCode ?? project?.code,
          projectName: ctx.projectName ?? project?.name,
          siteId: ctx.siteId ?? selected.siteId,
          siteName: ctx.siteName ?? site?.name,
          siteCode: ctx.siteCode ?? site?.code,
        },
      });
    }
    router.back();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()}>
            <ChevronLeft size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.title}>选择项目 / 中心</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={styles.hint}>切换前请确认当前草稿已保存</Text>
        {projects.map((p) => (
          <Card key={p.id}>
            <Pressable
              style={styles.projectRow}
              onPress={() => setSelected({ projectId: p.id, siteId: p.sites[0]?.id })}
            >
              <Building2 size={16} color={colors.primary} />
              <View style={styles.projectBody}>
                <Text style={styles.projectCode}>{p.code}</Text>
                <Text style={styles.projectName}>{p.name}</Text>
              </View>
              {selected?.projectId === p.id && !selected.siteId && (
                <Check size={18} color={colors.primary} />
              )}
            </Pressable>
            {p.sites.map((s) => (
              <Pressable
                key={s.id}
                style={styles.siteRow}
                onPress={() => setSelected({ projectId: p.id, siteId: s.id })}
              >
                <Text style={styles.siteText}>{s.name} · {s.code}</Text>
                {selected?.projectId === p.id && selected.siteId === s.id && (
                  <Check size={16} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </Card>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.btn} onPress={() => void confirm()}>
          <Text style={styles.btnText}>确认切换</Text>
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
  hint: { fontSize: 12, color: colors.amber, marginBottom: 4 },
  projectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  projectBody: { flex: 1 },
  projectCode: { fontSize: typography.base, fontWeight: '600', color: colors.text },
  projectName: { fontSize: 11, color: colors.textSecondary },
  siteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, paddingLeft: 42 },
  siteText: { fontSize: typography.base, color: '#374151' },
  footer: { padding: 16, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.borderLight },
  btn: { height: 48, backgroundColor: colors.primary, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '600' },
});