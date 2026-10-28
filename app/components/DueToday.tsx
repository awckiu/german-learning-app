import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useDueToday } from '@/lib/useDueToday';

/** "12 cards due today" panel, shared by Home and Review. */
export function DueToday() {
  const counts = useDueToday();
  if (!counts) return null;

  return (
    <View style={styles.panel}>
      <Text style={styles.count}>{counts.total}</Text>
      <Text style={styles.label}>{counts.total === 1 ? 'card due today' : 'cards due today'}</Text>
      <Text style={styles.detail}>
        {counts.reviews} to review · {counts.newWords} new
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    gap: 4,
  },
  count: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.text,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  detail: {
    fontSize: 15,
    color: colors.muted,
  },
});
