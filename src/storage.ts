import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAYLIST_KEY = 'lumen.playlistUrl';
const FAVORITES_KEY = 'lumen.favorites';

export const getPlaylistUrl = () => AsyncStorage.getItem(PLAYLIST_KEY);
export const setPlaylistUrl = (url: string | null) =>
  url ? AsyncStorage.setItem(PLAYLIST_KEY, url) : AsyncStorage.removeItem(PLAYLIST_KEY);

export async function getFavorites(): Promise<string[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(FAVORITES_KEY)) ?? '[]');
  } catch {
    return [];
  }
}
export const saveFavorites = (urls: string[]) =>
  AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(urls));
