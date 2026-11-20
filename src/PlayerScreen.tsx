import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { Channel } from './m3u';
import { colors } from './theme';

type Props = { channel: Channel; onClose: () => void };

export function PlayerScreen({ channel, onClose }: Props) {
  const player = useVideoPlayer({ uri: channel.url, headers: channel.headers }, (p) => {
    p.play();
  });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const retry = () => {
    player.replace({ uri: channel.url, headers: channel.headers });
    player.play();
    setRetryKey((k) => k + 1);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{channel.name}</Text>
      </View>
      <View style={styles.videoBox}>
        <VideoView
          key={retryKey}
          style={StyleSheet.absoluteFill}
          player={player}
          nativeControls
          contentFit="contain"
          fullscreenOptions={{ enable: true, orientation: 'landscape' }}
          allowsPictureInPicture
        />
        {status === 'loading' && <ActivityIndicator style={styles.center} size="large" color="#fff" />}
        {status === 'error' && (
          <View style={styles.center}>
            <Text style={styles.err}>Can't play this channel.</Text>
            {error?.message ? <Text style={styles.errDetail}>{error.message}</Text> : null}
            <Pressable style={styles.retry} onPress={retry}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </View>
        )}
      </View>
      <Text style={styles.group}>{channel.group}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  back: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 },
  videoBox: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', justifyContent: 'center' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  err: { color: colors.text, fontSize: 16, fontWeight: '700' },
  errDetail: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  retry: { backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 6 },
  group: { color: colors.muted, padding: 16 },
});
