import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { colors } from '@/constants/theme';
import { AudioBankProvider } from '@/lib/AudioBankProvider';
import { DATABASE_NAME, migrate } from '@/lib/db';

export { ErrorBoundary } from 'expo-router';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.blue,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
        <AudioBankProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="session" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          </Stack>
        </AudioBankProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
