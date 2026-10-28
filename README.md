# Deutsch

A personal, offline German learning app for Android, modelled on [Palteca](https://palteca.com/): themed courses built from real German clips, German only, with spaced-repetition review.

| Folder | What it is |
| --- | --- |
| `app/` | The phone app (Expo / React Native, Android only, dark mode) |
| `pipeline/` | Python scripts that run on the Windows laptop: ElevenLabs audio bank, lesson processing |

How it fits together: the laptop pipeline turns German videos into lessons and writes them into a folder that Syncthing mirrors to the phone. The app reads that folder and works fully offline.

## Build order

1. Setup and ElevenLabs voice test (this step)
2. Audio bank: one-time run before the credits expire (late Nov 2026)
3. Laptop pipeline + Syncthing
4. App core: lesson import, player, tap-a-word, review cards
5. Daily goals, activities, dashboard and settings

## Running the app (development)

```
cd app
npm install
npx tsc --noEmit
npx expo run:android
```
