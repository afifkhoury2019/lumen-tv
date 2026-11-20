import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Source } from './storage';
import { Logo } from './Logo';
import { THEMES, themed, useTheme } from './theme';
import type { Account } from './xtream';

type Props = { source: Source; account: Account | null; counts: Record<string, number | undefined>; onLogout: () => void };

/** The first theme is the Lumen brand theme. */
const i0 = (id: string) => id === THEMES[0].id;

const host = (url: string) => url.replace(/^https?:\/\//i, '').split('/')[0];

export function AccountScreen({ source, account, counts, onLogout }: Props) {
  const styles = useStyles();
  const { colors, theme, setTheme } = useTheme();
  const exp = account?.expDate ? new Date(account.expDate * 1000) : null;
  const daysLeft = exp ? Math.ceil((exp.getTime() - Date.now()) / 86_400_000) : null;

  const confirmLogout = () =>
    Alert.alert('Sign out?', 'Your login will be removed from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onLogout },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={{ marginTop: 12 }}>
        <Logo size={26} />
      </View>
      <Text style={styles.title}>Account</Text>

      <View style={styles.card}>
        {source.kind === 'xtream' ? (
          <>
            <Line label="Username" value={account?.username ?? source.username} />
            <Line label="Server" value={host(source.server)} />
            <Line
              label="Status"
              value={`${account?.status ?? 'Unknown'}${account?.isTrial ? ' (trial)' : ''}`}
              color={account?.status === 'Active' ? colors.ok : colors.danger}
            />
            <Line
              label="Expires"
              value={exp ? `${exp.toLocaleDateString()}${daysLeft !== null ? ` · ${daysLeft} days left` : ''}` : 'Never / unknown'}
              color={daysLeft !== null && daysLeft <= 7 ? colors.star : undefined}
            />
            <Line label="Connections" value={`${account?.activeConnections ?? '?'} of ${account?.maxConnections ?? '?'} in use`} />
          </>
        ) : (
          <Line label="Playlist" value={host(source.url)} />
        )}
      </View>

      <View style={styles.card}>
        {Object.entries(counts).map(([k, v]) => (
          <Line key={k} label={k} value={v === undefined ? 'Not loaded yet' : v.toLocaleString()} />
        ))}
      </View>

      <Text style={styles.section}>Theme</Text>
      <View style={styles.themes}>
        {THEMES.map((t) => {
          const on = t.id === theme.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTheme(t.id)}
              style={[styles.themeCard, { backgroundColor: t.colors.bg, borderColor: on ? t.colors.accent : t.colors.border }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${t.name} theme`}
            >
              <View style={styles.swatches}>
                <View style={[styles.swatch, { backgroundColor: t.colors.accent }]} />
                <View style={[styles.swatch, { backgroundColor: t.colors.surfaceAlt }]} />
                <View style={[styles.swatch, { backgroundColor: t.colors.surface }]} />
              </View>
              <Text style={[styles.themeName, { color: t.colors.text }]} numberOfLines={1}>{t.name}</Text>
              {i0(t.id) && <Text style={[styles.brandTag, { color: t.colors.accent }]}>Brand</Text>}
              {on && (
                <View style={[styles.check, { backgroundColor: t.colors.accent }]}>
                  <Text style={{ color: t.colors.onAccent, fontWeight: '900', fontSize: 12 }}>✓</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.logout} onPress={confirmLogout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
      <Text style={styles.note}>Lumen TV is a player only. Your channels come from your own subscription.</Text>
    </ScrollView>
  );
}

function Line({ label, value, color }: { label: string; value: string; color?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, color ? { color } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const useStyles = themed((colors) => StyleSheet.create({
  wrap: { padding: 16, gap: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 12 },
  label: { color: colors.muted, fontSize: 15 },
  value: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  logout: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.danger },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 16 },
  note: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  section: { color: colors.muted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeCard: { width: '31%', flexGrow: 1, minWidth: 96, borderRadius: 14, borderWidth: 2, padding: 12, gap: 10 },
  swatches: { flexDirection: 'row', gap: 4 },
  swatch: { width: 20, height: 20, borderRadius: 10 },
  themeName: { fontSize: 13, fontWeight: '700' },
  brandTag: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: -6 },
  check: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
}));
