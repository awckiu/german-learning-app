"""Small ElevenLabs client shared by the pipeline scripts (standard library only)."""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.elevenlabs.io/v1"
MODEL = "eleven_multilingual_v2"
HERE = Path(__file__).resolve().parent


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


def request(key: str, path: str, body: dict | None = None, retries: int = 4) -> bytes:
    """GET (no body) or POST (JSON body). Retries rate limits and server errors with backoff."""
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        method="POST" if body else "GET",
    )
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if (e.code == 429 or e.code >= 500) and attempt < retries:
                time.sleep(2 ** (attempt + 1))
                continue
            sys.exit(f"ElevenLabs error {e.code} on {path}: {e.read().decode(errors='replace')}")
        except urllib.error.URLError as e:
            if attempt < retries:
                time.sleep(2 ** (attempt + 1))
                continue
            sys.exit(f"Could not reach ElevenLabs ({e.reason}). Check your internet connection.")
    raise AssertionError("unreachable")


def speak(key: str, voice_id: str, text: str) -> bytes:
    return request(
        key,
        f"/text-to-speech/{voice_id}?output_format=mp3_44100_128",
        {"text": text, "model_id": MODEL},
    )


def slug(text: str) -> str:
    text = text.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:40]
