import type { SQLiteDatabase } from 'expo-sqlite';
import { type Card, createEmptyCard, fsrs, type Grade, Rating, State } from 'ts-fsrs';

import { getSetting } from '@/lib/db';

export const DEFAULT_NEW_WORDS_PER_DAY = 10;

// Learning steps are minutes apart, so a session shows a card again if it
// comes due within this window instead of ending early.
const LEARN_AHEAD_MS = 20 * 60 * 1000;

const scheduler = fsrs({ enable_fuzz: true });

export type Word = {
  rank: number;
  word: string;
  article: string | null;
  sentence: string | null;
  audio: string;
  sentence_audio_sarah: string | null;
  sentence_audio_lennard: string | null;
};

type CardRow = {
  word_rank: number;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: number | null;
};

export type ReviewItem = { word: Word; card: Card; isNew: boolean };

function startOfToday(now: Date) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfToday(now: Date) {
  return startOfToday(now) + 24 * 60 * 60 * 1000;
}

async function newWordsLeftToday(db: SQLiteDatabase, now: Date) {
  const perDay = Number((await getSetting(db, 'new_words_per_day')) ?? DEFAULT_NEW_WORDS_PER_DAY);
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM cards WHERE introduced_at >= ?',
    startOfToday(now),
  );
  return Math.max(0, perDay - (row?.n ?? 0));
}

/** Cards to do today: reviews due before midnight plus today's new words. */
export async function countDueToday(db: SQLiteDatabase, now = new Date()) {
  const due = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM cards WHERE due < ?', endOfToday(now));
  const unseen = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM words WHERE rank NOT IN (SELECT word_rank FROM cards)',
  );
  const newLeft = Math.min(await newWordsLeftToday(db, now), unseen?.n ?? 0);
  return { reviews: due?.n ?? 0, newWords: newLeft, total: (due?.n ?? 0) + newLeft };
}

export async function countWords(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM words');
  return row?.n ?? 0;
}

/**
 * The next card to show: a due review first, then a new word (most frequent
 * first) while today's allowance lasts, then a learning card due soon.
 * Returns null when the session is done.
 */
export async function nextReviewItem(db: SQLiteDatabase, now = new Date()): Promise<ReviewItem | null> {
  const select = `
    SELECT w.*, c.word_rank, c.due, c.stability, c.difficulty, c.elapsed_days, c.scheduled_days,
           c.learning_steps, c.reps, c.lapses, c.state, c.last_review
    FROM cards c JOIN words w ON w.rank = c.word_rank
    WHERE c.due <= ? OR (c.state = ${State.Review} AND c.due < ?) ORDER BY c.due LIMIT 1`;

  // Reviews are scheduled in days, so any review due today counts as due now.
  const due = await db.getFirstAsync<Word & CardRow>(select, now.getTime(), endOfToday(now));
  if (due) return { word: due, card: toCard(due), isNew: false };

  if ((await newWordsLeftToday(db, now)) > 0) {
    const word = await db.getFirstAsync<Word>(
      'SELECT * FROM words WHERE rank NOT IN (SELECT word_rank FROM cards) ORDER BY rank LIMIT 1',
    );
    if (word) return { word, card: createEmptyCard(now), isNew: true };
  }

  const soon = await db.getFirstAsync<Word & CardRow>(select, now.getTime() + LEARN_AHEAD_MS, 0);
  if (soon) return { word: soon, card: toCard(soon), isNew: false };
  return null;
}

/** Schedules the card with FSRS and saves the card and its review log. */
export async function rate(db: SQLiteDatabase, item: ReviewItem, grade: Grade, now = new Date()) {
  const { card, log } = scheduler.next(item.card, now, grade);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO cards (word_rank, due, stability, difficulty, elapsed_days, scheduled_days,
                          learning_steps, reps, lapses, state, last_review, introduced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(word_rank) DO UPDATE SET
         due = excluded.due, stability = excluded.stability, difficulty = excluded.difficulty,
         elapsed_days = excluded.elapsed_days, scheduled_days = excluded.scheduled_days,
         learning_steps = excluded.learning_steps, reps = excluded.reps, lapses = excluded.lapses,
         state = excluded.state, last_review = excluded.last_review`,
      item.word.rank,
      card.due.getTime(),
      card.stability,
      card.difficulty,
      card.elapsed_days,
      card.scheduled_days,
      card.learning_steps,
      card.reps,
      card.lapses,
      card.state,
      card.last_review?.getTime() ?? null,
      now.getTime(),
    );
    await db.runAsync(
      `INSERT INTO review_log (word_rank, rating, state, due, stability, difficulty, elapsed_days,
                               last_elapsed_days, scheduled_days, learning_steps, review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.word.rank,
      log.rating,
      log.state,
      log.due.getTime(),
      log.stability,
      log.difficulty,
      log.elapsed_days,
      log.last_elapsed_days,
      log.scheduled_days,
      log.learning_steps,
      log.review.getTime(),
    );
  });
}

/** Sentence audio alternates between Sarah and Lennard from one review to the next. */
export function sentenceAudio(item: ReviewItem) {
  const { sentence_audio_sarah: sarah, sentence_audio_lennard: lennard } = item.word;
  return item.card.reps % 2 === 0 ? (sarah ?? lennard) : (lennard ?? sarah);
}

function toCard(row: CardRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review === null ? undefined : new Date(row.last_review),
  };
}

/** When each grade would show the card next, e.g. "10m" or "3d", for the rating buttons. */
export function nextIntervals(item: ReviewItem, now = new Date()): Record<Grade, string> {
  const preview = scheduler.repeat(item.card, now);
  const label = (grade: Grade) => {
    const minutes = Math.max(1, Math.round((preview[grade].card.due.getTime() - now.getTime()) / 60000));
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
    const days = Math.round(minutes / (24 * 60));
    if (days < 31) return `${days}d`;
    return days < 365 ? `${Math.round(days / 30)}mo` : `${(days / 365).toFixed(1)}y`;
  };
  return {
    [Rating.Again]: label(Rating.Again),
    [Rating.Hard]: label(Rating.Hard),
    [Rating.Good]: label(Rating.Good),
    [Rating.Easy]: label(Rating.Easy),
  };
}
