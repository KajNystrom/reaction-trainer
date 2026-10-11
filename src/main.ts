import './style.css';
import { AudioCues } from './app/audioCues';
import { SessionDriver } from './app/driver';
import { loadSettings, saveSettings } from './app/storage';
import { performanceClock } from './core/clock';
import { mathRandom } from './core/random';
import { Session } from './core/session';
import type { Settings } from './core/settings';
import { WakeLockManager } from './platform/wakeLock';
import { registerServiceWorker } from './pwa';
import { homeView } from './ui/homeView';
import { sessionView } from './ui/sessionView';
import { settingsView } from './ui/settingsView';

const app = document.querySelector<HTMLDivElement>('#app')!;
let settings = loadSettings();

const notices = new Set<string>();
let currentView: ReturnType<typeof sessionView> | null = null;
const showNotices = () => currentView?.setNotice([...notices].join(' · '));

// Wake lock fails silently: there is no warning in the UI by choice.
const wakeLock = new WakeLockManager();

const SPEECH_NOTICE = 'Spoken cues unavailable — using beeps';
const audio = new AudioCues(() => {
  notices.add(SPEECH_NOTICE);
  showNotices();
});

function supportWarnings(s: Settings): string[] {
  const w: string[] = [];
  const support = AudioCues.support();
  if (!support.beeps) w.push('Web Audio is not supported: no beeps.');
  if (s.audioMode === 'speech' && !support.speech) w.push('Speech is not supported: cues will use beeps.');
  return w;
}

function showHome(): void {
  currentView = null;
  app.replaceChildren(
    homeView({
      settings,
      warnings: supportWarnings(settings),
      onStart: startSession,
      onSettings: showSettings,
    }),
  );
}

function showSettings(): void {
  app.replaceChildren(
    settingsView({
      settings,
      onSave: (s) => {
        settings = s;
        saveSettings(s);
        showHome();
      },
      onCancel: showHome,
    }),
  );
}

function startSession(): void {
  // Everything audio-related must start synchronously inside this click handler.
  const effective: Settings = { ...settings, directions: [...settings.directions] };
  const unlocking = audio.unlock(effective);
  void wakeLock.acquire();
  notices.clear();

  const session = new Session(effective, { clock: performanceClock, rng: mathRandom });
  const view = sessionView({
    onPauseToggle: () => (session.getState().paused ? session.resume() : session.pause()),
    onStop: () => session.stop(),
    onClose: () => {
      driver.dispose();
      document.removeEventListener('visibilitychange', onVisibility);
      showHome();
    },
  });
  currentView = view;
  const driver = new SessionDriver(session, performanceClock, () => view.update(session.getState()));

  session.subscribe((event) => {
    audio.handle(event, effective);
    view.update(event.state);
    if (event.type === 'phase' && (event.state.phase === 'done' || event.state.phase === 'idle')) {
      void wakeLock.release();
    }
  });

  // Timers are throttled while the page is hidden, so pause instead of drifting.
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') session.pause();
  };
  document.addEventListener('visibilitychange', onVisibility);

  void unlocking.then(({ speech }) => {
    if (effective.audioMode === 'speech' && !speech) {
      effective.audioMode = 'beeps';
      notices.add(SPEECH_NOTICE);
    }
    showNotices();
  });

  app.replaceChildren(view.root);
  driver.start();
  session.start();
}

showHome();
registerServiceWorker();
