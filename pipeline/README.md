# Laptop pipeline

Runs on Andrea's Windows laptop. It prepares everything the phone app plays: the ElevenLabs audio bank (once) and new lessons from German video sources (weekly). Output syncs to the phone with Syncthing.

## One-time setup (Windows)

1. Install Python 3.12 or newer from [python.org](https://www.python.org/downloads/windows/). Tick **Add python.exe to PATH** during install.
2. Download this repo (green **Code** button on GitHub, then **Download ZIP**) and unzip it, or `git clone` it.
3. In the `pipeline` folder, copy `.env.example` to `.env` and paste your ElevenLabs API key after `ELEVENLABS_API_KEY=`.
   The key is on [elevenlabs.io](https://elevenlabs.io) under your profile, **API Keys**. `.env` is never committed.

## Step 1: voice test

Open a terminal in the `pipeline` folder (in File Explorer, type `cmd` in the address bar) and run:

```
py voice_test.py
```

It makes 20 short German words and sentences in 3 voices from your account, preferring ones labelled German, and uses under 1,000 credits. When it finishes, open `voice_test_output\index.html` and listen.

To compare specific voices, add them to your account from the ElevenLabs Voice Library first, then:

```
py voice_test.py --voices "Voice One" "Voice Two" "Voice Three"
```

Files already generated are reused, so re-running costs little or nothing.

## Step 2: audio bank

`data/word_list.tsv` holds about 3,000 of the most common German words, ranked by frequency. Each noun has its article, and the top ~1,500 words have a short example sentence. Sarah says each word, and both Sarah and Lennard say each sentence.

Spot check first (about 1,500 credits):

```
py audio_bank.py --sample 50
```

Open `output\audio_bank\index.html` and listen. If everything sounds right, run the full bank (about 96,000 credits in total; it asks before spending):

```
py audio_bank.py
```

Already generated files are skipped, so you can stop it (Ctrl+C) and run it again later. It stops if the run would cost more than `--budget` (default 125,000). `output\audio_bank\manifest.json` maps each word to its audio files for the app.

## Scripts

| Script | Step | What it does |
| --- | --- | --- |
| `voice_test.py` | 1 | Compare voices |
| `audio_bank.py` | 2 | Words in Sarah, sentences in Sarah and Lennard |
| `process_media.py` | 3 | Download, transcribe, label speakers, tag by course lesson, cut clips (coming next) |
