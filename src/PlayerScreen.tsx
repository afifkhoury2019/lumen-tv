import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { catchupItem, clock, dayLabel, getGuide, type Programme } from './epg';
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
  contentType: /\.ts$|timeshift\.php/.test(url) ? 'progressive' : 'auto',
  metadata: { title: c.name, artist: c.group },
});

export function PlayerScreen({ channel, queue, onChange, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [replay, setReplay] = useState<{ item: Channel; programme: Programme } | null>(null);
  const current = replay?.item ?? channel;
  useEffect(() => setReplay(null), [channel]);
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
    player.replaceAsync(toSource(current)).then(() => player.play());
  }, [current, player]);

  // If the main URL fails, try the alternative format once (e.g. .ts instead of .m3u8).
  useEffect(() => {
    if (status === 'error' && current.fallbackUrl && !usedFallback.current) {
      usedFallback.current = true;
      player.replaceAsync(toSource(current, current.fallbackUrl)).then(() => player.play());
    }
  }, [status, current, player]);

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
    player.replaceAsync(toSource(current)).then(() => player.play());
    setAttempt((a) => a + 1);
  };

  const showingError = status === 'error' && (usedFallback.current || !current.fallbackUrl);

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        {replay ? (
          <Pressable onPress={() => setReplay(null)} hitSlop={10}>
            <Text style={styles.toLive}>● Back to live</Text>
          </Pressable>
        ) : (
          channel.kind === 'live' && <Text style={styles.live}>● LIVE</Text>
        )}
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
          startsPictureInPictureAutomatically={current.kind === 'live'}
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
          <Text style={styles.title} numberOfLines={2}>{replay ? replay.programme.title : channel.name}</Text>
          <Text style={styles.group} numberOfLines={1}>
            {replay
              ? `⏪ Catch-up · ${channel.name} · ${dayLabel(replay.programme.start)} ${clock(replay.programme.start)}`
              : channel.group}
          </Text>
        </View>
      </View>

      {index >= 0 && queue.length > 1 && (
        <View style={styles.nav}>
          <NavButton label="‹  Previous" sub={prev?.name} disabled={!prev} onPress={() => prev && onChange(prev)} />
          <NavButton label="Next  ›" sub={next?.name} disabled={!next} onPress={() => next && onChange(next)} />
        </View>
      )}
      {channel.streamId ? (
        <Guide
          channel={channel}
          playingStart={replay?.programme.start ?? null}
          onReplay={(p) => {
            const item = catchupItem(channel, p);
            if (item) setReplay({ item, programme: p });
          }}
          onLive={() => setReplay(null)}
        />
      ) : (
        <Text style={styles.tip}>Tip: rotate or tap full screen in the player for landscape.</Text>
      )}
    </View>
  );
}

const ROW = 64;

/** The channel's programme guide: past (replayable), now, and upcoming. */
function Guide({
  channel,
  playingStart,
  onReplay,
  onLive,
}: {
  channel: Channel;
  playingStart: number | null;
  onReplay: (p: Programme) => void;
  onLive: () => void;
}) {
  const styles = useStyles();
  const [items, setItems] = useState<Programme[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setFailed(false);
    getGuide(channel)
      .then((all) => {
        const t = Date.now() / 1000;
        const from = t - Math.max(channel.archiveDays ?? 0, 0.25) * 86400;
        if (alive) setItems(all.filter((p) => p.stop > from && p.start < t + 86400));
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [channel]);

  const t = Date.now() / 1000;
  const days = channel.archiveDays ?? 0;
  const nowIndex = items ? items.findIndex((p) => p.start <= t && t < p.stop) : -1;
  const canReplay = (p: Programme) => p.stop <= t && (p.hasArchive || (days > 0 && p.start > t - days * 86400));

  if (failed) return <Text style={styles.guideEmpty}>The TV guide is not available right now.</Text>;
  if (!items) return <ActivityIndicator style={{ marginTop: 24 }} />;
  if (!items.length) return <Text style={styles.guideEmpty}>No TV guide for this channel.</Text>;

  return (
    <View style={{ flex: 1, marginTop: 14 }}>
      <Text style={styles.guideTitle}>TV guide{days ? `  ·  ⏪ ${days}-day catch-up` : ''}</Text>
      <FlatList
        data={items}
        keyExtractor={(p) => p.id + '-' + p.start}
        getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
        initialScrollIndex={Math.max(0, nowIndex - 1)}
        renderItem={({ item: p, index: i }) => {
          const isNow = i === nowIndex;
          const replayable = canReplay(p);
          const playing = playingStart === p.start;
          const future = p.start > t;
          return (
            <Pressable
              style={[styles.prog, isNow && styles.progNow, playing && styles.progPlaying]}
              disabled={!(replayable || isNow)}
              onPress={() => (isNow ? onLive() : onReplay(p))}
            >
              <View style={styles.progTime}>
                <Text style={styles.progClock}>{clock(p.start)}</Text>
                <Text style={styles.progDay}>{dayLabel(p.start)}</Text>
              </View>
              <Text style={[styles.progTitle, !isNow && !replayable && !future && { opacity: 0.45 }]} numberOfLines={2}>
                {p.title}
              </Text>
              {isNow ? (
                <Text style={styles.badgeNow}>NOW</Text>
              ) : replayable ? (
                <Text style={styles.badgeReplay}>{playing ? '▶ Playing' : '⏪ Replay'}</Text>
              ) : null}
            </Pressable>
          );
        }}
      />
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
  toLive: { color: colors.accent, fontWeight: '800', fontSize: 13 },
  guideTitle: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 6 },
  guideEmpty: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 24 },
  prog: { height: ROW, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  progNow: { backgroundColor: colors.accentSoft, borderLeftColor: colors.accent },
  progPlaying: { backgroundColor: colors.surface, borderLeftColor: colors.accent },
  progTime: { width: 64 },
  progClock: { color: colors.text, fontSize: 15, fontWeight: '700' },
  progDay: { color: colors.muted, fontSize: 10 },
  progTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  badgeNow: { color: colors.onAccent, backgroundColor: colors.accent, fontSize: 10, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  badgeReplay: { color: colors.accent, fontSize: 12, fontWeight: '800' },
}));
