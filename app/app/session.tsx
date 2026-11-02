import { useAudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Grade, Rating } from 'ts-fsrs';

import { Button } from '@/components/Button';
import { WordText } from '@/components/WordText';
import { colors, genderColors } from '@/constants/theme';
import { useAudioBank } from '@/lib/AudioBankProvider';
import { loadWordLookup } from '@/lib/lessons';
import { countDueToday, nextIntervals, nextReviewItem, rate, type ReviewItem, sentenceAudio } from '@/lib/review';
import { emptyLookup, glossForRank, sayWord, type WordLookup } from '@/lib/words';

const grades: { grade: Grade; label: string; color: string }[] = [
  { grade: Rating.Again, label: 'Again', color: colors.coral },
  { grade: Rating.Hard, label: 'Hard', color: colors.muted },
  { grade: Rating.Good, label: 'Good', color: colors.blue },
  { grade: Rating.Easy, label: 'Easy', color: colors.success },
];

export default function SessionScreen() {
  const db = useSQLiteContext();
  const { refresh } = useAudioBank();
  const player = useAudioPlayer();
  const [item, setItem] = useState<ReviewItem | null | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);
  const [left, setLeft] = useState(0);
  const [lookup, setLookup] = useState<WordLookup>(emptyLookup);
  const [showGloss, setShowGloss] = useState(false);

  useEffect(() => {
    loadWordLookup(db).then(setLookup);
  }, [db]);

  const play = useCallback(
    (uri: string | null) => {
      if (!uri) return;
      player.replace({ uri });
      player.play();
    },
    [player],
  );

  const loadNext = useCallback(async () => {
    const [next, counts] = await Promise.all([nextReviewItem(db), countDueToday(db)]);
    setLeft(counts.total);
    setRevealed(false);
    setShowGloss(false);
    setItem(next);
    if (next) play(next.word.audio);
  }, [db, play]);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  const reveal = () => {
    if (!item || revealed) return;
    setRevealed(true);
    play(sentenceAudio(item) ?? item.word.audio);
  };

  const grade = async (g: Grade) => {
    if (!item) return;
    await rate(db, item, g);
    await loadNext();
  };

  const close = () => {
    refresh(); // Updates the due counts on Home and Review.
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={close} hitSlop={12}>
          <SymbolView name={{ android: 'close' }} tintColor={colors.muted} size={28} />
        </Pressable>
        {!!item && <Text style={styles.left}>{left}</Text>}
      </View>

      {item === undefined && <ActivityIndicator color={colors.blue} style={styles.grow} />}

      {item === null && (
        <View style={[styles.grow, styles.center]}>
          <Text style={styles.done}>Fertig!</Text>
          <Button label="Close" onPress={close} />
        </View>
      )}

      {item && (
        <>
          <Pressable style={[styles.grow, styles.center]} onPress={reveal}>
            <Pressable
              onPress={revealed ? () => play(item.word.audio) : reveal}
              onLongPress={() => setShowGloss(!showGloss)}
              delayLongPress={350}>
              <Text style={[styles.word, { color: wordColor(item.word.article) }]}>
                {[item.word.article, item.word.word].filter(Boolean).join(' ')}
              </Text>
            </Pressable>
            {showGloss && (
              <Text style={styles.gloss}>{glossForRank(item.word.rank) ?? 'No English for this word yet.'}</Text>
            )}
            <Pressable onPress={() => play(item.word.audio)} hitSlop={16} style={styles.speaker}>
              <SymbolView name={{ android: 'volume_up' }} tintColor={colors.text} size={32} />
            </Pressable>

            {revealed && item.word.sentence && (
              <>
                <WordText
                  text={item.word.sentence}
                  lookup={lookup}
                  bold={item.word.word}
                  size={20}
                  onWord={(token) => sayWord(token, lookup, play)}
                />
                <Pressable onPress={() => play(sentenceAudio(item))} hitSlop={16} style={styles.speaker}>
                  <SymbolView name={{ android: 'replay' }} tintColor={colors.muted} size={26} />
                </Pressable>
              </>
            )}
            {!revealed && <Text style={styles.hint}>Tap to reveal</Text>}
          </Pressable>

          {revealed && <Grades item={item} onGrade={grade} />}
        </>
      )}
    </SafeAreaView>
  );
}

function Grades({ item, onGrade }: { item: ReviewItem; onGrade: (g: Grade) => void }) {
  const intervals = nextIntervals(item);
  return (
    <View style={styles.grades}>
      {grades.map(({ grade, label, color }) => (
        <Pressable
          key={grade}
          onPress={() => onGrade(grade)}
          style={({ pressed }) => [styles.grade, { borderColor: color }, pressed && styles.pressed]}>
          <Text style={[styles.gradeLabel, { color }]}>{label}</Text>
          <Text style={styles.gradeInterval}>{intervals[grade]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function wordColor(article: string | null) {
  return article && article in genderColors ? genderColors[article as keyof typeof genderColors] : colors.text;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.muted,
  },
  grow: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  word: {
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
  },
  speaker: {
    padding: 8,
  },
  hint: {
    fontSize: 15,
    color: colors.muted,
  },
  gloss: {
    fontSize: 18,
    color: colors.muted,
    textAlign: 'center',
  },
  done: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
  },
  grades: {
    flexDirection: 'row',
    gap: 8,
  },
  grade: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  gradeLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  gradeInterval: {
    fontSize: 13,
    color: colors.muted,
  },
});
