import { cloneDefaults, coerceSettings, type Settings, validateSettings } from '../core/settings';

const KEY = 'reaction-trainer.settings.v1';

/** Loads saved settings; falls back to defaults if storage is unavailable or the data is invalid. */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return cloneDefaults();
    const s = coerceSettings(JSON.parse(raw));
    return validateSettings(s).length === 0 ? s : cloneDefaults();
  } catch {
    return cloneDefaults();
  }
}

export function saveSettings(s: Settings): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
