import { useSQLiteContext } from 'expo-sqlite';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { importAudioBank, pickIngestFolder } from '@/lib/audioBank';
import { countWords } from '@/lib/review';

type Status = 'loading' | 'no-folder' | 'missing-bank' | 'ready' | 'error';

type AudioBank = {
  status: Status;
  wordCount: number;
  /** Bumped after every import so screens know to re-read their counts. */
  version: number;
  chooseFolder: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AudioBankContext = createContext<AudioBank | null>(null);

/** Imports the synced audio bank when the app opens and shares its status. */
export function AudioBankProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<Status>('loading');
  const [wordCount, setWordCount] = useState(0);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const result = await importAudioBank(db);
      const words = await countWords(db);
      setWordCount(words);
      // Words already imported stay usable even if the folder is unreachable.
      if (result.status === 'no-folder' || (result.status === 'missing-bank' && words === 0)) {
        setStatus(result.status);
      } else {
        setStatus('ready');
      }
    } catch (e) {
      console.warn('Audio bank import failed', e);
      setStatus((await countWords(db)) > 0 ? 'ready' : 'error');
    }
    setVersion((v) => v + 1);
  }, [db]);

  const chooseFolder = useCallback(async () => {
    try {
      await pickIngestFolder(db);
    } catch {
      return; // Picker was cancelled.
    }
    setStatus('loading');
    await refresh();
  }, [db, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AudioBankContext.Provider value={{ status, wordCount, version, chooseFolder, refresh }}>
      {children}
    </AudioBankContext.Provider>
  );
}

export function useAudioBank() {
  const value = useContext(AudioBankContext);
  if (!value) throw new Error('useAudioBank must be used inside AudioBankProvider');
  return value;
}
