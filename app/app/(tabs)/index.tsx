import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { DueToday } from '@/components/DueToday';
import { Placeholder, Screen } from '@/components/Screen';
import { useAudioBank } from '@/lib/AudioBankProvider';

export default function HomeScreen() {
  const { status } = useAudioBank();

  return (
    <Screen title="Hallo">
      {status === 'ready' && (
        // Stand-in until the daily goals arrive in step 5.
        <Pressable onPress={() => router.navigate('/review')}>
          <DueToday />
        </Pressable>
      )}
      <Placeholder>Daily goals, current lesson and activity shortcuts arrive in step 5.</Placeholder>
    </Screen>
  );
}
