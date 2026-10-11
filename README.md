# Reaction Trainer

Reaction Trainer is a web app for footwork reaction drills. It shows a large arrow and says a direction ("left", "right", "front") at a random time. You sprint to the cone in that direction, touch it and go back to the start mark. The app runs on Android Chrome, installs to the home screen and works offline.

Live app: https://kajnystrom.github.io/reaction-trainer/

## How a session runs

With the default settings, a session has 3 sets of 6 reps:

1. A 5-second countdown starts the session.
2. **Get ready**: the app plays a short high beep. Then it waits a random 1.5 to 4 seconds.
3. **Go**: the screen turns white and shows a black arrow for 2 seconds. The app says the direction.
4. **Rest**: a large countdown shows 25 seconds. Your sprint and return are part of this rest.
5. Steps 2 to 4 repeat for each rep. Between sets, the rest is 90 seconds.
6. **Done**: the app plays two tones and shows a check mark.

In each set, each direction appears an equal number of times. If the reps do not divide equally, some directions get one extra cue. The same direction never comes more than 2 times in a row.

## Settings

Tap **Settings** on the home screen. The app saves your settings on the phone.

| Setting | Default | Notes |
|---|---|---|
| Directions | left, right, front | Also back and the four diagonals |
| Sets | 3 | |
| Reps per set | 6 | |
| Max same direction in a row | 2 | |
| Start countdown | 5 s | |
| Wait before cue | Random, 1.5–4 s | Or Fixed, one value |
| Arrow shown for | 2 s | |
| Rest between reps | 25 s | Starts when the arrow goes away |
| Rest between sets | 90 s | |
| Cue sound | Spoken word | Or beep tones, or off |
| "Ready" beep before each cue | On | |

The beep tones are different for each direction: left is low, right is high, front is in the middle, and back is the lowest. Diagonals play two tones.

To go back to the defaults, tap **Reset to defaults** at the bottom of the settings page.

### Pause

Tap **Pause** to stop the timer. Tap **Resume** to continue.

- In a countdown, cue or rest, the timer continues from where it stopped.
- In "Get ready", the wait starts again from the beginning, so the pause does not tell you when the cue comes. In Random mode, the app picks a new wait time.

If you switch to another app or the screen turns off, the session pauses.

## Set up the phone

1. Put the phone 2 to 4 m from the start mark.
2. Put the phone up at an angle, for example against a bag or a bench. If the phone lies flat, you cannot read the screen from 4 m.
3. Set the media volume to high.

## Install on Android

1. Open the live app link in Chrome.
2. Tap the menu (three dots) and then **Add to home screen** or **Install app**.
3. Tap **Install**.
4. Open Reaction Trainer from the home screen.

The app works offline after the first visit.

To get a new version after a deploy, open the app while you are online, then close it and open it again.

## Develop on your computer

You must have Node.js 24 or later and Git. All commands are for PowerShell.

### Get the code

```powershell
git clone https://github.com/KajNystrom/reaction-trainer.git
Set-Location reaction-trainer
npm install
```

### Run the app locally

```powershell
npm run dev
```

Open http://localhost:5173 in a browser.

To test on your phone on the same Wi-Fi network, run:

```powershell
npm run dev -- --host
```

Open the "Network" address that Vite shows. The service worker and wake lock do not work on this address, because they need HTTPS. Use the live app to test them.

### Run the tests

```powershell
npm test
```

To run the tests again each time a file changes:

```powershell
npm run test:watch
```

### Build

```powershell
npm run build
```

The build goes into the `dist` folder. To build with the same path as GitHub Pages and look at the result:

```powershell
$env:BASE_PATH = '/reaction-trainer/'
npm run build
npm run preview -- --base /reaction-trainer/
$env:BASE_PATH = $null
```

Open http://localhost:4173/reaction-trainer/. The service worker works on this address.

### Change the icons

The icons in `public/icons` come from a script. To make them again:

```powershell
node scripts/make-icons.mjs
```

## Deploy

The workflow in `.github/workflows/deploy.yml` runs the tests, builds the app and deploys it to GitHub Pages. It runs on each push to `main`.

Do these steps one time for a new repository:

1. On GitHub, open the repository and go to **Settings** > **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

Then deploy:

```powershell
git push origin main
```

To see the result, open the **Actions** tab on GitHub.

## Code structure

| Folder | Content |
|---|---|
| `src/core` | Session timing, cue order and settings. No browser code. The clock and the random source are parameters, so the tests can control them. |
| `src/platform` | Beeps (Web Audio), speech (Web Speech API) and wake lock. Each one checks if the browser supports it. |
| `src/app` | Connects the session to sound, storage and the timers. |
| `src/ui` | Screens: home, session and settings. |
| `src/sw` | Service worker template. The build adds the list of files to cache. |
| `tests` | Vitest tests for the cue order, the session and the settings. |

The session sends an event when each phase starts. A cue event has the time that the arrow appeared. A later version can use this time to measure reaction time.

## Known limitations on Android

- **Spoken cues are late.** Android Chrome starts to speak 100 to 500 ms after the arrow appears, and the delay changes. The arrow is the exact signal. If timing is important, use beep tones.
- **Speech needs a text-to-speech engine.** Some phones have no English voice installed. Then the app uses beep tones and shows a message. To add a voice, go to Android **Settings** > **Accessibility** > **Text-to-speech output**.
- **The first spoken cue can be slower.** The app loads the voice when you tap Start, but some phones need more time.
- **Wake lock can fail.** Battery saver mode can block it. If it fails, the app shows "Screen may turn off". Set a long screen timeout in Android settings as a backup.
- **Sound needs a tap first.** Chrome blocks sound until you touch the page. The app turns on sound when you tap Start.
- **Timers stop in the background.** If you leave the app or the screen turns off, the session pauses. Tap Resume when you come back.
- **Media volume controls the cues.** The app does not use the ringer volume. If the media volume is low, you will not hear the cues.
- **Updates need two starts.** After a deploy, the first start downloads the new version. The second start uses it.
