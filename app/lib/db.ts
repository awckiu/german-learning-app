import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'deutsch.db';

// Each entry upgrades the schema by one version. Never edit an entry once it
// has shipped: add a new one instead.
const migrations = [
  `
  CREATE TABLE words (
    rank INTEGER PRIMARY KEY NOT NULL,
    word TEXT NOT NULL,
    article TEXT,
    sentence TEXT,
    audio TEXT NOT NULL,
    sentence_audio_sarah TEXT,
    sentence_audio_lennard TEXT
  );

  -- A card exists once a word has been introduced. Dates are epoch milliseconds.
  CREATE TABLE cards (
    word_rank INTEGER PRIMARY KEY NOT NULL REFERENCES words(rank),
    due INTEGER NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    elapsed_days INTEGER NOT NULL,
    scheduled_days INTEGER NOT NULL,
    learning_steps INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    lapses INTEGER NOT NULL,
    state INTEGER NOT NULL,
    last_review INTEGER,
    introduced_at INTEGER NOT NULL
  );
  CREATE INDEX cards_due ON cards(due);
  CREATE INDEX cards_introduced_at ON cards(introduced_at);

  CREATE TABLE review_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_rank INTEGER NOT NULL REFERENCES words(rank),
    rating INTEGER NOT NULL,
    state INTEGER NOT NULL,
    due INTEGER NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    elapsed_days INTEGER NOT NULL,
    last_elapsed_days INTEGER NOT NULL,
    scheduled_days INTEGER NOT NULL,
    learning_steps INTEGER NOT NULL,
    review INTEGER NOT NULL
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < migrations.length) {
    const sql = migrations[version];
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

export type SettingKey =
  | 'ingest_folder' // content:// URI of the GermanAppIngest folder the user picked
  | 'audio_bank_stamp' // size and modification time of the last imported manifest.json
  | 'new_words_per_day';

export async function getSetting(db: SQLiteDatabase, key: SettingKey) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: SettingKey, value: string) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
