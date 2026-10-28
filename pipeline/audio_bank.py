"""Build the ElevenLabs audio bank from data/word_list.tsv.

Each word (with its article, e.g. "der Hund") is spoken by Sarah.
Each example sentence is spoken by both Sarah and Lennard.

Usage (Windows, from the pipeline folder):
    py audio_bank.py --sample 50     # spot check: 50 entries spread across the list
    py audio_bank.py                 # full run (asks before spending credits)

Files already generated are skipped, so the script can be stopped and re-run
at any time. Output goes to output/audio_bank/ with a manifest.json for the app
and an index.html to listen through the results.
"""

import argparse
import csv
import html
import json
import sys
from dataclasses import dataclass

from elevenlabs import HERE, load_key, slug, speak

WORD_LIST = HERE / "data" / "word_list.tsv"
OUT = HERE / "output" / "audio_bank"

# Chosen by Andrea after the voice test (Oct 2026).
WORD_VOICE = "sarah"
VOICES = {
    "sarah": "EXAVITQu4vr4xnSDxMaL",  # Sarah - Mature, Reassuring, Confident
    "lennard": "HNYELfQMgCeL9N0RGyxo",  # Lennard - Warm & Trustworthy (native German)
}
SENTENCE_VOICES = ["sarah", "lennard"]

# Stay under the ~129k credits left on the one-off ElevenLabs grant.
DEFAULT_BUDGET = 125_000


@dataclass
class Clip:
    rank: int
    kind: str  # "word" or "sentence"
    voice: str
    text: str

    @property
    def path(self):
        folder = "words" if self.kind == "word" else f"sentences/{self.voice}"
        return OUT / folder / f"{self.rank:04d}-{slug(self.text)}.mp3"


def load_entries() -> list[dict]:
    with open(WORD_LIST, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def spoken_word(entry: dict) -> str:
    return f"{entry['article']} {entry['word']}".strip()


def clips_for(entries: list[dict]) -> list[Clip]:
    clips = []
    for e in entries:
        rank = int(e["rank"])
        clips.append(Clip(rank, "word", WORD_VOICE, spoken_word(e)))
        if e["sentence"]:
            for voice in SENTENCE_VOICES:
                clips.append(Clip(rank, "sentence", voice, e["sentence"]))
    return clips


def pick_sample(entries: list[dict], n: int) -> list[dict]:
    """Every k-th entry, so the sample covers common and rarer words, nouns and verbs."""
    step = max(1, len(entries) // n)
    return entries[::step][:n]


def write_outputs(entries: list[dict]) -> None:
    rel = lambda clip: clip.path.relative_to(OUT).as_posix()  # noqa: E731
    manifest, rows = {}, []
    for e in entries:
        rank = int(e["rank"])
        word = Clip(rank, "word", WORD_VOICE, spoken_word(e))
        sentences = {v: Clip(rank, "sentence", v, e["sentence"]) for v in SENTENCE_VOICES} if e["sentence"] else {}
        if not word.path.exists():
            continue
        manifest[e["word"]] = {
            "rank": rank,
            "article": e["article"] or None,
            "audio": rel(word),
            "sentence": e["sentence"] or None,
            "sentence_audio": {v: rel(c) for v, c in sentences.items() if c.path.exists()},
        }
        players = "".join(
            f'<td><audio controls preload="none" src="{rel(c)}"></audio></td>' if c.path.exists() else "<td></td>"
            for c in [word, *sentences.values()]
        )
        rows.append(
            f"<tr><td>{rank}</td><th>{html.escape(spoken_word(e))}</th>"
            f"<td>{html.escape(e['sentence'])}</td>{players}</tr>"
        )

    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    head = "<th>#</th><th>Word</th><th>Sentence</th><th>Word (Sarah)</th>" + "".join(
        f"<th>Sentence ({v.title()})</th>" for v in SENTENCE_VOICES
    )
    page = f"""<!doctype html><meta charset="utf-8"><title>Audio bank</title>
<style>body{{background:#121214;color:#F2F2F5;font:16px system-ui;padding:16px}}
th,td{{text-align:left;padding:4px 10px}}audio{{height:32px}}</style>
<h1>Audio bank</h1><p>{len(rows)} entries</p><table><tr>{head}</tr>{''.join(rows)}</table>"""
    (OUT / "index.html").write_text(page, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the ElevenLabs audio bank.")
    parser.add_argument("--sample", type=int, help="Only generate N entries spread across the list")
    parser.add_argument("--budget", type=int, default=DEFAULT_BUDGET, help="Max characters to spend this run")
    parser.add_argument("--yes", action="store_true", help="Don't ask for confirmation")
    args = parser.parse_args()

    entries = load_entries()
    if args.sample:
        entries = pick_sample(entries, args.sample)

    todo = [c for c in clips_for(entries) if not c.path.exists()]
    chars = sum(len(c.text) for c in todo)
    print(f"{len(entries)} entries, {len(todo)} clips to generate, about {chars:,} credits.")
    if not todo:
        write_outputs(entries)
        print(f"Nothing to do. Listen at {OUT / 'index.html'}")
        return
    if chars > args.budget:
        sys.exit(f"That is over the budget of {args.budget:,} credits. Use --budget to raise it.")
    if not args.yes and input("Go ahead? [y/N] ").strip().lower() != "y":
        sys.exit("Stopped. Nothing was spent.")

    key = load_key()
    spent = 0
    for i, clip in enumerate(todo, 1):
        clip.path.parent.mkdir(parents=True, exist_ok=True)
        clip.path.write_bytes(speak(key, VOICES[clip.voice], clip.text))
        spent += len(clip.text)
        if i % 25 == 0 or i == len(todo):
            print(f"  {i}/{len(todo)} clips, ~{spent:,} credits")
            write_outputs(entries)

    print(f"Done. Listen at {OUT / 'index.html'}")


if __name__ == "__main__":
    main()
