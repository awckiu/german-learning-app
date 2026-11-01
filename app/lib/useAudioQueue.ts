import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

/** Plays a list of clips one after another, then calls onDone. */
export function useAudioQueue() {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const queue = useRef<string[]>([]);
  const onDone = useRef<(() => void) | null>(null);

  const start = useCallback(
    (uri: string) => {
      player.replace({ uri });
      player.play();
    },
    [player],
  );

  const play = useCallback(
    (uris: (string | null | undefined)[], done?: () => void) => {
      const list = uris.filter((u): u is string => !!u);
      queue.current = list.slice(1);
      onDone.current = done ?? null;
      if (list.length) start(list[0]);
      else done?.();
    },
    [start],
  );

  useEffect(() => {
    if (!status.didJustFinish) return;
    const next = queue.current.shift();
    if (next) {
      start(next);
    } else {
      const done = onDone.current;
      onDone.current = null;
      done?.();
    }
  }, [status.didJustFinish, start]);

  return { play, playing: status.playing };
}
