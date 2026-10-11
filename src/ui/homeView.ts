import { SPOKEN_LABEL } from '../core/directions';
import type { Settings } from '../core/settings';
import { h } from './dom';

export interface HomeViewProps {
  settings: Settings;
  warnings: string[];
  onStart: () => void;
  onSettings: () => void;
}

export function homeView({ settings: s, warnings, onStart, onSettings }: HomeViewProps): HTMLElement {
  const sec = (ms: number) => `${+(ms / 1000).toFixed(1)} s`;
  const wait = s.delayMode === 'random' ? `${sec(s.delayMinMs)}–${sec(s.delayMaxMs)} random` : `${sec(s.delayFixedMs)} fixed`;
  const sound = { speech: 'spoken word', beeps: 'beep tones', off: 'no cue sound' }[s.audioMode];

  return h(
    'main',
    { class: 'view home-view' },
    h('h1', {}, 'Reaction Trainer'),
    warnings.length > 0 &&
      h('div', { class: 'warnings', role: 'status' }, ...warnings.map((w) => h('p', {}, '⚠ ', w))),
    h(
      'dl',
      { class: 'summary' },
      h('dt', {}, 'Directions'),
      h('dd', {}, s.directions.map((d) => SPOKEN_LABEL[d]).join(', ')),
      h('dt', {}, 'Session'),
      h('dd', {}, `${s.sets} sets × ${s.repsPerSet} reps`),
      h('dt', {}, 'Wait before cue'),
      h('dd', {}, wait),
      h('dt', {}, 'Rest'),
      h('dd', {}, `${sec(s.restBetweenRepsMs)} between reps, ${sec(s.restBetweenSetsMs)} between sets`),
      h('dt', {}, 'Sound'),
      h('dd', {}, sound + (s.readyBeep ? ' + ready beep' : '')),
    ),
    h('button', { type: 'button', class: 'btn big primary start', onclick: () => onStart() }, 'Start'),
    h('button', { type: 'button', class: 'btn big', onclick: () => onSettings() }, 'Settings'),
  );
}
