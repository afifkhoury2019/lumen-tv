import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Channel } from './m3u';
import { colors } from './theme';
import { getEpisodes, type Season, type XtreamLogin } from './xtream';

type Props = { login: XtreamLogin; series: Channel; onBack: () => void; onPlay: (ep: Channel, season: Channel[]) => void };

export function SeriesScreen({ login, series, onBack, onPlay }: Props) {
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let alive = true;
    getEpisodes(login, series)
      .then((s) => alive && setSeasons(s))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [login, series]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const episodes = seasons?.[active]?.episodes ?? [];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
      </View>
      <View style={styles.hero}>
        {series.logo ? <Image source={{ uri: series.logo }} style={styles.cover} /> : <View style={styles.cover} />}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.title} numberOfLines={3}>{series.name}</Text>
          <Text style={styles.muted}>{series.group}</Text>
          {seasons ? <Text style={styles.muted}>{seasons.length} season{seasons.length === 1 ? '' : 's'}</Text> : null}
        </View>
      </View>

      {!seasons && !error && <ActivityIndicator style={{ marginTop: 30 }} size="large" color={colors.accent} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {seasons && seasons.length === 0 && <Text style={[styles.muted, { padding: 16 }]}>No episodes available.</Text>}

      {seasons && seasons.length > 0 && (
        <>
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {seasons.map((s, i) => (
                <Pressable key={s.season} onPress={() => setActive(i)} style={[styles.chip, i === active && styles.chipOn]}>
                  <Text style={[styles.chipText, i === active && { color: '#fff' }]}>Season {s.season}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <FlatList
            data={episodes}
            keyExtractor={(e) => e.id}
            renderItem={({ item, index }) => (
              <Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]} onPress={() => onPlay(item, episodes)}>
                <Text style={styles.num}>{index + 1}</Text>
                <Text style={styles.epName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.play}>▶</Text>
              </Pressable>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { padding: 16, paddingBottom: 4 },
  back: { color: colors.accent, fontSize: 17, fontWeight: '600' },
  hero: { flexDirection: 'row', gap: 16, padding: 16 },
  cover: { width: 110, height: 165, borderRadius: 10, backgroundColor: colors.surfaceAlt },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, padding: 16 },
  chips: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: { backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.muted, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  num: { color: colors.muted, width: 24, fontWeight: '700' },
  epName: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '600' },
  play: { color: colors.accent, fontSize: 16 },
});
