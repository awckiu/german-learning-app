"""Turn German videos into lesson packages for the app (step 3).

For each new episode in sources.json:
    download (yt-dlp) -> transcribe with word timings (faster-whisper)
    -> label speakers (pyannote, only if HF_TOKEN is set)
    -> split into scenes, match course lessons, pick focus words, write cards (Claude Code)
    -> cut clips and stills (ffmpeg) -> write packages to output/lessons/

The package format is plan/lesson-format.md. Usage (Windows, from the pipeline folder):
    py process_media.py --max-episodes 5     # test batch
    py process_media.py                      # weekly run (Task Scheduler)

Every stage saves its result under work/, so a stopped run picks up where it left off.
"""

import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

from elevenlabs import HERE

SOURCES = HERE / "sources.json"
COURSE = HERE / "data" / "course.json"
WORD_LIST = HERE / "data" / "word_list.tsv"
WORK = HERE / "work"
LESSONS = HERE / "output" / "lessons"

WHISPER_MODEL = "large-v3-turbo"
DIARIZATION_MODEL = "pyannote/speaker-diarization-3.1"
MIN_SCENE, MAX_SCENE = 30.0, 150.0  # seconds
DEFAULT_BUFFER = 50
DEFAULT_MAX_EPISODES = 10


# ---------- helpers ----------

def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, capture_output=True, text=True, encoding="utf-8", **kw)


def tool(name: str) -> str:
    path = shutil.which(name)
    if not path:
        sys.exit(f"{name} is not installed or not on PATH. Restart the terminal after installing it.")
    return path


def read_json(path: Path, default=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def env_value(name: str) -> str | None:
    value = os.environ.get(name)
    env_file = HERE / ".env"
    if not value and env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith(f"{name}="):
                value = line.split("=", 1)[1].strip().strip('"')
    return value or None


def nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text)


def bare(token: str) -> str:
    """A transcript token without punctuation: 'Nico.' -> 'Nico'."""
    return re.sub(r"^[^\w]+|[^\w]+$", "", token)


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


# ---------- course and word list ----------

def load_course() -> dict[str, str]:
    """Lesson id -> title, without Breakthrough Lessons (the app builds those)."""
    course = read_json(COURSE)
    return {
        lesson["id"]: f"{level['theme']}: {lesson['title']}"
        for level in course["levels"]
        for lesson in level["lessons"]
        if not lesson.get("breakthrough")
    }


