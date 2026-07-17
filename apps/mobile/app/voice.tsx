import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Alert, Platform, Animated } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { X, Trash2, Square, Loader2, Check, Shield, RefreshCw } from 'lucide-react-native';
import { api } from '../src/lib/api';
import { startVoiceRecording } from '../src/lib/media';
import { StatusBar } from '../src/components/StatusBar';
import { colors, radius } from '../src/theme';

export default function VoiceScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const [phase, setPhase] = useState<'rec' | 'done'>('rec');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | undefined>(undefined);
  const recorderRef = useRef<Awaited<ReturnType<typeof startVoiceRecording>>>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visitId) {
      Alert.alert('无法录音', '请先选择或开始今日 IMV 后再使用语音录入', [
        { text: '返回', onPress: () => router.back() },
      ]);
      return;
    }

    if (Platform.OS === 'web') {
      Alert.alert(
        '浏览器录音说明',
        '当前浏览器录音能力有限，可先手动输入；真机 App 环境支持语音转写。转写失败时可直接编辑文字后发送。',
      );
    }

    void (async () => {
      recorderRef.current = await startVoiceRecording();
      if (!recorderRef.current) {
        Alert.alert('需要麦克风权限', '请在系统设置中允许录音');
        router.back();
        return;
      }
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    })();

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      anim.stop();
    };
  }, [visitId, pulse]);

  const discard = () => {
    void recorderRef.current?.stop().catch(() => undefined);
    router.back();
  };

  const transcribeRecording = async (uri: string, blob?: Blob) => {
    setBusy(true);
    setTranscribeError(null);
    try {
      const result = await api.transcribeVoice({
        uri,
        name: blob?.type?.includes('webm') ? 'recording.webm' : 'recording.m4a',
        mimeType: blob?.type || (blob ? 'audio/webm' : 'audio/m4a'),
        blob,
      });
      setTranscript(result.transcript);
      setPhase('done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '转写失败';
      setTranscribeError(msg);
      setPhase('done');
      setTranscript('');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!recorderRef.current || busy) return;
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      const stopped = await recorderRef.current.stop();
      recorderRef.current = null;
      setRecordingUri(stopped.uri);
      setRecordingBlob(stopped.blob);
      await transcribeRecording(stopped.uri, stopped.blob);
    } catch (e) {
      Alert.alert('录音失败', e instanceof Error ? e.message : '请重试');
    }
  };

  const retryTranscribe = async () => {
    if (!recordingUri) {
      Alert.alert('无法重试', '录音已丢失，请重新录制');
      setPhase('rec');
      setSeconds(0);
      recorderRef.current = await startVoiceRecording();
      if (recorderRef.current) {
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      }
      return;
    }
    await transcribeRecording(recordingUri, recordingBlob);
  };

  const confirmSend = async () => {
    if (!visitId) {
      Alert.alert('无法发送', '缺少访视上下文');
      return;
    }
    const text = transcript.trim();
    if (!text) {
      Alert.alert('请确认转写内容', '转写为空时请手动补充后再发送');
      return;
    }
    setBusy(true);
    try {
      await api.addVisitInput(visitId, {
        type: 'VOICE',
        content: text,
        transcript: text,
      });
      // Return with flash flag so IMV page shows "素材已加入 / 待 AI 整理"
      router.replace({
        pathname: '/imv-active',
        params: { visitId, voiceDone: '1' },
      });
    } catch (e) {
      Alert.alert('发送失败', e instanceof Error ? e.message : '请重试');
    } finally {
      setBusy(false);
    }
  };

  if (!visitId) {
    return (
      <View style={[styles.screen, styles.blocked]}>
        <Text style={styles.blockedText}>缺少访视上下文，无法录音</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar dark />
      <View style={styles.nav}>
        <Pressable onPress={discard}>
          <X size={21} color="rgba(255,255,255,0.6)" />
        </Pressable>
        <Text style={styles.navTitle}>语音录入</Text>
        <Text style={styles.navHelp}> </Text>
      </View>

      {Platform.OS === 'web' && (
        <View style={styles.webNote}>
          <Text style={styles.webNoteText}>
            当前浏览器录音能力有限，可先手动输入；真机环境支持语音转写
          </Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.center}>
          {phase === 'rec' ? (
            <>
              <Animated.View style={[styles.recIndicator, { transform: [{ scale: pulse }] }]}>
                <View style={styles.recInner} />
              </Animated.View>
              <Text style={styles.timer}>
                {`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`}
              </Text>
              <Text style={styles.recLabel}>{busy ? '转写中…' : '正在录音…'}</Text>
            </>
          ) : (
            <>
              <View style={styles.doneIcon}>
                <Check size={30} color={colors.white} strokeWidth={2.5} />
              </View>
              <Text style={styles.doneText}>{transcribeError ? '转写未完成' : '录音完成'}</Text>
            </>
          )}
        </View>

        <View style={styles.transcript}>
          <View style={styles.transcriptHead}>
            {phase === 'rec' && <View style={styles.recDot} />}
            <Text style={styles.transcriptLabel}>
              {phase === 'rec' ? '录音中' : '转写结果（可编辑）'}
            </Text>
          </View>
          {phase === 'rec' ? (
            <Text style={styles.transcriptText}>停止录音后将进行转写，您可编辑并确认后发送。</Text>
          ) : (
            <>
              {transcribeError && (
                <Text style={styles.errorText}>{transcribeError}</Text>
              )}
              <TextInput
                multiline
                value={transcript}
                onChangeText={setTranscript}
                style={styles.transcriptInput}
                placeholder="请手动填写或编辑转写内容…"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />
            </>
          )}
          {phase === 'done' && /受试者|\d{2,}号/.test(transcript) && (
            <View style={styles.privacy}>
              <Shield size={11} color="#FCD34D" />
              <Text style={styles.privacyText}>识别到受试者编号，发送前将自动脱敏处理</Text>
            </View>
          )}
        </View>

        {phase === 'rec' ? (
          <View style={styles.controls}>
            <Pressable style={styles.sideBtn} onPress={discard}>
              <Trash2 size={18} color="rgba(255,255,255,0.6)" />
            </Pressable>
            <Pressable style={styles.stopBtn} onPress={() => void finish()} disabled={busy}>
              {busy ? (
                <Loader2 size={18} color={colors.white} />
              ) : (
                <Square size={20} color={colors.white} fill={colors.white} />
              )}
            </Pressable>
            <View style={styles.sideBtn} />
          </View>
        ) : (
          <View style={styles.doneActions}>
            {transcribeError && recordingUri && (
              <Pressable style={styles.retryBtn} onPress={() => void retryTranscribe()} disabled={busy}>
                <RefreshCw size={14} color={colors.white} />
                <Text style={styles.retryBtnText}>重试转写</Text>
              </Pressable>
            )}
            <Pressable style={styles.sendBtn} onPress={() => void confirmSend()} disabled={busy}>
              <Text style={styles.sendText}>确认转写并发送 →</Text>
            </Pressable>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.retryText}>取消</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  blocked: { alignItems: 'center', justifyContent: 'center' },
  blockedText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4 },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 13.5, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  navHelp: { fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: 4 },
  webNote: { backgroundColor: 'rgba(251,191,36,0.15)', paddingHorizontal: 16, paddingVertical: 8 },
  webNoteText: { fontSize: 11, color: '#FCD34D', textAlign: 'center' },
  body: { flex: 1, paddingHorizontal: 24, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  recIndicator: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  recInner: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444' },
  timer: { fontSize: 34, fontWeight: '700', color: colors.white, fontVariant: ['tabular-nums'] },
  recLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  doneText: { fontSize: 15, fontWeight: '600', color: colors.white },
  transcript: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  transcriptHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  recDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  transcriptLabel: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  transcriptText: { fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 22 },
  errorText: { fontSize: 12, color: '#FCA5A5', marginBottom: 8 },
  transcriptInput: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  privacyText: { fontSize: 11, color: '#FCD34D', flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32 },
  sideBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stopBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneActions: { alignItems: 'center', gap: 12, width: '100%' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.card,
    justifyContent: 'center',
  },
  retryBtnText: { color: colors.white, fontSize: 14, fontWeight: '500' },
  sendBtn: {
    width: '100%',
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 15, fontWeight: '600', color: colors.white },
  retryText: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
});