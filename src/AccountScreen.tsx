import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Source } from './storage';
import { colors } from './theme';
import type { Account } from './xtream';

type Props = { source: Source; account: Account | null; counts: Record<string, number | undefined>; onLogout: () => void };

const host = (url: string) => url.replace(/^https?:\/\//i, '').split('/')[0];

export function AccountScreen({ source, account, counts, onLogout }: Props) {
  const exp = account?.expDate ? new Date(account.expDate * 1000) : null;
  const daysLeft = exp ? Math.ceil((exp.getTime() - Date.now()) / 86_400_000) : null;

  const confirmLogout = () =>
    Alert.alert('Sign out?', 'Your login will be removed from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onLogout },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
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

      <Pressable style={styles.logout} onPress={confirmLogout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
      <Text style={styles.note}>Lumen TV is a player only. Your channels come from your own subscription.</Text>
    </ScrollView>
  );
}

function Line({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, color ? { color } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 12 },
  label: { color: colors.muted, fontSize: 15 },
  value: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  logout: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.danger },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 16 },
  note: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