def load_ranks() -> dict[str, int]:
    ranks = {}
    with open(WORD_LIST, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            ranks.setdefault(row["word"], int(row["rank"]))
            ranks.setdefault(row["word"].lower(), int(row["rank"]))
    return ranks


def lemmatize(token: str) -> str:
    """Fallback when Claude's lemma for a word is missing."""
    import simplemma

    return simplemma.lemmatize(token, lang="de")


# ---------- stages ----------

def list_episodes(source: dict) -> list[dict]:
    if not source.get("url"):
        sys.exit(f"Source {source['id']} has no url in sources.json.")
    out = run([tool("yt-dlp"), "--flat-playlist", "-J", source["url"]]).stdout
    entries = json.loads(out).get("entries") or []
    first = source.get("first", 1)
    last = source.get("last", len(entries))
    return [
        {"index": i - first + 1, "id": e["id"], "title": e.get("title") or "", "url": e.get("url") or e.get("webpage_url")}
        for i, e in enumerate(entries, 1)
        if first <= i <= last
    ]


def download(episode: dict, folder: Path) -> Path:
    video = folder / "source.mp4"
    if not video.exists():
        print("  downloading")
        run([
            tool("yt-dlp"), "-f", "bv*[height<=720]+ba/b[height<=720]/b",
            "--merge-output-format", "mp4", "-o", str(folder / "source.%(ext)s"), episode["url"],
        ])
    audio = folder / "audio.wav"
    if not audio.exists():
        run([tool("ffmpeg"), "-y", "-i", str(video), "-ac", "1", "-ar", "16000", str(audio)])
    return video


def transcribe(folder: Path) -> list[dict]:
    path = folder / "transcript.json"
    if path.exists():
        return read_json(path)
    print("  transcribing (this takes about as long as the video)")
    from faster_whisper import WhisperModel

    model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(
        str(folder / "audio.wav"), language="de", word_timestamps=True, vad_filter=True, beam_size=5
    )
    result = [
        {
            "start": round(s.start, 2),
            "end": round(s.end, 2),
            "text": nfc(s.text.strip()),
            "words": [{"w": nfc(w.word.strip()), "start": round(w.start, 2), "end": round(w.end, 2)} for w in s.words],
        }
        for s in segments
    ]
    write_json(path, result)
    return result


def diarize(folder: Path, segments: list[dict]) -> None:
    """Adds a 'speaker' label (e.g. SPEAKER_00) to each segment, if HF_TOKEN is set."""
    path = folder / "speakers.json"
    if not path.exists():
        token = env_value("HF_TOKEN")
        if not token:
            return
        print("  labelling speakers")
        from pyannote.audio import Pipeline

        try:
            pipeline = Pipeline.from_pretrained(DIARIZATION_MODEL, token=token)
        except TypeError:  # pyannote 3.x
            pipeline = Pipeline.from_pretrained(DIARIZATION_MODEL, use_auth_token=token)
        output = pipeline(str(folder / "audio.wav"))
        annotation = getattr(output, "speaker_diarization", output)
        turns = [[t.start, t.end, label] for t, _, label in annotation.itertracks(yield_label=True)]
        write_json(path, turns)
    turns = read_json(path)
    for seg in segments:
        overlap: dict[str, float] = {}
        for start, end, label in turns:
            shared = min(end, seg["end"]) - max(start, seg["start"])
            if shared > 0:
                overlap[label] = overlap.get(label, 0) + shared
        seg["speaker"] = max(overlap, key=overlap.get) if overlap else None


PROMPT = """You are preparing lessons for a German learning app for an English-speaking beginner.
The app is German only (comprehensible input). Below is the transcript of one episode of "{title}" ({cefr}).

Course lessons the scenes can be matched to (id: theme: lesson):
{lessons}

Transcript segments ([index] start-end speaker: text). Each segment's words are listed as a JSON array:
{segments}

Split the episode into scenes of {min_s:.0f} to {max_s:.0f} seconds (aim for 60 to 120) of consecutive segments that
each fit ONE course lesson clearly: the people are doing what the lesson is about (e.g. introducing themselves ->
the introducing lesson). Only match a lesson when a teacher would agree it is a good example; a loose fit is worse
than no scene. Skip parts that fit no lesson, such as intros, outros, credits or narration about the course.
Scenes must contain no English: place scene boundaries so that lines spoken in English fall outside every scene.
It's fine to return no scenes at all.

The transcript comes from speech recognition and has mistakes. Where a word is clearly misheard, correct it in
"fixes" (only when you are confident from the context; leave names and streets you can't verify as they are).

Reply with JSON only, no prose, in this shape:
{{
 "speakers": {{"SPEAKER_00": "Nico"}},
 "names": ["Nico"],
 "scenes": [
  {{
   "first": 3, "last": 11, "lesson": "L1.4",
   "focus": ["heißen", "kommen"],
   "fixes": {{"5": ["Du", "willst", "zu", "deiner", "Tante"]}},
   "lemmas": {{"3": ["hallo", "ich", "heißen", null]}},
   "glosses": {{"3": ["hello", "I", "am called", "Nico"]}},
   "cards": [
    {{"type": "explain", "title": "Sich vorstellen", "body": "Ich heiße ... / Ich bin ...", "hint": "Two ways to say your name.", "segments": [0, 2]}},
    {{"type": "listen", "segment": 0, "question": "Wie heißt er?", "options": ["Nico", "Selma", "Lisa"], "answer": 0}},
    {{"type": "fill", "segment": 0, "text": "Ich ___ Nico.", "options": ["heiße", "heißt", "heißen"], "answer": 0}}
   ]
  }}
 ]
}}

Rules:
- "speakers" maps the speaker labels to the character's first name when the transcript makes it clear; leave others out.
- "names" lists every person's name that appears in the transcript.
- "first"/"last" are segment indexes from the transcript above (inclusive).
- "focus": 3 to 8 dictionary forms (infinitive, singular noun without article) that the scene teaches and that a beginner can learn from it.
- "fixes": only for segments with a misheard word: the segment's corrected word array, same count as the original,
  one corrected word per original word, without punctuation. Lemmas and glosses describe the corrected words.
- "lemmas": for EVERY segment index in the scene, the dictionary form of each word in that segment's word array, same
  order and same count (infinitive for verbs, nominative singular for nouns, capitalised as in a dictionary), null for names.
- "glosses": for EVERY segment index in the scene, one short English gloss per word in that segment's word array, same order and same count, meaning of the word in that sentence.
- "cards": 3 to 5 cards, written in simple German. The only English allowed is "hint": one optional short English line on an explain card. "segment"/"segments" in cards count from 0 = the scene's first segment. "answer" is an index into "options".
"""


def plan_scenes(folder: Path, episode: dict, source: dict, segments: list[dict], course: dict[str, str]) -> dict:
    path = folder / "plan.json"
    if path.exists():
        return read_json(path)
    print("  sorting scenes into lessons (Claude Code)")
    lines = [
        f"[{i}] {s['start']:.1f}-{s['end']:.1f} {s.get('speaker') or '?'}: {s['text']}\n"
        f"    {json.dumps([w['w'] for w in s['words']], ensure_ascii=False)}"
        for i, s in enumerate(segments)
    ]
    prompt = PROMPT.format(
        title=episode["title"] or source["name"],
        cefr=source["cefr"],
        lessons="\n".join(f"{k}: {v}" for k, v in course.items()),
        segments="\n".join(lines),
        min_s=MIN_SCENE,
        max_s=MAX_SCENE,
    )
    out = run([tool("claude"), "-p", "--output-format", "json"], input=prompt, timeout=1800).stdout
    text = json.loads(out)["result"]
    plan = json.loads(text[text.index("{"): text.rindex("}") + 1])
    write_json(path, plan)
    return plan


def valid_scenes(plan: dict, segments: list[dict], course: dict[str, str]) -> list[dict]:
    scenes = []
    for sc in plan.get("scenes", []):
        first, last = sc.get("first"), sc.get("last")
        if not (isinstance(first, int) and isinstance(last, int) and 0 <= first <= last < len(segments)):
            continue
        length = segments[last]["end"] - segments[first]["start"]
        if sc.get("lesson") not in course or not MIN_SCENE <= length <= MAX_SCENE:
            print(f"  skipped scene {first}-{last}: lesson {sc.get('lesson')}, {length:.0f} s")
            continue
        scenes.append(sc)
    return scenes


def build_package(pkg_id: str, order: int, scene: dict, plan: dict, episode: dict, source: dict,
                  segments: list[dict], video: Path, ranks: dict[str, int]) -> None:
    first, last = scene["first"], scene["last"]
    offset = max(0.0, segments[first]["start"] - 0.3)
    end = segments[last]["end"] + 0.3
    tmp = WORK / "packages" / pkg_id
    shutil.rmtree(tmp, ignore_errors=True)
    (tmp / "stills").mkdir(parents=True)

    run([
        tool("ffmpeg"), "-y", "-ss", f"{offset:.2f}", "-to", f"{end:.2f}", "-i", str(video),
        "-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(tmp / "clip.mp4"),
    ])

    names = {n.lower() for n in plan.get("names", [])}
    labels, speakers = {}, []
    out_segments = []
    for i in range(first, last + 1):
        seg = segments[i]
        label = seg.get("speaker")
        if label and label not in labels:
            labels[label] = f"S{len(labels) + 1}"
            speakers.append({"id": labels[label], "name": plan.get("speakers", {}).get(label) or f"Sprecher {len(labels)}"})
        fixes = scene.get("fixes", {}).get(str(i)) or []
        if len(fixes) != len(seg["words"]):
            fixes = []
        text = seg["text"]
        for w, fixed in zip(seg["words"], fixes):
            if fixed and bare(w["w"]) and fixed != bare(w["w"]):
                text = text.replace(bare(w["w"]), fixed, 1)
        glosses = scene.get("glosses", {}).get(str(i)) or []
        if len(glosses) != len(seg["words"]):
            glosses = []
        lemmas = scene.get("lemmas", {}).get(str(i)) or []
        if len(lemmas) != len(seg["words"]):
            lemmas = []
        words = []
        for j, w in enumerate(seg["words"]):
            token = fixes[j] if fixes and fixes[j] else bare(w["w"])
            is_name = token.lower() in names
            lemma = None if is_name else (lemmas[j] if lemmas and lemmas[j] else lemmatize(token))
            if not token:
                continue
            word = {
                "w": token,
                "start": round(w["start"] - offset, 2),
                "end": round(w["end"] - offset, 2),
                "lemma": lemma,
                "rank": None if lemma is None else ranks.get(lemma, ranks.get(lemma.lower())),
            }
            if is_name:
                word["name"] = True
            if glosses and not is_name:
                word["gloss"] = glosses[j]
            words.append(word)
        out_segments.append({
            "start": round(seg["start"] - offset, 2),
            "end": round(seg["end"] - offset, 2),
            "speaker": labels.get(label),
            "text": text,
            "words": words,
        })

    focus = []
    for lemma in scene.get("focus", [])[:8]:
        hit = next((w for s in out_segments for w in s["words"] if (w["lemma"] or "").lower() == lemma.lower()), None)
        if not hit:
            continue
        still = f"stills/{len(focus) + 1}.jpg"
        run([
            tool("ffmpeg"), "-y", "-ss", f"{hit['start']:.2f}", "-i", str(tmp / "clip.mp4"),
            "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "3", str(tmp / still),
        ])
        focus.append({"lemma": hit["lemma"], "rank": hit["rank"], "at": hit["start"], "still": still})

    n = len(out_segments)
    cards = [
        c for c in scene.get("cards", [])
        if all(0 <= k < n for k in c.get("segments", []) + ([c["segment"]] if "segment" in c else []))
    ]
    duration = float(run([
        tool("ffprobe"), "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(tmp / "clip.mp4"),
    ]).stdout.strip())

    write_json(tmp / "lesson.json", {
        "schema": 1,
        "id": pkg_id,
        "lesson": scene["lesson"],
        "order": order,
        "cefr": source["cefr"],
        "source": {"name": source["name"], "episode": episode["title"], "url": episode["url"], "credit": source["credit"]},
        "media": {"file": "clip.mp4", "kind": "video", "duration": round(duration, 2)},
        "speakers": speakers,
        "segments": out_segments,
        "focus": focus,
        "cards": cards,
    })
    final = LESSONS / pkg_id
    shutil.rmtree(final, ignore_errors=True)
    LESSONS.mkdir(parents=True, exist_ok=True)
    shutil.move(str(tmp), str(final))


def write_index() -> list[dict]:
    packages = []
    for lesson_file in sorted(LESSONS.glob("*/lesson.json")):
        data = read_json(lesson_file)
        updated = datetime.fromtimestamp(lesson_file.stat().st_mtime, timezone.utc).replace(microsecond=0)
        packages.append({
            "id": data["id"], "lesson": data["lesson"], "order": data["order"],
            "updated": updated.isoformat().replace("+00:00", "Z"),
        })
    write_json(LESSONS / "index.json", {"schema": 1, "generated": now_iso(), "packages": packages})
    return packages


def unwatched_count() -> int:
    """Packages whose clip is still there (watched clips get their media removed later)."""
    return sum(1 for d in LESSONS.glob("*/lesson.json") if (d.parent / "clip.mp4").exists())


# ---------- main ----------

def main() -> None:
    parser = argparse.ArgumentParser(description="Turn new German videos into lesson packages.")
    parser.add_argument("--max-episodes", type=int, default=DEFAULT_MAX_EPISODES, help="New episodes per run")
    parser.add_argument("--buffer", type=int, default=DEFAULT_BUFFER, help="Stop when this many lessons are unwatched")
    parser.add_argument("--source", help="Only this source id from sources.json")
    args = parser.parse_args()

    course, ranks = load_course(), load_ranks()
    sources = [s for s in read_json(SOURCES)["sources"] if not args.source or s["id"] == args.source]
    done_episodes = 0

    for source in sources:
        for episode in list_episodes(source):
            folder = WORK / source["id"] / f"e{episode['index']:02d}"
            if (folder / "done.json").exists():
                continue
            if done_episodes >= args.max_episodes:
                break
            if unwatched_count() >= args.buffer:
                print(f"Buffer full ({args.buffer} unwatched lessons). Stopping.")
                write_index()
                return
            print(f"{source['name']} {episode['index']}: {episode['title']}")
            folder.mkdir(parents=True, exist_ok=True)
            video = download(episode, folder)
            segments = transcribe(folder)
            diarize(folder, segments)
            plan = plan_scenes(folder, episode, source, segments, course)
            made = []
            for n, scene in enumerate(valid_scenes(plan, segments, course), 1):
                pkg_id = f"{source['id']}-e{episode['index']:02d}-c{n}"
                existing = [p for p in LESSONS.glob("*/lesson.json") if p.parent.name != pkg_id]
                order = 1 + sum(1 for p in existing if read_json(p)["lesson"] == scene["lesson"])
                build_package(pkg_id, order, scene, plan, episode, source, segments, video, ranks)
                made.append({"id": pkg_id, "lesson": scene["lesson"]})
                print(f"  made {pkg_id} for {scene['lesson']} {course[scene['lesson']]}")
            write_json(folder / "done.json", {"packages": made, "finished": now_iso()})
            for big in ("source.mp4", "audio.wav"):
                (folder / big).unlink(missing_ok=True)
            done_episodes += 1
            write_index()

    packages = write_index()
    print(f"Done. {done_episodes} new episodes, {len(packages)} lesson packages in {LESSONS}")


if __name__ == "__main__":
    main()
