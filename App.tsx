import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ChannelsScreen } from './src/ChannelsScreen';
import { PlayerScreen } from './src/PlayerScreen';
import { SetupScreen } from './src/SetupScreen';
import { loadPlaylist, type Channel } from './src/m3u';
import { getFavorites, getPlaylistUrl, saveFavorites, setPlaylistUrl } from './src/storage';
import { colors } from './src/theme';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [playlistUrl, setUrl] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setFavorites(await getFavorites());
      const saved = await getPlaylistUrl();
      if (saved) {
        try {
          setChannels(await loadPlaylist(saved));
          setUrl(saved);
        } catch (e) {
          setBootError(`Couldn't load your saved playlist: ${e instanceof Error ? e.message : e}`);
        }
      }
      setBooting(false);
    })();
  }, []);

  const submitPlaylist = async (url: string) => {
    const list = await loadPlaylist(url);
    await setPlaylistUrl(url);
    setChannels(list);
    setUrl(url);
    setBootError(null);
  };

  const refresh = async () => {
    if (!playlistUrl) return;
    setRefreshing(true);
    try {
      setChannels(await loadPlaylist(playlistUrl));
    } catch {
      // keep the current list if the refresh fails
    } finally {
      setRefreshing(false);
    }
  };

  const toggleFavorite = (url: string) => {
    setFavorites((prev) => {
      const next = prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url];
      saveFavorites(next);
      return next;
    });
  };

  const changePlaylist = async () => {
    await setPlaylistUrl(null);
    setUrl(null);
    setChannels([]);
  };

  const closePlayer = useCallback(() => setPlaying(null), []);

  let screen;
  if (booting) {
    screen = <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.accent} />;
  } else if (playing) {
    screen = <PlayerScreen channel={playing} onClose={closePlayer} />;
  } else if (!playlistUrl) {
    screen = <SetupScreen onSubmit={submitPlaylist} initialError={bootError} />;
  } else {
    screen = (
      <ChannelsScreen
        channels={channels}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onPlay={setPlaying}
        onChangePlaylist={changePlaylist}
        onRefresh={refresh}
        refreshing={refreshing}
      />
    );
  }

  return (
    <View style={styles.root}>
      {screen}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 48,
  },
});
