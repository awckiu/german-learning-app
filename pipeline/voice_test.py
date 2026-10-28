"""Generate ~20 German test words in 2-3 ElevenLabs voices so Andrea can pick one.

Usage (Windows):  py voice_test.py
Optional:         py voice_test.py --voices "Name A" "Name B" "Name C"

Reads ELEVENLABS_API_KEY from the environment or from pipeline/.env.
Writes voice_test_output/index.html with a player per word and voice.
Cost: about 250 characters per voice, so under 1,000 credits for 3 voices.
"""

import argparse
import html
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.elevenlabs.io/v1"
MODEL = "eleven_multilingual_v2"
HERE = Path(__file__).resolve().parent
OUT = HERE / "voice_test_output"

# Common words plus tricky German sounds (ü, ö, ch, ß, -chen), and two short sentences.
SAMPLES = [
    "der Hund",
    "die Katze",
    "das Haus",
    "Guten Morgen!",
    "Tschüss!",
    "Wie geht's?",
    "das Brötchen",
    "das Mädchen",
    "schön",
    "über",
    "die Straße",
    "ich",
    "acht",
    "zwanzig",
    "das Eichhörnchen",
    "der Bahnhof",
    "die Hölle",
    "die Hülle",
    "Ich heiße Nico und ich komme aus Spanien.",
    "Entschuldigung, wie sagt man das auf Deutsch?",
]


def load_key() -> str:
    key = os.environ.get("ELEVENLABS_API_KEY")
    env_file = HERE / ".env"
    if not key and env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("ELEVENLABS_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"')
    if not key:
        sys.exit("Missing ELEVENLABS_API_KEY. Put it in pipeline/.env (see .env.example).")
    return key


def request(key: str, path: str, body: dict | None = None) -> bytes:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        method="POST" if body else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs error {e.code} on {path}: {e.read().decode(errors='replace')}")
    except urllib.error.URLError as e:
        sys.exit(f"Could not reach ElevenLabs ({e.reason}). Check your internet connection.")


def pick_voices(key: str, wanted: list[str]) -> list[dict]:
    voices = json.loads(request(key, "/voices"))["voices"]
    if wanted:
        by_name = {v["name"].lower(): v for v in voices}
        missing = [w for w in wanted if w.lower() not in by_name]
        if missing:
            names = ", ".join(sorted(v["name"] for v in voices))
            sys.exit(f"Voices not found: {missing}. Available: {names}")
        return [by_name[w.lower()] for w in wanted]

    # Prefer voices labelled German, then fill up with the account's other voices.
    def is_german(v: dict) -> bool:
        labels = json.dumps(v.get("labels") or {}).lower()
        return "german" in labels or "deutsch" in labels or "german" in v["name"].lower()

    return sorted(voices, key=lambda v: not is_german(v))[:3]


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--voices", nargs="*", default=[], help="Voice names from your ElevenLabs account")
    args = parser.parse_args()

    key = load_key()
    voices = pick_voices(key, args.voices)
    print("Voices:", ", ".join(v["name"] for v in voices))

    rows = []
    for i, text in enumerate(SAMPLES):
        cells = []
        for v in voices:
            folder = OUT / slug(v["name"])
            folder.mkdir(parents=True, exist_ok=True)
            mp3 = folder / f"{i:02d}-{slug(text)}.mp3"
            if not mp3.exists():
                audio = request(
                    key,
                    f"/text-to-speech/{v['voice_id']}?output_format=mp3_44100_128",
                    {"text": text, "model_id": MODEL},
                )
                mp3.write_bytes(audio)
            cells.append(f'<td><audio controls preload="none" src="{mp3.relative_to(OUT).as_posix()}"></audio></td>')
        rows.append(f"<tr><th>{html.escape(text)}</th>{''.join(cells)}</tr>")
        print(f"  {i + 1}/{len(SAMPLES)} {text}")

    head = "".join(f"<th>{html.escape(v['name'])}</th>" for v in voices)
    page = f"""<!doctype html><meta charset="utf-8"><title>Voice test</title>
<style>body{{background:#121214;color:#F2F2F5;font:16px system-ui;padding:16px}}
th{{text-align:left;padding:6px 12px}}td{{padding:6px}}</style>
<h1>Voice test</h1><table><tr><th></th>{head}</tr>{''.join(rows)}</table>"""
    (OUT / "index.html").write_text(page, encoding="utf-8")
    print(f"Done. Open {OUT / 'index.html'} in your browser.")


if __name__ == "__main__":
    main()
