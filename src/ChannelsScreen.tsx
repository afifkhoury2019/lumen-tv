import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Channel } from './m3u';
import { colors } from './theme';

const FAVORITES = '★ Favorites';
const ALL = 'All';

type Props = {
  channels: Channel[];
  favorites: string[];
  onToggleFavorite: (url: string) => void;
  onPlay: (channel: Channel) => void;
  onChangePlaylist: () => void;
  onRefresh: () => void;
  refreshing: boolean;
};

export function ChannelsScreen({
  channels,
  favorites,
  onToggleFavorite,
  onPlay,
  onChangePlaylist,
  onRefresh,
  refreshing,
}: Props) {
  const [group, setGroup] = useState(ALL);
  const [query, setQuery] = useState('');

  const groups = useMemo(
    () => [ALL, FAVORITES, ...Array.from(new Set(channels.map((c) => c.group))).sort()],
    [channels],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter(
      (c) =>
        (group === ALL || (group === FAVORITES ? favorites.includes(c.url) : c.group === group)) &&
        (!q || c.name.toLowerCase().includes(q)),
    );
  }, [channels, favorites, group, query]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Lumen TV</Text>
        <Pressable onPress={onChangePlaylist} hitSlop={10}>
          <Text style={styles.link}>Playlist</Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.search}
        placeholder={`Search ${channels.length} channels`}
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
      />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {groups.map((g) => (
            <Pressable key={g} onPress={() => setGroup(g)} style={[styles.chip, g === group && styles.chipOn]}>
              <Text style={[styles.chipText, g === group && { color: '#fff' }]}>{g}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        onRefresh={onRefresh}
        refreshing={refreshing}
        initialNumToRender={20}
        windowSize={10}
        ListEmptyComponent={<Text style={styles.empty}>No channels here.</Text>}
        renderItem={({ item }) => {
          const fav = favorites.includes(item.url);
          return (
            <Pressable style={styles.row} onPress={() => onPlay(item)}>
              {item.logo ? (
                <Image source={{ uri: item.logo }} style={styles.logo} resizeMode="contain" />
              ) : (
                <View style={[styles.logo, styles.logoFallback]}>
                  <Text style={styles.logoLetter}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.group} numberOfLines={1}>{item.group}</Text>
              </View>
              <Pressable onPress={() => onToggleFavorite(item.url)} hitSlop={12}>
                <Text style={[styles.star, fav && { color: colors.star }]}>{fav ? '★' : '☆'}</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  search: {
    backgroundColor: colors.surface,
    color: colors.text,
    marginHorizontal: 16,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.muted, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  logo: { width: 52, height: 40, borderRadius: 6, backgroundColor: colors.surfaceAlt },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  group: { color: colors.muted, fontSize: 12, marginTop: 2 },
  star: { color: colors.muted, fontSize: 24 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
});
