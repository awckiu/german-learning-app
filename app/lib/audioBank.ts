import { Directory, File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/lib/db';

// One entry of output/audio_bank/manifest.json, written by pipeline/audio_bank.py.
// Paths are relative to the audio_bank folder.
type ManifestEntry = {
  rank: number;
  article: string | null;
  audio: string;
  sentence: string | null;
  sentence_audio: { sarah?: string; lennard?: string };
};

const AUDIO_FOLDERS = ['words', 'sentences/sarah', 'sentences/lennard'];

export type ImportResult =
  | { status: 'no-folder' }
  | { status: 'missing-bank' }
  | { status: 'unchanged' }
  | { status: 'imported'; words: number };

/** Asks Android for the GermanAppIngest folder (once) and remembers it. */
export async function pickIngestFolder(db: SQLiteDatabase) {
  const folder = await Directory.pickDirectoryAsync();
  await setSetting(db, 'ingest_folder', folder.uri);
  // A new folder means the old file URIs no longer apply.
  await setSetting(db, 'audio_bank_stamp', '');
}

/**
 * Loads the audio bank from the synced folder into the words table.
 * Does nothing when manifest.json has not changed since the last import.
 */
export async function importAudioBank(db: SQLiteDatabase): Promise<ImportResult> {
  const folderUri = await getSetting(db, 'ingest_folder');
  if (!folderUri) return { status: 'no-folder' };

  const root = new Directory(folderUri);
  // Accept either GermanAppIngest itself or its audio_bank subfolder.
  const bank = nameOf(root.uri) === 'audio_bank' ? root : child(root, 'audio_bank');
  const manifestUri = bank && listFiles(bank).get('manifest.json');
  if (!bank || !manifestUri) return { status: 'missing-bank' };

  const text = await new File(manifestUri).text();
  const stamp = hash(text);
  if (stamp === (await getSetting(db, 'audio_bank_stamp'))) return { status: 'unchanged' };
  const manifest: Record<string, ManifestEntry> = JSON.parse(text);

  // Folder URIs from Android's picker can't be joined with a relative path,
  // so list each audio folder once and look files up by their relative path.
  const uris = new Map<string, string>();
  for (const path of AUDIO_FOLDERS) {
    const dir = path.split('/').reduce<Directory | null>((d, name) => d && child(d, name), bank);
    if (!dir) continue;
    for (const [name, uri] of listFiles(dir)) uris.set(`${path}/${name}`, uri);
  }

  let words = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const upsert = await txn.prepareAsync(`
      INSERT INTO words (rank, word, article, sentence, audio, sentence_audio_sarah, sentence_audio_lennard)
      VALUES ($rank, $word, $article, $sentence, $audio, $sarah, $lennard)
      ON CONFLICT(rank) DO UPDATE SET
        word = excluded.word, article = excluded.article, sentence = excluded.sentence, audio = excluded.audio,
        sentence_audio_sarah = excluded.sentence_audio_sarah, sentence_audio_lennard = excluded.sentence_audio_lennard
    `);
    try {
      for (const [word, entry] of Object.entries(manifest)) {
        const audio = uris.get(entry.audio);
        if (!audio) continue;
        const sentenceAudio = (voice: 'sarah' | 'lennard') => {
          const path = entry.sentence_audio[voice];
          return (path && uris.get(path)) ?? null;
        };
        await upsert.executeAsync({
          $rank: entry.rank,
          $word: word,
          $article: entry.article,
          $sentence: entry.sentence,
          $audio: audio,
          $sarah: sentenceAudio('sarah'),
          $lennard: sentenceAudio('lennard'),
        });
        words += 1;
      }
    } finally {
      await upsert.finalizeAsync();
    }
  });
  await setSetting(db, 'audio_bank_stamp', stamp);
  return { status: 'imported', words };
}

// Works for file:// and Android content:// URIs, where the path is percent-encoded.
function nameOf(uri: string) {
  return decodeURIComponent(uri).replace(/\/+$/, '').split('/').pop() ?? '';
}

function child(dir: Directory, name: string) {
  const record = dir.listAsRecords().find((r) => r.isDirectory && nameOf(r.uri) === name);
  return record ? new Directory(record.uri) : null;
}

function listFiles(dir: Directory) {
  const files = new Map<string, string>();
  for (const r of dir.listAsRecords()) if (!r.isDirectory) files.set(nameOf(r.uri), r.uri);
  return files;
}

// Cheap fingerprint (FNV-1a) so an unchanged manifest is not re-imported.
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${text.length}:${(h >>> 0).toString(16)}`;
}
