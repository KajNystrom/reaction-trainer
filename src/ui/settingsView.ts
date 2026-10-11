import { ALL_DIRECTIONS, SPOKEN_LABEL } from '../core/directions';
import { cloneDefaults, LIMITS, type Settings, validateSettings } from '../core/settings';
import { h } from './dom';

type MsKey =
  | 'startCountdownMs'
  | 'delayMinMs'
  | 'delayMaxMs'
  | 'delayFixedMs'
  | 'cueDisplayMs'
  | 'restBetweenRepsMs'
  | 'restBetweenSetsMs';
type CountKey = 'sets' | 'repsPerSet' | 'maxRepeat';

export interface SettingsViewProps {
  settings: Settings;
  onSave: (s: Settings) => void;
  onCancel: () => void;
}

/** Settings form. Durations are edited in seconds and stored in milliseconds. */
export function settingsView({ settings, onSave, onCancel }: SettingsViewProps): HTMLElement {
  let draft: Settings = { ...settings, directions: [...settings.directions] };
  const errorsBox = h('div', { class: 'errors', role: 'alert', 'aria-live': 'polite' });
  const form = h('form', { class: 'settings', novalidate: true });

  const countField = (key: CountKey, label: string) => {
    const { min, max } = LIMITS[key];
    const input = h('input', { type: 'number', inputmode: 'numeric', min, max, step: 1, value: draft[key], id: key });
    input.addEventListener('input', () => {
      draft = { ...draft, [key]: input.valueAsNumber };
      refresh();
    });
    return h('label', { class: 'field', for: key }, h('span', {}, label), input);
  };

  const secondsField = (key: MsKey, label: string) => {
    const { min, max } = LIMITS[key];
    const input = h('input', {
      type: 'number',
      inputmode: 'decimal',
      min: min / 1000,
      max: max / 1000,
      step: 0.1,
      value: draft[key] / 1000,
      id: key,
    });
    input.addEventListener('input', () => {
      draft = { ...draft, [key]: Math.round(input.valueAsNumber * 1000) };
      refresh();
    });
    return h('label', { class: 'field', for: key }, h('span', {}, label), h('span', { class: 'with-unit' }, input, 's'));
  };

  const directionBoxes = ALL_DIRECTIONS.map((d) => {
    const box = h('input', { type: 'checkbox', checked: draft.directions.includes(d), value: d });
    box.addEventListener('change', () => {
      draft = { ...draft, directions: ALL_DIRECTIONS.filter((x) => (x === d ? box.checked : draft.directions.includes(x))) };
      refresh();
    });
    return h('label', { class: 'check' }, box, SPOKEN_LABEL[d]);
  });

  const select = <T extends string>(key: 'delayMode' | 'audioMode', label: string, options: [T, string][]) => {
    const el = h('select', { id: key });
    for (const [value, text] of options) el.append(h('option', { value, selected: draft[key] === value }, text));
    el.addEventListener('change', () => {
      draft = { ...draft, [key]: el.value };
      refresh();
    });
    return h('label', { class: 'field', for: key }, h('span', {}, label), el);
  };

  const readyBeep = h('input', { type: 'checkbox', checked: draft.readyBeep, id: 'readyBeep' });
  readyBeep.addEventListener('change', () => {
    draft = { ...draft, readyBeep: readyBeep.checked };
  });

  const randomFields = h('div', {}, secondsField('delayMinMs', 'Shortest wait'), secondsField('delayMaxMs', 'Longest wait'));
  const fixedFields = h('div', {}, secondsField('delayFixedMs', 'Wait'));
  const saveBtn = h('button', { type: 'submit', class: 'btn primary' }, 'Save');

  form.append(
    h('fieldset', {}, h('legend', {}, 'Directions'), h('div', { class: 'checks' }, ...directionBoxes)),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Session'),
      countField('sets', 'Sets'),
      countField('repsPerSet', 'Reps per set'),
      countField('maxRepeat', 'Max same direction in a row'),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Timing'),
      secondsField('startCountdownMs', 'Start countdown'),
      select('delayMode', 'Wait before cue', [
        ['random', 'Random'],
        ['fixed', 'Fixed'],
      ]),
      randomFields,
      fixedFields,
      secondsField('cueDisplayMs', 'Arrow shown for'),
      secondsField('restBetweenRepsMs', 'Rest between reps'),
      secondsField('restBetweenSetsMs', 'Rest between sets'),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Sound'),
      select('audioMode', 'Cue sound', [
        ['speech', 'Spoken word'],
        ['beeps', 'Beep tones'],
        ['off', 'Off'],
      ]),
      h('label', { class: 'check', for: 'readyBeep' }, readyBeep, '"Ready" beep before each cue'),
    ),
    errorsBox,
    h(
      'div',
      { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: () => onCancel() }, 'Cancel'),
      saveBtn,
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'btn subtle',
        onclick: () => {
          if (confirm('Reset all settings to defaults?')) onSave(cloneDefaults());
        },
      },
      'Reset to defaults',
    ),
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (validateSettings(draft).length === 0) onSave(draft);
  });

  function refresh(): void {
    randomFields.hidden = draft.delayMode !== 'random';
    fixedFields.hidden = draft.delayMode !== 'fixed';
    const errors = validateSettings(draft);
    errorsBox.replaceChildren(...errors.map((e) => h('p', {}, e)));
    saveBtn.disabled = errors.length > 0;
  }
  refresh();

  return h('main', { class: 'view settings-view' }, h('h1', {}, 'Settings'), form);
}
