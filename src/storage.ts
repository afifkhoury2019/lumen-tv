import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { XtreamLogin } from './xtream';

/** Where channels come from. Kept in encrypted storage because it can hold a password. */
export type Source = { kind: 'm3u'; url: string } | ({ kind: 'xtream' } & XtreamLogin);

const SOURCE_KEY = 'lumen.source';
const FAVORITES_KEY = 'lumen.favorites';
const RECENTS_KEY = 'lumen.recents';

export async function getSource(): Promise<Source | null> {
  try {
    const raw = await SecureStore.getItemAsync(SOURCE_KEY);
    return raw ? (JSON.parse(raw) as Source) : null;
  } catch {
    return null;
  }
}

export const saveSource = (s: Source | null) =>
  s ? SecureStore.setItemAsync(SOURCE_KEY, JSON.stringify(s)) : SecureStore.deleteItemAsync(SOURCE_KEY);

async function getList(key: string): Promise<string[]> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(key)) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Favorites and recents store item ids only (never stream URLs), so no credentials land here.
export const getFavorites = () => getList(FAVORITES_KEY);
export const saveFavorites = (ids: string[]) => AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
export const getRecents = () => getList(RECENTS_KEY);
export const saveRecents = (ids: string[]) => AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(ids));
