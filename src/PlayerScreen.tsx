import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import type { Channel } from './m3u';
import { themed, useTheme } from './theme';

type Props = {
  channel: Channel;
  /** The list the channel came from, for previous / next. */
  queue: Channel[];
  onChange: (channel: Channel) => void;
  onClose: () => void;
};

const toSource = (c: Channel, url = c.url): VideoSource => ({
  uri: url,
  headers: c.headers,
  contentType: c.kind === 'live' && url.endsWith('.ts') ? 'progressive' : 'auto',
  metadata: { title: c.name, artist: c.group },
});

export function PlayerScreen({ channel, queue, onChange, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const player = useVideoPlayer(toSource(channel), (p) => {
    p.play();
  });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  const usedFallback = useRef(false);
  const first = useRef(true);
  const [attempt, setAttempt] = useState(0);

  // Switch streams in place when the channel changes (prev / next).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    usedFallback.current = false;
    player.replaceAsync(toSource(channel)).then(() => player.play());
  }, [channel, player]);

  // If the main URL fails, try the alternative format once (e.g. .ts instead of .m3u8).
  useEffect(() => {
    if (status === 'error' && channel.fallbackUrl && !usedFallback.current) {
      usedFallback.current = true;
      player.replaceAsync(toSource(channel, channel.fallbackUrl)).then(() => player.play());
    }
  }, [status, channel, player]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const index = queue.findIndex((c) => c.id === channel.id);
  const prev = index > 0 ? queue[index - 1] : null;
  const next = index >= 0 && index < queue.length - 1 ? queue[index + 1] : null;

  const retry = () => {
    usedFallback.current = false;
    player.replaceAsync(toSource(channel)).then(() => player.play());
    setAttempt((a) => a + 1);
  };

  const showingError = status === 'error' && (usedFallback.current || !channel.fallbackUrl);

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        {channel.kind === 'live' && <Text style={styles.live}>● LIVE</Text>}
      </View>

      <View style={styles.videoBox}>
        <VideoView
          key={attempt}
          style={StyleSheet.absoluteFill}
          player={player}
          nativeControls
          contentFit="contain"
          fullscreenOptions={{ enable: true, orientation: 'landscape' }}
          allowsPictureInPicture
          startsPictureInPictureAutomatically={channel.kind === 'live'}
        />
        {status === 'loading' && <ActivityIndicator style={styles.overlay} size="large" color="#fff" />}
        {showingError && (
          <View style={[styles.overlay, styles.errorBox]}>
            <Text style={styles.err}>Can't play this right now.</Text>
            {error?.message ? <Text style={styles.errDetail} numberOfLines={3}>{error.message}</Text> : null}
            <Pressable style={styles.retry} onPress={retry}>
              <Text style={{ color: colors.onAccent, fontWeight: '700' }}>Try again</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.info}>
        {channel.logo ? <Image source={{ uri: channel.logo }} style={styles.logo} resizeMode="contain" /> : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{channel.name}</Text>
          <Text style={styles.group} numberOfLines={1}>{channel.group}</Text>
        </View>
      </View>

      {queue.length > 1 && (
        <View style={styles.nav}>
          <NavButton label="‹  Previous" sub={prev?.name} disabled={!prev} onPress={() => prev && onChange(prev)} />
          <NavButton label="Next  ›" sub={next?.name} disabled={!next} onPress={() => next && onChange(next)} />
        </View>
      )}
      <Text style={styles.tip}>Tip: rotate or tap full screen in the player for landscape.</Text>
    </View>
  );
}

function NavButton({ label, sub, disabled, onPress }: { label: string; sub?: string; disabled: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.navBtn, disabled && { opacity: 0.35 }]} disabled={disabled} onPress={onPress}>
      <Text style={styles.navLabel}>{label}</Text>
      {sub ? <Text style={styles.navSub} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
}

const useStyles = themed((colors) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  live: { color: colors.danger, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  videoBox: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  errorBox: { backgroundColor: 'rgba(0,0,0,0.75)', gap: 8, padding: 16 },
  err: { color: colors.text, fontSize: 16, fontWeight: '700' },
  errDetail: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  retry: { backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 6 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  logo: { width: 64, height: 48, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  group: { color: colors.muted, marginTop: 4 },
  nav: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  navBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 4 },
  navLabel: { color: colors.text, fontWeight: '700', fontSize: 15 },
  navSub: { color: colors.muted, fontSize: 12 },
  tip: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 18 },
}));
