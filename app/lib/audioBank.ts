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

const AUDIO_FOLDERS = ['words', 'sentences/sarah', 'sentences/lennard', 'forms'];

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

  let resolve = directPaths(folderUri);
  let manifestFile = fileAt(resolve, 'manifest.json');
  if (!manifestFile) {
    // Not a plain shared-storage folder: fall back to listing (slow, but rare).
    resolve = await listedPaths(folderUri);
    manifestFile = fileAt(resolve, 'manifest.json');
  }
  if (!resolve || !manifestFile) return { status: 'missing-bank' };

  const text = await manifestFile.text();
  // forms.json (optional) maps word forms such as "bin" to clips in forms/.
  const formsFile = fileAt(resolve, 'forms.json');
  const formsText = formsFile ? await formsFile.text() : '{}';
  const stamp = `${hash(text)}+${hash(formsText)}`;
  if (stamp === (await getSetting(db, 'audio_bank_stamp'))) return { status: 'unchanged' };
  const manifest: Record<string, ManifestEntry> = JSON.parse(text);
  const forms: Record<string, string> = JSON.parse(formsText);
  const uris = { get: (path: string) => resolve(path) };

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
    await txn.runAsync('DELETE FROM word_forms');
    for (const [form, path] of Object.entries(forms)) {
      const audio = uris.get(path);
      if (audio) await txn.runAsync('INSERT OR REPLACE INTO word_forms (form, audio) VALUES (?, ?)', form.toLowerCase(), audio);
    }
  });
  await setSetting(db, 'audio_bank_stamp', stamp);
  return { status: 'imported', words };
}

// The picker returns a tree URI such as
// content://com.android.externalstorage.documents/tree/primary%3AGermanAppIngest.
// Each file inside it has a document URI built from its path, so files can be
// found without listing folders, which takes minutes for thousands of files.
const EXTERNAL_TREE = /^(content:\/\/com\.android\.externalstorage\.documents\/tree\/([^/]+))/;

function directPaths(folderUri: string): Resolve | null {
  const match = EXTERNAL_TREE.exec(folderUri);
  if (!match) return null;
  const [, tree, treeId] = match;
  const rootDoc = decodeURIComponent(treeId);
  // Accept either GermanAppIngest itself or its audio_bank subfolder.
  const bankDoc = rootDoc.replace(/\/+$/, '').split(/[/:]/).pop() === 'audio_bank' ? rootDoc : `${rootDoc}/audio_bank`;
  return (path) => `${tree}/document/${encodeURIComponent(`${bankDoc}/${path}`)}`;
}

type Resolve = (path: string) => string | null;

function fileAt(resolve: Resolve | null, path: string) {
  const uri = resolve?.(path);
  if (!uri) return null;
  try {
    const file = new File(uri);
    return file.exists ? file : null;
  } catch {
    return null;
  }
}

// Fallback for other storage providers: list each folder once.
async function listedPaths(folderUri: string): Promise<Resolve | null> {
  const root = new Directory(folderUri);
  const bank = nameOf(root.uri) === 'audio_bank' ? root : child(root, 'audio_bank');
  if (!bank) return null;
  const uris = new Map<string, string>(listFiles(bank));
  for (const path of AUDIO_FOLDERS) {
    const dir = path.split('/').reduce<Directory | null>((d, name) => d && child(d, name), bank);
    if (!dir) continue;
    for (const [name, uri] of listFiles(dir)) uris.set(`${path}/${name}`, uri);
  }
  return (path) => uris.get(path) ?? null;
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
