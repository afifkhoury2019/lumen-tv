import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from './theme';

type Props = { onSubmit: (url: string) => Promise<void>; initialError?: string | null };

export function SetupScreen({ onSubmit, initialError }: Props) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const submit = async () => {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      setError('Enter a playlist link starting with http:// or https://');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.logo}>Lumen TV</Text>
      <Text style={styles.sub}>Add your M3U playlist link to load your channels.</Text>
      <TextInput
        style={styles.input}
        placeholder="https://example.com/playlist.m3u"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={url}
        onChangeText={setUrl}
        onSubmitEditing={submit}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Load channels</Text>}
      </Pressable>
      <Text style={styles.note}>
        Lumen TV is only a player. Use playlists you have the right to watch.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  logo: { color: colors.text, fontSize: 34, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 16, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  error: { color: colors.danger },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 12, marginTop: 12 },
});
