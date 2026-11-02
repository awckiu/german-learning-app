import * as Speech from 'expo-speech';

import { formGlosses, rankGlosses } from '@/content/glosses';
import type { Word } from '@/lib/review';

export type WordLookup = Map<string, Word>;

/** The bank word for a spelling in a sentence, if the audio bank has it. */
export function bankWord(token: string, lookup: WordLookup) {
  return lookup.get(token.toLowerCase());
}

/** A short English meaning for a word in a sentence, or null if there isn't one yet. */
export function glossFor(token: string, lookup: WordLookup) {
  const key = token.toLowerCase();
  if (formGlosses[key]) return formGlosses[key];
  const word = lookup.get(key);
  return word ? (rankGlosses[word.rank] ?? null) : null;
}

export function glossForRank(rank: number) {
  return rankGlosses[rank] ?? null;
}

/**
 * Plays a word: the recorded clip when the bank has one, otherwise the
 * phone's own German voice (for forms like "bin" or "danke").
 */
export function sayWord(token: string, lookup: WordLookup, playClip: (uri: string) => void) {
  Speech.stop();
  const word = bankWord(token, lookup);
  if (word) playClip(word.audio);
  else Speech.speak(token, { language: 'de-DE', rate: 0.9 });
}
