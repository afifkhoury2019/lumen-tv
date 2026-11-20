import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Source } from './storage';
import { Logo } from './Logo';
import { themed, useTheme } from './theme';
import { normalizeServer } from './xtream';

// Free-TV/IPTV asks players to load its playlists straight from GitHub, so we link, not copy.
const FREE_TV = 'https://raw.githubusercontent.com/Free-TV/IPTV/master';
const FREE_TV_ARABIC = [
  'saudi_arabia', 'united_arab_emirates', 'egypt', 'lebanon', 'qatar', 'iraq', 'zz_news_ar', 'zz_documentaries_ar',
].map((c) => `${FREE_TV}/playlists/playlist_${c}.m3u8`);

type FreePlaylist = { title: string; sub: string; url: string; more?: string[]; fallback?: string };

const FREE_PLAYLISTS: FreePlaylist[] = [
  {
    title: '🇸🇦  Arabic channels',
    sub: 'About 360 free Arabic channels from iptv-org (tested daily) and Free-TV',
    // Refreshed every day by .github/workflows/check-streams.yml
    url: 'https://raw.githubusercontent.com/afifkhoury2019/lumen-tv/main/playlists/arabic.m3u',
    more: FREE_TV_ARABIC,
    fallback: 'https://iptv-org.github.io/iptv/languages/ara.m3u',
  },
  {
    title: '📡  Free-TV channels',
    sub: 'About 2,200 free channels worldwide from the Free-TV project',
    url: `${FREE_TV}/playlist.m3u8`,
  },
  {
    title: '🌍  All iptv-org channels',
    sub: 'About 12,000 free channels from around the world (not tested)',
    url: 'https://iptv-org.github.io/iptv/index.category.m3u',
  },
];

type Props = { onSubmit: (source: Source) => Promise<void>; initial?: Source | null; initialError?: string | null };

export function SetupScreen({ onSubmit, initial, initialError }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [mode, setMode] = useState<'xtream' | 'm3u'>(initial?.kind ?? 'xtream');
  const [server, setServer] = useState(initial?.kind === 'xtream' ? initial.server : '');
  const [username, setUsername] = useState(initial?.kind === 'xtream' ? initial.username : '');
  const [password, setPassword] = useState(initial?.kind === 'xtream' ? initial.password : '');
  const [showPassword, setShowPassword] = useState(false);
  const [url, setUrl] = useState(initial?.kind === 'm3u' ? initial.url : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const submit = async () => {
    let source: Source;
    if (mode === 'xtream') {
      if (!server.trim() || !username.trim() || !password) {
        setError('Enter your server address, username and password.');
        return;
      }
      source = { kind: 'xtream', server: normalizeServer(server), username: username.trim(), password };
    } else {
      if (!/^https?:\/\//i.test(url.trim())) {
        setError('Enter a playlist link starting with http:// or https://');
        return;
      }
      source = { kind: 'm3u', url: url.trim() };
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(source);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Logo size={38} />
        <Text style={styles.sub}>Sign in with your IPTV subscription.</Text>

        <View style={styles.segment}>
          {(['xtream', 'm3u'] as const).map((m) => (
            <Pressable key={m} style={[styles.segItem, mode === m && styles.segOn]} onPress={() => setMode(m)}>
              <Text style={[styles.segText, mode === m && { color: colors.onAccent }]}>
                {m === 'xtream' ? 'Username & password' : 'M3U link'}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'xtream' ? (
          <>
            <Field label="Server address" value={server} onChangeText={setServer} placeholder="http://server.example.com:8080" keyboardType="url" />
            <Field label="Username" value={username} onChangeText={setUsername} placeholder="Username" />
            <View>
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry={!showPassword}
                onSubmitEditing={submit}
              />
              <Pressable style={styles.eye} onPress={() => setShowPassword((s) => !s)} hitSlop={10}>
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>Your provider sends these details. The server address usually includes a port, like :8080.</Text>
          </>
        ) : (
          <Field
            label="Playlist link"
            value={url}
            onChangeText={setUrl}
            placeholder="https://example.com/playlist.m3u"
            keyboardType="url"
            onSubmitEditing={submit}
          />
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
        <Text style={styles.note}>🔒 Your login is saved only on this device, in encrypted storage.</Text>

        <View style={styles.divider} />
        <Text style={styles.label}>No subscription? Try free channels</Text>
        {FREE_PLAYLISTS.map((p) => (
          <Pressable
            key={p.url}
            style={[styles.free, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => {
              setMode('m3u');
              setUrl(p.url);
              setBusy(true);
              setError(null);
              onSubmit({ kind: 'm3u', url: p.url, more: p.more })
                .catch((e) => (p.fallback ? onSubmit({ kind: 'm3u', url: p.fallback, more: p.more }) : Promise.reject(e)))
                .catch((e) => setError(e instanceof Error ? e.message : String(e)))
                .finally(() => setBusy(false));
            }}
          >
            <Text style={styles.freeTitle}>{p.title}</Text>
            <Text style={styles.freeSub}>{p.sub}</Text>
          </Pressable>
        ))}
        <Text style={styles.note}>
          Free channels come from the public iptv-org and Free-TV projects: streams that broadcasters make freely available. Some may be offline or blocked in your country.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}

const useStyles = themed((colors) => StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  logo: { color: colors.text, fontSize: 36, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 16, marginBottom: 4 },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: colors.accent },
  segText: { color: colors.muted, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
  },
  eye: { position: 'absolute', right: 14, bottom: 14 },
  eyeText: { color: colors.accent, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  buttonText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 8 },
  free: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 4, borderWidth: 1, borderColor: colors.border },
  freeTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  freeSub: { color: colors.muted, fontSize: 12 },
}));
