import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

type Props = {
  title: string;
  children?: ReactNode;
};

export function Screen({ title, children }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  return <Text style={styles.placeholder}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
  },
  placeholder: {
    fontSize: 15,
    color: colors.muted,
  },
});
