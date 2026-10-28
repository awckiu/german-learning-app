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

Files already generated are reused, so re-running is free.

## Coming next

| Script | Step | What it does |
| --- | --- | --- |
| `voice_test.py` | 1 | Pick a voice |
| `audio_bank.py` | 2 | 3,000 frequent words + 1,500 sentences in the chosen voice |
| `process_media.py` | 3 | Download, transcribe, label speakers, tag by course lesson, cut clips |
