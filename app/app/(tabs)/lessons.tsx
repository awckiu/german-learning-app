import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Placeholder, Screen } from '@/components/Screen';
import { colors } from '@/constants/theme';
import { course, type CourseLesson, isBreakthrough } from '@/content/course';
import { useAudioBank } from '@/lib/AudioBankProvider';
import { BREAKTHROUGH_PASS, isLevelUnlocked, loadProgress, type Progress } from '@/lib/lessons';

export default function LessonsScreen() {
  const db = useSQLiteContext();
  const { status, chooseFolder } = useAudioBank();
  const [progress, setProgress] = useState<Progress | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadProgress(db).then(setProgress);
    }, [db]),
  );

  if (status === 'no-folder') {
    return (
      <Screen title="Lessons">
        <Placeholder>Lessons use the audio bank. Pick the GermanAppIngest folder first.</Placeholder>
        <Button label="Choose folder" onPress={chooseFolder} />
      </Screen>
    );
  }
  if (!progress) return <Screen title="Lessons" />;

  const lessons = course.flatMap((l) => l.lessons).filter((l) => l.items.length);
  const done = lessons.filter((l) => progress.has(l.id)).length;
  // The next lesson to do: the first unfinished one in an open level.
  const next = course
    .filter((l) => isLevelUnlocked(l.level, progress))
    .flatMap((l) => l.lessons)
    .find((l) => l.items.length && !passed(l, progress));

  return (
    <Screen title="Lessons">
      <View style={styles.progressPanel}>
        <Text style={styles.progressText}>
          {done} of {lessons.length} lessons done
        </Text>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${(done / lessons.length) * 100}%` }]} />
        </View>
      </View>

      {course.map((level) => {
        const unlocked = isLevelUnlocked(level.level, progress);
        return (
          <View key={level.level} style={[styles.level, !unlocked && styles.locked]}>
            <View style={styles.levelHeader}>
              <Text style={styles.levelNumber}>Level {level.level}</Text>
              {!unlocked && <SymbolView name={{ android: 'lock' }} tintColor={colors.muted} size={18} />}
            </View>
            <Text style={styles.theme}>{level.theme}</Text>
            {unlocked &&
              level.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  done={passed(lesson, progress)}
                  current={lesson.id === next?.id}
                />
              ))}
          </View>
        );
      })}
    </Screen>
  );
}

function passed(lesson: CourseLesson, progress: Progress) {
  const score = progress.get(lesson.id);
  if (score === undefined) return false;
  return !isBreakthrough(lesson) || score >= BREAKTHROUGH_PASS;
}

function LessonRow({ lesson, done, current }: { lesson: CourseLesson; done: boolean; current: boolean }) {
  const soon = lesson.items.length === 0;
  const icon = done ? 'check_circle' : isBreakthrough(lesson) ? 'star' : 'play_circle';
  return (
    <Pressable
      disabled={soon}
      onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
      style={({ pressed }) => [styles.row, current && styles.current, pressed && styles.pressed]}>
      <SymbolView
        name={{ android: soon ? 'schedule' : icon }}
        tintColor={done ? colors.success : current ? colors.coral : colors.muted}
        size={24}
      />
      <View style={styles.rowText}>
        <Text style={[styles.lessonTitle, soon && styles.soonText]}>{lesson.title}</Text>
        {soon && <Text style={styles.soonText}>Coming soon</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progressPanel: {
    gap: 8,
  },
  progressText: {
    fontSize: 15,
    color: colors.muted,
  },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.coral,
  },
  level: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    gap: 4,
  },
  locked: {
    opacity: 0.5,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.blue,
    textTransform: 'uppercase',
  },
  theme: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  current: {
    backgroundColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 16,
    color: colors.text,
  },
  soonText: {
    fontSize: 13,
    color: colors.muted,
  },
});
