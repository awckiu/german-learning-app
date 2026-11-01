import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { colors, genderColors } from '@/constants/theme';
import { findLesson, isBreakthrough } from '@/content/course';
import { useAudioBank } from '@/lib/AudioBankProvider';
import { getSetting, setSetting } from '@/lib/db';
import {
  BREAKTHROUGH_PASS,
  buildQuiz,
  completeLesson,
  isWordToken,
  loadLessonWords,
  loadWordLookup,
  type QuizCard,
  spoken,
  tokenize,
} from '@/lib/lessons';
import type { Word } from '@/lib/review';
import { useAudioQueue } from '@/lib/useAudioQueue';

type Phase = 'listen' | 'quiz' | 'done';

const prompts: Record<QuizCard['kind'], string> = {
  sentence: 'Was hörst du?',
  gap: 'Welches Wort fehlt?',
  word: 'Welches Wort hörst du?',
};

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = findLesson(id);
  const db = useSQLiteContext();
  const { refresh } = useAudioBank();
  const audio = useAudioQueue();

  const [words, setWords] = useState<Word[] | null>(null);
  const [lookup, setLookup] = useState<Map<string, Word>>(new Map());
  const [quiz, setQuiz] = useState<QuizCard[]>([]);
  const [showText, setShowText] = useState(false);
  const [phase, setPhase] = useState<Phase>('listen');
  const [index, setIndex] = useState(0);
  const [heard, setHeard] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    if (!found) return;
    Promise.all([loadLessonWords(db, found.lesson), loadWordLookup(db), getSetting(db, 'lesson_show_text')]).then(
      ([w, l, show]) => {
        setWords(w);
        setLookup(l);
        setQuiz(buildQuiz(found.lesson, w));
        setShowText(show === '1');
      },
    );
    // Load once per lesson.
  }, [db, id]);

  const item = phase === 'listen' ? words?.[index] : undefined;
  const card = phase === 'quiz' ? quiz[index] : undefined;

  const playItem = useCallback(
    (w: Word) => {
      setHeard(false);
      const clips = w.sentence ? [w.sentence_audio_sarah, w.sentence_audio_lennard] : [w.audio];
      audio.play(clips.some(Boolean) ? clips : [w.audio], () => setHeard(true));
    },
    [audio],
  );

  const playCard = useCallback(
    (c: QuizCard) => {
      const voice = Math.random() < 0.5 ? c.word.sentence_audio_sarah : c.word.sentence_audio_lennard;
      audio.play([c.kind === 'word' ? c.word.audio : (voice ?? c.word.sentence_audio_sarah ?? c.word.audio)]);
    },
    [audio],
  );

  // Play each sentence or card as it appears.
  useEffect(() => {
    if (item) playItem(item);
    if (card) playCard(card);
  }, [phase, index, words]);

  if (!found) return null;
  const { lesson } = found;
  const breakthrough = isBreakthrough(lesson);

  const nextItem = () => {
    if (!words) return;
    if (index + 1 < words.length) return setIndex(index + 1);
    setIndex(0);
    setPhase(quiz.length ? 'quiz' : 'done');
    if (!quiz.length) finish(0, 0);
  };

  const pick = (option: number) => {
    if (!card || picked !== null) return;
    setPicked(option);
    if (option === card.answer) setCorrect((c) => c + 1);
  };

  const nextCard = () => {
    setPicked(null);
    if (index + 1 < quiz.length) return setIndex(index + 1);
    setPhase('done');
    finish(correct, quiz.length);
  };

  const finish = async (right: number, total: number) => {
    const score = total ? right / total : 1;
    // A failed Breakthrough Lesson is saved too, but doesn't open the next level.
    setQueued(await completeLesson(db, lesson, words ?? [], score));
  };

  const toggleText = () => {
    setShowText(!showText);
    setSetting(db, 'lesson_show_text', showText ? '0' : '1');
  };

  const close = () => {
    refresh();
    router.back();
  };

  const steps = phase === 'listen' ? (words?.length ?? 0) : quiz.length;
  const score = quiz.length ? correct / quiz.length : 1;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={close} hitSlop={12}>
          <SymbolView name={{ android: 'close' }} tintColor={colors.muted} size={28} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {lesson.title}
        </Text>
        <Pressable onPress={toggleText} hitSlop={12}>
          <SymbolView
            name={{ android: showText ? 'subtitles' : 'subtitles_off' }}
            tintColor={showText ? colors.blue : colors.muted}
            size={26}
          />
        </Pressable>
      </View>
      {phase !== 'done' && steps > 0 && (
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${((index + 1) / steps) * 100}%` }]} />
        </View>
      )}

      {!words && <ActivityIndicator color={colors.blue} style={styles.grow} />}

      {words && words.length === 0 && (
        <View style={[styles.grow, styles.center]}>
          <Text style={styles.hint}>This lesson's audio isn't on your phone yet.</Text>
        </View>
      )}

      {item && (
        <>
          <View style={[styles.grow, styles.center]}>
            {showText || heard ? (
              <TappableText text={item.sentence ?? spoken(item)} lookup={lookup} onWord={(w) => audio.play([w.audio])} />
            ) : (
              <SymbolView name={{ android: 'hearing' }} tintColor={colors.muted} size={56} />
            )}
            <Pressable onPress={() => playItem(item)} hitSlop={16} style={styles.speaker}>
              <SymbolView name={{ android: 'replay' }} tintColor={colors.text} size={30} />
            </Pressable>
            {!showText && !heard && (
              <Pressable onPress={() => setHeard(true)}>
                <Text style={styles.hint}>Tap to show the text</Text>
              </Pressable>
            )}
          </View>
          <Button label="Weiter" onPress={nextItem} />
        </>
      )}

      {card && (
        <>
          <View style={[styles.grow, styles.center]}>
            <Text style={styles.prompt}>{prompts[card.kind]}</Text>
            <Pressable onPress={() => playCard(card)} hitSlop={16} style={styles.speaker}>
              <SymbolView name={{ android: 'volume_up' }} tintColor={colors.text} size={40} />
            </Pressable>
            {card.kind === 'gap' && (
              <Text style={styles.sentence}>
                {card.before}
                <Text style={styles.gap}>{picked === null ? '_____' : card.options[card.answer]}</Text>
                {card.after}
              </Text>
            )}
            <View style={styles.options}>
              {card.options.map((option, i) => {
                const state = picked === null ? null : i === card.answer ? 'right' : i === picked ? 'wrong' : null;
                return (
                  <Pressable
                    key={i}
                    onPress={() => pick(i)}
                    style={[
                      styles.option,
                      state === 'right' && { borderColor: colors.success },
                      state === 'wrong' && { borderColor: colors.coral },
                    ]}>
                    <Text style={styles.optionText}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {picked !== null && <Button label="Weiter" onPress={nextCard} />}
        </>
      )}

      {phase === 'done' && (
        <View style={[styles.grow, styles.center]}>
          <Text style={styles.done}>
            {breakthrough && score < BREAKTHROUGH_PASS ? 'Fast!' : breakthrough ? 'Geschafft!' : 'Super!'}
          </Text>
          {quiz.length > 0 && (
            <Text style={styles.result}>
              {correct} / {quiz.length}
            </Text>
          )}
          {breakthrough && (
            <Text style={styles.hint}>
              {score >= BREAKTHROUGH_PASS
                ? 'The next level is open.'
                : `You need ${Math.round(BREAKTHROUGH_PASS * 100)}% to open the next level. Try again any time.`}
            </Text>
          )}
          {queued > 0 && (
            <Text style={styles.hint}>
              {queued} {queued === 1 ? 'word' : 'words'} added to Review.
            </Text>
          )}
          <Button label="Fertig" onPress={close} />
        </View>
      )}
    </SafeAreaView>
  );
}

/** Sentence text where every word from the audio bank can be tapped to hear it. */
function TappableText({ text, lookup, onWord }: { text: string; lookup: Map<string, Word>; onWord: (w: Word) => void }) {
  return (
    <Text style={styles.sentence}>
      {tokenize(text).map((token, i) => {
        const word = isWordToken(token) ? lookup.get(token.toLowerCase()) : undefined;
        if (!word) return token;
        const gender = word.article as keyof typeof genderColors | null;
        return (
          <Text key={i} onPress={() => onWord(word)} style={gender && genderColors[gender] ? { color: genderColors[gender] } : undefined}>
            {token}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    gap: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.coral,
  },
  grow: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  speaker: {
    padding: 8,
  },
  hint: {
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
  },
  prompt: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  sentence: {
    fontSize: 26,
    lineHeight: 38,
    color: colors.text,
    textAlign: 'center',
  },
  gap: {
    fontWeight: '800',
    color: colors.blue,
  },
  options: {
    alignSelf: 'stretch',
    gap: 10,
  },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
  },
  optionText: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
  },
  done: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
  },
  result: {
    fontSize: 22,
    color: colors.text,
  },
});
