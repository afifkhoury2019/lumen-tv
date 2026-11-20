import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountScreen } from './src/AccountScreen';
import { BrowseScreen } from './src/BrowseScreen';
import { PlayerScreen } from './src/PlayerScreen';
import { SeriesScreen } from './src/SeriesScreen';
import { SetupScreen } from './src/SetupScreen';
import { loadPlaylist, type Channel } from './src/m3u';
import {
  getFavorites,
  getRecents,
  getSource,
  saveFavorites,
  saveRecents,
  saveSource,
  type Source,
} from './src/storage';
import { colors } from './src/theme';
import { getLive, getMovies, getSeries, login, type Account } from './src/xtream';

type Tab = 'live' | 'movies' | 'series' | 'account';
type Section = 'live' | 'movies' | 'series';
type Lists = Record<Section, Channel[] | null>;
const EMPTY: Lists = { live: null, movies: null, series: null };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const [booting, setBooting] = useState(true);
  const [source, setSource] = useState<Source | null>(null);
  const [savedSource, setSavedSource] = useState<Source | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [lists, setLists] = useState<Lists>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Section, string>>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('live');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [playing, setPlaying] = useState<{ item: Channel; queue: Channel[] } | null>(null);
  const [openSeries, setOpenSeries] = useState<Channel | null>(null);

  /** Signs in (Xtream) or downloads the playlist (M3U), and loads Live TV. */
  const connect = useCallback(async (s: Source) => {
    if (s.kind === 'xtream') {
      const acc = await login(s);
      const live = await getLive(s);
      setAccount(acc);
      setLists({ ...EMPTY, live });
    } else {
      const all = await loadPlaylist(s.url);
      setAccount(null);
      setLists({
        live: all.filter((c) => c.kind === 'live'),
        movies: all.filter((c) => c.kind === 'movie'),
        series: [],
      });
    }
    setErrors({});
    setSource(s);
  }, []);

  useEffect(() => {
    (async () => {
      const [favs, recent, saved] = await Promise.all([getFavorites(), getRecents(), getSource()]);
      setFavorites(favs);
      setRecents(recent);
      if (saved) {
        setSavedSource(saved);
        try {
          await connect(saved);
        } catch (e) {
          setSetupError(`Couldn't sign in: ${errMsg(e)}`);
        }
      }
      setBooting(false);
    })();
  }, [connect]);

  // Movies and series can be huge, so they load the first time their tab is opened.
  useEffect(() => {
    if (source?.kind !== 'xtream' || (tab !== 'movies' && tab !== 'series') || lists[tab] || errors[tab]) return;
    const section = tab;
    (section === 'movies' ? getMovies(source) : getSeries(source))
      .then((items) => setLists((l) => ({ ...l, [section]: items })))
      .catch((e) => setErrors((er) => ({ ...er, [section]: errMsg(e) })));
  }, [tab, source, lists, errors]);

  const submit = async (s: Source) => {
    await connect(s);
    await saveSource(s);
    setSavedSource(s);
    setSetupError(null);
    setTab('live');
  };

  const refresh = async () => {
    if (!source) return;
    setRefreshing(true);
    try {
      if (tab === 'live' || source.kind === 'm3u') await connect(source);
      else if (tab === 'movies') setLists((l) => ({ ...l, movies: null })), setErrors((e) => ({ ...e, movies: undefined }));
      else if (tab === 'series') setLists((l) => ({ ...l, series: null })), setErrors((e) => ({ ...e, series: undefined }));
    } catch (e) {
      setErrors((er) => ({ ...er, live: errMsg(e) }));
    } finally {
      setRefreshing(false);
    }
  };

  const logout = async () => {
    await saveSource(null);
    setSource(null);
    setSavedSource(null);
    setAccount(null);
    setLists(EMPTY);
    setTab('live');
  };

  const toggleFavorite = (id: string) =>
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      saveFavorites(next);
      return next;
    });

  const play = (item: Channel, queue: Channel[]) => {
    setPlaying({ item, queue });
    if (item.kind !== 'episode') {
      setRecents((prev) => {
        const next = [item.id, ...prev.filter((x) => x !== item.id)].slice(0, 30);
        saveRecents(next);
        return next;
      });
    }
  };

  const open = (item: Channel, section: Section) => {
    if (item.kind === 'series') setOpenSeries(item);
    else play(item, lists[section] ?? []);
  };

  const closePlayer = useCallback(() => setPlaying(null), []);
  const closeSeries = useCallback(() => setOpenSeries(null), []);

  let screen: React.ReactNode;
  if (booting) {
    screen = <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.accent} />;
  } else if (!source) {
    screen = <SetupScreen onSubmit={submit} initial={savedSource} initialError={setupError} />;
  } else if (playing) {
    screen = (
      <PlayerScreen
        channel={playing.item}
        queue={playing.queue}
        onChange={(c) => play(c, playing.queue)}
        onClose={closePlayer}
      />
    );
  } else if (openSeries && source.kind === 'xtream') {
    screen = <SeriesScreen login={source} series={openSeries} onBack={closeSeries} onPlay={(ep, season) => play(ep, season)} />;
  } else if (tab === 'account') {
    screen = (
      <AccountScreen
        source={source}
        account={account}
        counts={{
          'Live channels': lists.live?.length,
          Movies: lists.movies?.length,
          ...(source.kind === 'xtream' ? { Series: lists.series?.length } : {}),
        }}
        onLogout={logout}
      />
    );
  } else {
    const section = tab;
    screen = (
      <BrowseScreen
        key={section}
        title={section === 'live' ? 'Live TV' : section === 'movies' ? 'Movies' : 'Series'}
        items={lists[section]}
        error={errors[section]}
        layout={section === 'live' ? 'list' : 'grid'}
        favorites={favorites}
        recents={recents}
        onToggleFavorite={toggleFavorite}
        onOpen={(item) => open(item, section)}
        onRefresh={refresh}
        refreshing={refreshing}
      />
    );
  }

  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: 'live', icon: '📺', label: 'Live TV' },
    ...(source?.kind === 'xtream' || (lists.movies?.length ?? 0) > 0
      ? [{ key: 'movies' as Tab, icon: '🎬', label: 'Movies' }]
      : []),
    ...(source?.kind === 'xtream' ? [{ key: 'series' as Tab, icon: '🎞️', label: 'Series' }] : []),
    { key: 'account', icon: '👤', label: 'Account' },
  ];
  const showTabs = !!source && !playing && !openSeries;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: showTabs ? 0 : insets.bottom }]}>
      <View style={{ flex: 1 }}>{screen}</View>
      {showTabs && (
        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {tabs.map((t) => (
            <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabIcon, tab !== t.key && { opacity: 0.5 }]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, tab === t.key && { color: colors.accent }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 20 },
  tabLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
});
