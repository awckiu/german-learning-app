import * as Speech from 'expo-speech';

import { formGlosses, rankGlosses } from '@/content/glosses';
import type { Word } from '@/lib/review';

export type WordLookup = {
  words: Map<string, Word>; // bank words by lower-case spelling
  forms: Map<string, string>; // recorded forms ("bin") to their clip
};

export const emptyLookup: WordLookup = { words: new Map(), forms: new Map() };

/** The bank word for a spelling in a sentence, if the audio bank has it. */
export function bankWord(token: string, lookup: WordLookup) {
  return lookup.words.get(token.toLowerCase());
}

/** A short English meaning for a word in a sentence, or null if there isn't one yet. */
export function glossFor(token: string, lookup: WordLookup) {
  const key = token.toLowerCase();
  if (formGlosses[key]) return formGlosses[key];
  const word = lookup.words.get(key);
  return word ? (rankGlosses[word.rank] ?? null) : null;
}

export function glossForRank(rank: number) {
  return rankGlosses[rank] ?? null;
}

/**
 * Plays a word: its bank clip, else a recorded form ("bin", "danke"),
 * else the phone's own German voice.
 */
export function sayWord(token: string, lookup: WordLookup, playClip: (uri: string) => void) {
  Speech.stop();
  const word = bankWord(token, lookup);
  const form = lookup.forms.get(token.toLowerCase());
  if (word) playClip(word.audio);
  else if (form) playClip(form);
  else Speech.speak(token, { language: 'de-DE', rate: 0.9 });
}
