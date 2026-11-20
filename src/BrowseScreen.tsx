import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Channel } from './m3u';
import { themed, useTheme } from './theme';

const ALL = 'All';
const FAVORITES = '★ Favorites';
const RECENT = '🕘 Recent';

type Props = {
  title: string;
  items: Channel[] | null;
  error?: string | null;
  layout: 'list' | 'grid';
  favorites: string[];
  recents?: string[];
  onToggleFavorite: (id: string) => void;
  onOpen: (item: Channel) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

export function BrowseScreen({
  title,
  items,
  error,
  layout,
  favorites,
  recents = [],
  onToggleFavorite,
  onOpen,
  onRefresh,
  refreshing,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [group, setGroup] = useState(ALL);
  const [query, setQuery] = useState('');
  const { width } = useWindowDimensions();
  const columns = Math.max(3, Math.floor(width / 130));

  const list = items ?? [];
  const recentItems = useMemo(() => {
    const byId = new Map(list.map((c) => [c.id, c]));
    return recents.map((id) => byId.get(id)).filter((c): c is Channel => !!c);
  }, [list, recents]);

  const groups = useMemo(() => {
    const cats = Array.from(new Set(list.map((c) => c.group)));
    return [ALL, FAVORITES, ...(recentItems.length ? [RECENT] : []), ...cats];
  }, [list, recentItems.length]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source =
      group === RECENT
        ? recentItems
        : group === FAVORITES
          ? list.filter((c) => favorites.includes(c.id))
          : group === ALL
            ? list
            : list.filter((c) => c.group === group);
    return q ? source.filter((c) => c.name.toLowerCase().includes(q)) : source;
  }, [list, recentItems, favorites, group, query]);

  if (items === null && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>Loading {title.toLowerCase()}…</Text>
      </View>
    );
  }

  const tileWidth = (width - 16 * 2 - 10 * (columns - 1)) / columns;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>{list.length.toLocaleString()}</Text>
      </View>
      <TextInput
        style={styles.search}
        placeholder={`Search ${title.toLowerCase()}`}
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        clearButtonMode="while-editing"
      />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {groups.map((g) => (
            <Pressable key={g} onPress={() => setGroup(g)} style={[styles.chip, g === group && styles.chipOn]}>
              <Text style={[styles.chipText, g === group && { color: colors.onAccent }]} numberOfLines={1}>
                {g}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        key={layout === 'grid' ? `grid-${columns}` : 'list'}
        data={visible}
        keyExtractor={(c) => c.id}
        numColumns={layout === 'grid' ? columns : 1}
        columnWrapperStyle={layout === 'grid' ? { gap: 10, paddingHorizontal: 16 } : undefined}
        contentContainerStyle={{ paddingBottom: 16, gap: layout === 'grid' ? 14 : 0 }}
        onRefresh={onRefresh}
        refreshing={refreshing}
        initialNumToRender={24}
        windowSize={9}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 40 }]}>
            {group === FAVORITES ? 'Tap ☆ to add favorites.' : 'Nothing here.'}
          </Text>
        }
        renderItem={({ item }) => {
          const fav = favorites.includes(item.id);
          return layout === 'grid' ? (
            <Poster item={item} width={tileWidth} fav={fav} onPress={() => onOpen(item)} onFav={() => onToggleFavorite(item.id)} />
          ) : (
            <Row item={item} fav={fav} onPress={() => onOpen(item)} onFav={() => onToggleFavorite(item.id)} />
          );
        }}
      />
    </View>
  );
}

type ItemProps = { item: Channel; fav: boolean; onPress: () => void; onFav: () => void };

function Row({ item, fav, onPress, onFav }: ItemProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]} onPress={onPress}>
      {item.logo ? (
        <Image source={{ uri: item.logo }} style={styles.logo} resizeMode="contain" />
      ) : (
        <View style={[styles.logo, styles.logoFallback]}>
          <Text style={styles.logoLetter}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.muted} numberOfLines={1}>{item.group}</Text>
      </View>
      <Pressable onPress={onFav} hitSlop={12}>
        <Text style={[styles.star, fav && { color: colors.star }]}>{fav ? '★' : '☆'}</Text>
      </Pressable>
    </Pressable>
  );
}

function Poster({ item, width, fav, onPress, onFav }: ItemProps & { width: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={{ width }} onPress={onPress}>
      <View style={[styles.poster, { width, height: width * 1.5 }]}>
        {item.logo ? (
          <Image source={{ uri: item.logo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Text style={styles.posterLetter}>{item.name.charAt(0).toUpperCase()}</Text>
        )}
        <Pressable onPress={onFav} hitSlop={8} style={styles.posterStar}>
          <Text style={{ color: fav ? colors.star : '#fff', fontSize: 18 }}>{fav ? '★' : '☆'}</Text>
        </Pressable>
        {item.rating && Number(item.rating) > 0 ? (
          <View style={styles.rating}>
            <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.posterName} numberOfLines={2}>{item.name}</Text>
    </Pressable>
  );
}

const useStyles = themed((colors) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  count: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  search: {
    backgroundColor: colors.surface,
    color: colors.text,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, maxWidth: 220 },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.muted, fontWeight: '600' },
  error: { color: colors.danger, paddingHorizontal: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  logo: { width: 56, height: 42, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 2 },
  muted: { color: colors.muted, fontSize: 12 },
  star: { color: colors.muted, fontSize: 24 },
  poster: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterLetter: { color: colors.muted, fontSize: 32, fontWeight: '800' },
  posterStar: { position: 'absolute', top: 4, right: 6 },
  rating: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ratingText: { color: colors.star, fontSize: 11, fontWeight: '800' },
  posterName: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 6 },
}));
