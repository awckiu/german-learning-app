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
4. App core: word database from the audio bank, Review tab with FSRS flashcards
5. Lessons, daily goals, activities, dashboard and settings

## Running the app (development)

```
cd app
npm install
npx tsc --noEmit
npx expo run:android
```

## Installing on the phone

The APK is built online by Expo (free account at [expo.dev](https://expo.dev)), so no Android Studio is needed. On the laptop:

```
cd app
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile apk
```

When the build finishes, open the link it prints on the S24 and install the APK. The first time the app opens, go to Review and pick the `GermanAppIngest` folder that Syncthing fills; the audio bank is read from `GermanAppIngest/audio_bank/`.
