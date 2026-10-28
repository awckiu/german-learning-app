import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Button } from '@/components/Button';
import { DueToday } from '@/components/DueToday';
import { Placeholder, Screen } from '@/components/Screen';
import { colors } from '@/constants/theme';
import { useAudioBank } from '@/lib/AudioBankProvider';
import { useDueToday } from '@/lib/useDueToday';

export default function ReviewScreen() {
  const { status, wordCount, chooseFolder, refresh } = useAudioBank();
  const counts = useDueToday();

  if (status === 'loading') {
    return (
      <Screen title="Review">
        <ActivityIndicator color={colors.blue} />
      </Screen>
    );
  }

  if (status === 'no-folder') {
    return (
      <Screen title="Review">
        <Placeholder>
          Pick the GermanAppIngest folder that Syncthing fills from your laptop. You only do this once.
        </Placeholder>
        <Button label="Choose folder" onPress={chooseFolder} />
      </Screen>
    );
  }

  if (status === 'missing-bank' || status === 'error') {
    return (
      <Screen title="Review">
        <Placeholder>
          {status === 'error'
            ? 'The audio bank could not be read.'
            : 'No audio bank in that folder yet. Check that Syncthing has finished copying audio_bank.'}
        </Placeholder>
        <Button label="Check again" onPress={refresh} />
        <Button label="Choose another folder" onPress={chooseFolder} variant="outline" />
      </Screen>
    );
  }

  return (
    <Screen title="Review">
      <DueToday />
      {counts && counts.total > 0 ? (
        <Button label="Start" onPress={() => router.push('/session')} color={colors.coral} />
      ) : (
        <Placeholder>All done for today.</Placeholder>
      )}
      <Placeholder>{wordCount.toLocaleString('de-DE')} words in your audio bank.</Placeholder>
    </Screen>
  );
}
