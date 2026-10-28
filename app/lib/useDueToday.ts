import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { useAudioBank } from '@/lib/AudioBankProvider';
import { countDueToday } from '@/lib/review';

/** Today's card counts, re-read whenever the screen comes into view. */
export function useDueToday() {
  const db = useSQLiteContext();
  const { version } = useAudioBank();
  const [counts, setCounts] = useState<Awaited<ReturnType<typeof countDueToday>> | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      countDueToday(db).then((c) => active && setCounts(c));
      return () => {
        active = false;
      };
    }, [db, version]),
  );

  return counts;
}
