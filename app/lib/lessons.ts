import type { SQLiteDatabase } from 'expo-sqlite';

import { course, type CourseLesson, isBreakthrough } from '@/content/course';
import type { Word } from '@/lib/review';
import type { WordLookup } from '@/lib/words';

export const BREAKTHROUGH_PASS = 0.8;
const QUIZ_LENGTH = 5;
const BREAKTHROUGH_QUIZ_LENGTH = 10;

export type Progress = Map<string, number>; // lesson id → best score

export async function loadProgress(db: SQLiteDatabase): Promise<Progress> {
  const rows = await db.getAllAsync<{ lesson_id: string; best_score: number }>(
    'SELECT lesson_id, best_score FROM lesson_progress',
  );
  return new Map(rows.map((r) => [r.lesson_id, r.best_score]));
}

/** Level 1 is open; each later level opens once the previous Breakthrough Lesson is passed. */
export function isLevelUnlocked(level: number, progress: Progress) {
  if (level === 1) return true;
  const previous = course[level - 2];
  const breakthrough = previous.lessons[previous.lessons.length - 1];
  return (progress.get(breakthrough.id) ?? 0) >= BREAKTHROUGH_PASS;
}

/** The lesson's items that exist in the imported audio bank, in course order. */
export async function loadLessonWords(db: SQLiteDatabase, lesson: CourseLesson): Promise<Word[]> {
  if (lesson.items.length === 0) return [];
  const rows = await db.getAllAsync<Word>(
    `SELECT * FROM words WHERE rank IN (${lesson.items.map(() => '?').join(',')})`,
    ...lesson.items,
  );
  const byRank = new Map(rows.map((w) => [w.rank, w]));
  return lesson.items.flatMap((rank) => byRank.get(rank) ?? []);
}

/** Every bank word and recorded word form by lower-case spelling, so any word in a sentence can be tapped. */
export async function loadWordLookup(db: SQLiteDatabase): Promise<WordLookup> {
  const rows = await db.getAllAsync<Word>('SELECT * FROM words ORDER BY rank');
  const words = new Map<string, Word>();
  for (const w of rows) {
    const key = w.word.toLowerCase();
    // Keep the most frequent entry when two words share a spelling.
    if (!words.has(key)) words.set(key, w);
  }
  const forms = await db.getAllAsync<{ form: string; audio: string }>('SELECT form, audio FROM word_forms');
  return { words, forms: new Map(forms.map((f) => [f.form, f.audio])) };
}

export type QuizCard =
  | { kind: 'sentence'; word: Word; options: string[]; answer: number } // Was hörst du?
  | { kind: 'gap'; word: Word; before: string; after: string; options: string[]; answer: number } // Welches Wort fehlt?
  | { kind: 'word'; word: Word; options: string[]; answer: number }; // Welches Wort hörst du?

export function spoken(word: Word) {
  return [word.article, word.word].filter(Boolean).join(' ');
}

/** Builds the quiz from the lesson's own sentences and words, in German only. */
export function buildQuiz(lesson: CourseLesson, words: Word[]): QuizCard[] {
  const length = isBreakthrough(lesson) ? BREAKTHROUGH_QUIZ_LENGTH : QUIZ_LENGTH;
  const sentences = words.filter((w) => w.sentence);
  const gaps = sentences.flatMap((w) => {
    const gap = findGap(w);
    return gap ? [{ word: w, ...gap }] : [];
  });

  const candidates: QuizCard[] = [];
  for (const w of shuffle(sentences)) {
    const others = [...new Set(sentences.map((o) => o.sentence!))].filter((o) => o !== w.sentence);
    if (others.length < 2) continue;
    const { options, answer } = withDistractors(w.sentence!, others);
    candidates.push({ kind: 'sentence', word: w, options, answer });
  }
  for (const g of shuffle(gaps)) {
    const others = gaps.map((o) => o.token).filter((t) => t.toLowerCase() !== g.token.toLowerCase());
    if (new Set(others).size < 2) continue;
    const { options, answer } = withDistractors(g.token, [...new Set(others)]);
    candidates.push({ kind: 'gap', word: g.word, before: g.before, after: g.after, options, answer });
  }
  for (const w of shuffle(words)) {
    const others = [...new Set(words.map(spoken))].filter((o) => o !== spoken(w));
    if (others.length < 2) continue;
    const { options, answer } = withDistractors(spoken(w), others);
    candidates.push({ kind: 'word', word: w, options, answer });
  }

  // Take card types in turn so the quiz feels varied.
  const byKind = ['sentence', 'gap', 'word'].map((k) => candidates.filter((c) => c.kind === k));
  const quiz: QuizCard[] = [];
  while (quiz.length < length && byKind.some((list) => list.length)) {
    for (const list of byKind) {
      const card = list.shift();
      if (card && quiz.length < length) quiz.push(card);
    }
  }
  return quiz;
}

/** Saves the result and queues the lesson's words for Review. Returns how many were new. */
export async function completeLesson(db: SQLiteDatabase, lesson: CourseLesson, words: Word[], score: number) {
  const now = Date.now();
  let queued = 0;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO lesson_progress (lesson_id, completed_at, best_score) VALUES (?, ?, ?)
       ON CONFLICT(lesson_id) DO UPDATE SET completed_at = excluded.completed_at,
         best_score = MAX(best_score, excluded.best_score)`,
      lesson.id,
      now,
      score,
    );
    for (const [i, w] of words.entries()) {
      const result = await db.runAsync(
        `INSERT OR IGNORE INTO word_queue (rank, queued_at)
         SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM cards WHERE word_rank = ?)`,
        w.rank,
        now + i, // Keeps the lesson's order.
        w.rank,
      );
      queued += result.changes;
    }
  });
  return queued;
}

/** Splits a sentence into words and the spaces and punctuation between them. */
export function tokenize(text: string) {
  return text.split(/([^A-Za-zÄÖÜäöüß]+)/).filter(Boolean);
}

export function isWordToken(token: string) {
  return /^[A-Za-zÄÖÜäöüß]+$/.test(token);
}

// The sentence's own head word, if it appears unchanged, becomes the gap.
function findGap(word: Word) {
  const tokens = tokenize(word.sentence!);
  const i = tokens.findIndex((t) => t.toLowerCase() === word.word.toLowerCase());
  if (i === -1) return null;
  return { token: tokens[i], before: tokens.slice(0, i).join(''), after: tokens.slice(i + 1).join('') };
}

function withDistractors(correct: string, others: string[]) {
  const options = shuffle([correct, ...shuffle(others).slice(0, 2)]);
  return { options, answer: options.indexOf(correct) };
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
