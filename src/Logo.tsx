import { StyleSheet, Text, View } from 'react-native';
import { themed } from './theme';

/** "Lumen" wordmark with an accent-colored "TV" badge, in the current theme. */
export function Logo({ size = 34 }: { size?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={[styles.word, { fontSize: size }]}>Lumen</Text>
      <View style={[styles.badge, { borderRadius: size * 0.22, paddingHorizontal: size * 0.22 }]}>
        <Text style={[styles.badgeText, { fontSize: size * 0.62 }]}>TV</Text>
      </View>
    </View>
  );
}

const useStyles = themed((colors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    word: { color: colors.text, fontWeight: '900', letterSpacing: -0.5 },
    badge: { backgroundColor: colors.accent, paddingVertical: 2 },
    badgeText: { color: colors.onAccent, fontWeight: '900', letterSpacing: 1 },
  }),
);
