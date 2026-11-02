import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, genderColors } from '@/constants/theme';
import { isWordToken, tokenize } from '@/lib/lessons';
import { bankWord, glossFor, type WordLookup } from '@/lib/words';

type Chip = { pre: string; word: string; post: string };

/** Splits a sentence into words, each carrying the punctuation that touches it. */
function chips(text: string): Chip[] {
  const out: Chip[] = [];
  let pre = '';
  let glue = false;
  for (const token of tokenize(text)) {
    if (isWordToken(token)) {
      if (glue) out[out.length - 1].word += token;
      else out.push({ pre, word: token, post: '' });
      pre = '';
      glue = false;
      continue;
    }
    // An apostrophe or hyphen inside a word ("geht's") keeps it in one piece.
    if (out.length && !out[out.length - 1].post && /^['’-]$/.test(token)) {
      out[out.length - 1].word += token;
      glue = true;
      continue;
    }
    // Punctuation before a space belongs to the word before; after it, to the next word.
    const [before, ...rest] = token.split(/\s+/);
    if (out.length && before) out[out.length - 1].post += before;
    else if (!out.length) pre += before;
    if (rest.length) pre += rest.join('');
  }
  if (pre && out.length) out[out.length - 1].post += pre;
  return out;
}

/**
 * A sentence where each word is its own button: tap to hear it, press and
 * hold to see its English meaning. Nouns keep their gender colour.
 */
export function WordText({
  text,
  lookup,
  onWord,
  bold,
  size = 26,
}: {
  text: string;
  lookup: WordLookup;
  onWord: (token: string) => void;
  bold?: string;
  size?: number;
}) {
  const [held, setHeld] = useState<number | null>(null);
  useEffect(() => setHeld(null), [text]);

  const list = chips(text);
  const heldWord = held !== null ? list[held]?.word : undefined;
  const gloss = heldWord ? glossFor(heldWord, lookup) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {list.map((chip, i) => {
          const word = bankWord(chip.word, lookup);
          const gender = word?.article as keyof typeof genderColors | null | undefined;
          const isBold = bold && chip.word.toLowerCase() === bold.toLowerCase();
          return (
            <Pressable
              key={i}
              onPress={() => {
                setHeld(null);
                onWord(chip.word);
              }}
              onLongPress={() => setHeld(i)}
              delayLongPress={350}
              hitSlop={4}
              style={({ pressed }) => [styles.chip, (pressed || held === i) && styles.chipActive]}>
              <Text style={[styles.text, { fontSize: size, lineHeight: size * 1.4 }]}>
                {chip.pre}
                <Text
                  style={[
                    gender && genderColors[gender] ? { color: genderColors[gender] } : undefined,
                    isBold ? styles.bold : undefined,
                  ]}>
                  {chip.word}
                </Text>
                {chip.post}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {heldWord && (
        <Pressable onPress={() => setHeld(null)} style={styles.gloss}>
          <Text style={styles.glossWord}>{heldWord}</Text>
          <Text style={styles.glossText}>{gloss ?? 'No English for this word yet.'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 2,
  },
  chip: {
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  chipActive: {
    backgroundColor: colors.border,
  },
  text: {
    color: colors.text,
  },
  bold: {
    fontWeight: '800',
  },
  gloss: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    maxWidth: '90%',
  },
  glossWord: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.blue,
  },
  glossText: {
    fontSize: 17,
    color: colors.text,
    textAlign: 'center',
  },
});
