import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Eye } from 'lucide-react-native';
import { api, type ReviewItem } from '../src/lib/api';
import { useSession } from '../src/hooks/useSession';
import { isPm, isQa } from '../src/lib/session';
import { StatusBar } from '../src/components/StatusBar';
import { BottomNav } from '../src/components/BottomNav';
import { Tag } from '../src/components/Tag';
import { Card } from '../src/components/Card';
import { colors, typography } from '../src/theme';

export default function ReviewScreen() {
  const { user } = useSession();
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [doneCount, setDoneCount] = useState(0);

  const roleLabel = user ? (isPm(user.role) ? 'PM' : isQa(user.role) ? 'QA' : user.role) : '';
  const pageTitle = user && (isPm(user.role) || isQa(user.role)) ? '移动审核' : '移动审核';

  useFocusEffect(
    useCallback(() => {
      void api.reviewsPending().then((d) => {
        setItems(d.items);
        setDoneCount(d.doneCount);
      });
    }, []),
  );

  const decide = async (item: ReviewItem, decision: 'APPROVE' | 'RETURN') => {
    try {
      await api.reviewDecide(item.id, decision);
      Alert.alert(decision === 'APPROVE' ? '已通过' : '已退回');
      const d = await api.reviewsPending();
      setItems(d.items);
    } catch (e) {
      Alert.alert('操作失败', e instanceof Error ? e.message : '请重试');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <StatusBar />
        <View style={styles.headerTop}>
          <Text style={styles.title}>{pageTitle}</Text>
          {user && (isPm(user.role) || isQa(user.role)) && (
            <View style={styles.roleBadge}>
              <View style={styles.roleDot} />
              <Text style={styles.roleText}>{roleLabel} · {user.name}</Text>
            </View>
          )}
        </View>
        <View style={styles.tabs}>
          {([
            { k: 'pending' as const, l: '待审核', n: items.length },
            { k: 'done' as const, l: '已完成', n: doneCount },
          ]).map((t) => (
            <Pressable key={t.k} style={styles.tabBtn} onPress={() => setTab(t.k)}>
              <Text style={[styles.tabText, tab === t.k && styles.tabActive]}>
                {t.l}
                <Text style={[styles.badge, tab === t.k && styles.badgeActive]}> {t.n}</Text>
              </Text>
              {tab === t.k && <View style={styles.tabLine} />}
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {tab === 'pending' ? (
          items.map((item) => (
            <Card key={item.id}>
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View style={styles.cardMeta}>
                    <Text style={styles.code}>{item.code}</Text>
                    <Text style={styles.typeBadge}>{item.type}</Text>
                    {item.severity && <Tag status="risk" label={item.severity} />}
                  </View>
                  <Text style={styles.time}>{item.time}</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSub}>{item.project} · 提交人：{item.submitter}</Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push(`/action-pack?packId=${item.packId}&mode=review`)}
                >
                  <Eye size={12} color={colors.textSecondary} />
                  <Text style={styles.actionView}>查看详情</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => void decide(item, 'RETURN')}>
                  <Text style={styles.actionReturn}>退回</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => void decide(item, 'APPROVE')}>
                  <Text style={styles.actionApprove}>通过</Text>
                </Pressable>
              </View>
            </Card>
          ))
        ) : (
          <Text style={styles.empty}>已完成 {doneCount} 条审核记录</Text>
        )}
        {tab === 'pending' && items.length === 0 && (
          <Text style={styles.empty}>暂无待审核项</Text>
        )}
      </ScrollView>
      <BottomNav active="workbench" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  title: { fontSize: typography.xxl, fontWeight: '700', color: colors.text },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  roleText: { fontSize: 11.5, color: '#4B5563', fontWeight: '500' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  tabBtn: { paddingHorizontal: 16, paddingBottom: 10 },
  tabText: { fontSize: typography.base, fontWeight: '600', color: colors.textMuted },
  tabActive: { color: colors.primary },
  badge: { fontSize: 11, backgroundColor: '#F3F4F6', color: colors.textSecondary, paddingHorizontal: 6, borderRadius: 10 },
  badgeActive: { backgroundColor: colors.primaryLight, color: colors.primary },
  tabLine: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, backgroundColor: colors.primary },
  list: { flex: 1 },
  cardBody: { padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
  typeBadge: { fontSize: 11, backgroundColor: '#F3F4F6', color: '#4B5563', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: '500' },
  time: { fontSize: typography.xs, color: colors.textMuted },
  cardTitle: { fontSize: typography.base, fontWeight: '600', color: colors.text },
  cardSub: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#FAFAFA' },
  actionBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderRightWidth: 1, borderRightColor: '#FAFAFA' },
  actionView: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '500' },
  actionReturn: { fontSize: 12.5, color: colors.red, fontWeight: '500' },
  actionApprove: { fontSize: 12.5, color: '#047857', fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.textMuted, padding: 40, fontSize: typography.base },
});